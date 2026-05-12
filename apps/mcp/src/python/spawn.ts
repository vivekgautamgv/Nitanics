import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { SpawnResult } from '../types/index.js';
import { config } from '../config.js';

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const C01_DIR = config.c01_dir;

function resolveC01Path(relativePath: string): string {
  return path.resolve(C01_DIR, relativePath);
}

/** Find Python executable — prefer .venv in C01 if it exists */
function findPython(): string {
  const venvPython = path.resolve(C01_DIR, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (fs.existsSync(venvPython)) return venvPython;
  return 'python';
}

/**
 * Spawn a Python script, optionally send stdin JSON, collect stdout/stderr.
 * Pattern: spawn-and-exit. No persistent service.
 */
export async function spawnPython(
  scriptPath: string,
  args: string[] = [],
  stdinData?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<SpawnResult> {
  const fullPath = resolveC01Path(scriptPath);
  const python = findPython();

  return new Promise((resolve, reject) => {
    const proc = spawn(python, [fullPath, ...args], {
      cwd: path.dirname(fullPath),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      reject(new Error(`Python script timed out after ${timeoutMs}ms: ${scriptPath}`));
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Python: ${error.message}`));
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return; // already rejected by timeout
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(new Error(`Python script exited with code ${exitCode}: ${stderr || stdout}`));
      } else {
        resolve({ stdout, stderr, code: exitCode });
      }
    });

    if (stdinData !== undefined) {
      proc.stdin.write(typeof stdinData === 'string' ? stdinData : JSON.stringify(stdinData));
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

/**
 * Spawn Python and parse stdout as JSON.
 * Used by embed.py and preprocess.py (stdin/stdout JSON protocol).
 */
export async function spawnPythonJSON<T = unknown>(
  scriptPath: string,
  args: string[] = [],
  stdinData?: unknown
): Promise<T> {
  const result = await spawnPython(scriptPath, args, stdinData);
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(`Failed to parse Python JSON output: ${result.stdout.slice(0, 200)}`);
  }
}
