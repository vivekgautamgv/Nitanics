import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const filename = fileURLToPath(import.meta.url)
const pipelineDirectory = resolve(dirname(filename), '../apps/ingestion-pipeline')

export function runCommand(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { ...options, shell: false, windowsHide: true, stdio: 'inherit' })
    child.once('error', error => rejectRun(error.code === 'ENOENT'
      ? new Error('uv was not found. Install uv, reopen your terminal, and run bun run nlp:setup again.')
      : error))
    child.once('close', code => code === 0 ? resolveRun() : rejectRun(new Error(`NLP setup command failed (exit ${code}).`)))
  })
}

export async function setupNlp({ checkOnly = false, run = runCommand, log = console.log } = {}) {
  if (!checkOnly) {
    log('[nlp] Installing locked dependencies into apps/ingestion-pipeline/.venv')
    await run('uv', ['sync', '--locked'], { cwd: pipelineDirectory })
  }
  log(checkOnly ? '[nlp] Checking installed models without downloading' : '[nlp] Loading spaCy and caching the MiniLM embedding model (first run needs internet)')
  const code = [
    'import sys, spacy',
    'from sentence_transformers import SentenceTransformer',
    "nlp = spacy.load('en_core_web_lg')",
    "assert 'ner' in nlp.pipe_names, 'spaCy NER pipeline is missing'",
    `model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu', local_files_only=${checkOnly ? 'True' : 'False'})`,
    "assert model.get_sentence_embedding_dimension() == 384, 'Expected 384-dimensional embeddings'",
    "vector = model.encode(['Nitanics setup check.'])[0]",
    "assert len(vector) == 384 and any(float(value) != 0 for value in vector), 'Embedding check failed'",
    "print('[nlp] Ready: spaCy en_core_web_lg and real 384-dimensional MiniLM embeddings')",
    "print('[nlp] Python:', sys.executable)",
  ].join('\n')
  await run('uv', ['run', checkOnly ? '--no-sync' : '--locked', 'python', '-c', code], { cwd: pipelineDirectory })
}

if (process.argv[1] && resolve(process.argv[1]) === filename) {
  const options = process.argv.slice(2)
  if (options.some(option => option !== '--check')) {
    console.error('Usage: node scripts/setup-nlp.mjs [--check]')
    process.exitCode = 1
  } else {
    setupNlp({ checkOnly: options.includes('--check') }).catch(error => {
      console.error(`[nlp] ${error.message}`)
      if (options.includes('--check')) console.error('[nlp] Run bun run nlp:setup to install or cache missing models.')
      process.exitCode = 1
    })
  }
}
