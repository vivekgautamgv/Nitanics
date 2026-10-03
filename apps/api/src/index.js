import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const appDirectory = path.dirname(filename);
const MiB = 1024 * 1024;
export const UPLOAD_LIMITS = { files: 20, fileBytes: 10 * MiB, totalBytes: 25 * MiB, bodyBytes: 40 * MiB };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerKeys = { gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function requiredName(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200 || /[\x00-\x1f]/.test(value)) {
    throw new RequestError(`${label} must contain between 1 and 200 characters.`);
  }
  return value.trim();
}

export function validateIngestion(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestError('Expected a JSON object.');
  const collection = requiredName(data.collection, 'Collection');
  const directory = requiredName(data.directory ?? 'Research', 'Workspace folder');
  const provider = data.provider;
  if (provider != null && !Object.hasOwn(providerKeys, provider)) throw new RequestError('Choose Gemini, OpenAI, or Anthropic.');
  if (data.apiKey != null && (typeof data.apiKey !== 'string' || data.apiKey.length > 4096)) throw new RequestError('Invalid API key.');
  if (data.apiKey?.trim() && !provider) throw new RequestError('Choose a provider for the supplied API key.');
  if (!Array.isArray(data.files) || data.files.length < 1 || data.files.length > UPLOAD_LIMITS.files) {
    throw new RequestError(`Upload between 1 and ${UPLOAD_LIMITS.files} documents.`);
  }
  const names = new Set();
  const slugs = new Set();
  let totalBytes = 0;
  const files = data.files.map(file => {
    if (!file || typeof file.name !== 'string' || typeof file.content !== 'string') throw new RequestError('Every document needs a name and content.');
    const name = file.name;
    if (!name || name.length > 200 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
      throw new RequestError('Document names must be valid filenames without folders or reserved characters.');
    }
    const extension = path.extname(name).toLowerCase();
    if (!['.md', '.txt', '.pdf'].includes(extension)) throw new RequestError(`Unsupported document: ${name}. Use Markdown, text, or PDF.`);
    const slug = path.parse(name).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug || names.has(name.toLowerCase()) || slugs.has(slug)) throw new RequestError('Documents need distinct names. Rename files that resolve to the same project name.');
    names.add(name.toLowerCase());
    slugs.add(slug);
    let content;
    if (extension === '.pdf') {
      const match = /^data:application\/pdf;base64,([a-zA-Z0-9+/]*={0,2})$/.exec(file.content);
      if (!match || match[1].length % 4 !== 0) throw new RequestError(`Invalid PDF encoding: ${name}.`);
      content = Buffer.from(match[1], 'base64');
      if (!content.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new RequestError(`Invalid PDF document: ${name}.`);
    } else {
      if (!file.content.trim()) throw new RequestError(`Document is empty: ${name}.`);
      content = Buffer.from(file.content, 'utf8');
    }
    if (!content.length) throw new RequestError(`Document is empty: ${name}.`);
    totalBytes += content.length;
    if (content.length > UPLOAD_LIMITS.fileBytes || totalBytes > UPLOAD_LIMITS.totalBytes) {
      throw new RequestError('Documents exceed the limit: 10 MiB per file and 25 MiB per upload.', 413);
    }
    return { name, content };
  });
  if (data.requestId != null && (typeof data.requestId !== 'string' || !uuidPattern.test(data.requestId))) {
    throw new RequestError('Invalid request ID.');
  }
  return { collection, directory, provider, apiKey: data.apiKey?.trim(), files, requestId: data.requestId };
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
      req.resume();
      reject(new RequestError('Send an application/json request.', 415));
      return;
    }
    let bytes = 0;
    const chunks = [];
    let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      bytes += chunk.length;
      if (bytes > UPLOAD_LIMITS.bodyBytes) {
        failed = true;
        chunks.length = 0;
        reject(new RequestError('Upload request exceeds 40 MiB.', 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new RequestError('Invalid JSON payload.')); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new RequestError('Upload was interrupted.')));
  });
}

function localOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export function createApiServer({
  spawnProcess = spawn,
  pipelineDirectory = path.resolve(appDirectory, '../../ingestion-pipeline'),
  exportsDirectory = path.resolve(appDirectory, '../../exports'),
  jobTimeoutMs = 60 * 60 * 1000,
} = {}) {
  const jobs = new Map();

  function startJob(processId, type, args, env, { cleanup, downloadFile, fingerprint, secrets = [] } = {}) {
    const job = {
      processId, type, status: 'running', logs: `[API] Starting ${type}...\n`, exitCode: null,
      error: null, downloadUrl: null, startedAt: new Date().toISOString(), finishedAt: null, fingerprint,
    };
    jobs.set(processId, job);
    const appendLog = message => {
      for (const secret of secrets.filter(Boolean)) message = message.split(secret).join('[redacted]');
      job.logs = (job.logs + message).slice(-512 * 1024);
    };
    let timer;
    const finish = (code, error) => {
      if (job.status !== 'running') return;
      clearTimeout(timer);
      job.exitCode = code;
      job.finishedAt = new Date().toISOString();
      if (!error && code === 0 && downloadFile && !fs.existsSync(path.join(exportsDirectory, downloadFile))) {
        error = 'The export finished without creating a download. Check the export logs.';
      }
      job.status = !error && code === 0 ? 'success' : 'failed';
      job.error = error || (code === 0 ? null : `The ${type} process failed. Review the logs below.`);
      appendLog(`\n[API] ${job.status === 'success' ? 'Completed' : job.error}\n`);
      if (job.status === 'success' && downloadFile) job.downloadUrl = `/api/download?file=${encodeURIComponent(downloadFile)}`;
      try { cleanup?.(); } catch (err) { appendLog(`[API] Temporary upload cleanup failed: ${err.message}\n`); }
    };
    try {
      const child = spawnProcess('uv', ['run', 'python', '-u', ...args], {
        cwd: pipelineDirectory, env, windowsHide: true, detached: process.platform !== 'win32',
      });
      child.stdout?.on('data', data => appendLog(data.toString()));
      child.stderr?.on('data', data => appendLog(`[STDERR] ${data.toString()}`));
      child.once('error', err => finish(null, err.code === 'ENOENT'
        ? 'Cannot start the pipeline: uv was not found. Install uv and restart the API server.'
        : `Cannot start the pipeline: ${err.message}`));
      child.once('close', (code, signal) => finish(code, job.error || (signal ? `The ${type} process stopped (${signal}).` : null)));
      timer = setTimeout(() => {
        job.error = 'The process exceeded one hour. Review its saved artifacts before retrying.';
        appendLog(`\n[API] ${job.error} Stopping the pipeline.\n`);
        // uv launches Python as a child; stopping only uv can leave ingestion
        // running. Stop this job's process tree and clean uploads after close.
        if (process.platform === 'win32' && child.pid) {
          const stop = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
          stop.once('error', () => child.kill());
        } else if (child.pid) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill(); }
        } else {
          child.kill();
        }
      }, jobTimeoutMs);
      timer.unref?.();
    } catch (err) {
      finish(null, `Cannot start the pipeline: ${err.message}`);
    }
    return job;
  }

  function pruneJobs() {
    const finished = [...jobs.values()].filter(job => job.status !== 'running');
    for (const job of finished.slice(0, Math.max(0, finished.length - 100))) jobs.delete(job.processId);
  }

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (localOrigin(origin) && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    const sendJSON = (status, data) => {
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    try {
      if (!localOrigin(origin)) throw new RequestError('This local API only accepts requests from localhost.', 403);
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJSON(200, { status: 'ok', runningJobs: [...jobs.values()].filter(job => job.status === 'running').length });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const job = jobs.get(url.searchParams.get('id'));
        if (!job) throw new RequestError('Process not found. The API may have restarted; check the saved graph artifacts before retrying.', 404);
        const { fingerprint, type, ...publicJob } = job;
        sendJSON(200, publicJob);
        return;
      }
      if (req.method === 'POST' && ['/api/ingest', '/api/export'].includes(url.pathname)) {
        const data = await readJSON(req);
        pruneJobs();
        if (url.pathname === '/api/ingest') {
          const input = validateIngestion(data);
          const processId = input.requestId || randomUUID();
          const fingerprint = createHash('sha256').update(JSON.stringify({ ...data, requestId: undefined })).digest('hex');
          const existing = jobs.get(processId);
          if (existing) {
            if (existing.type !== 'ingestion' || existing.fingerprint !== fingerprint) throw new RequestError('This request ID belongs to a different upload.', 409);
            sendJSON(202, { processId, status: existing.status });
            return;
          }
          if ([...jobs.values()].filter(job => job.status === 'running').length >= 2) throw new RequestError('Two jobs are already running. Wait for one to finish.', 429);
          const uploadDirectory = path.join(pipelineDirectory, 'data/temp_upload', processId);
          fs.mkdirSync(uploadDirectory, { recursive: true });
          try {
            for (const file of input.files) fs.writeFileSync(path.join(uploadDirectory, file.name), file.content, { flag: 'wx' });
          } catch (error) {
            fs.rmSync(uploadDirectory, { recursive: true, force: true });
            throw error;
          }
          const env = { ...process.env, PYTHONUNBUFFERED: '1' };
          if (input.provider) {
            const selectedKey = input.apiKey || env[providerKeys[input.provider]];
            for (const key of Object.values(providerKeys)) delete env[key];
            if (selectedKey) env[providerKeys[input.provider]] = selectedKey;
            env.NITANICS_LLM_PROVIDER = input.provider;
          }
          const job = startJob(processId, 'ingestion', [
            'bulk_ingest.py', '--folder', uploadDirectory, '--collection', input.collection, '--directory', input.directory,
          ], env, {
            fingerprint, secrets: Object.values(providerKeys).map(key => env[key]),
            cleanup: () => fs.rmSync(uploadDirectory, { recursive: true, force: true }),
          });
          sendJSON(202, { processId, status: job.status });
        } else {
          const collection = requiredName(data?.collection, 'Collection');
          if ([...jobs.values()].filter(job => job.status === 'running').length >= 2) throw new RequestError('Two jobs are already running. Wait for one to finish.', 429);
          const processId = randomUUID();
          const downloadFile = `${processId}.zip`;
          fs.mkdirSync(exportsDirectory, { recursive: true });
          const job = startJob(processId, 'export', [
            'neo4j/export_collection.py', collection, '--output', path.join(exportsDirectory, downloadFile),
          ], { ...process.env, PYTHONUNBUFFERED: '1' }, { downloadFile });
          sendJSON(202, { processId, status: job.status });
        }
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/download') {
        const file = url.searchParams.get('file');
        if (!file || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.zip$/.test(file)) throw new RequestError('Invalid export filename.');
        const exportPath = path.join(exportsDirectory, file);
        if (!fs.existsSync(exportPath) || !fs.statSync(exportPath).isFile()) throw new RequestError('Export file not found.', 404);
        const stream = fs.createReadStream(exportPath);
        stream.on('error', () => { if (!res.headersSent) sendJSON(500, { error: 'Cannot read export file.' }); else res.destroy(); });
        res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${file.replace(/"/g, '')}"` });
        stream.pipe(res);
        return;
      }
      throw new RequestError('Route not found.', 404);
    } catch (err) {
      if (!(err instanceof RequestError)) console.error('[API]', err.message);
      sendJSON(err instanceof RequestError ? err.status : 500, {
        error: err instanceof RequestError ? err.message : 'The API could not complete this request. Check the API server logs.',
      });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  const port = Number(process.env.NITANICS_API_PORT || 5176);
  createApiServer().listen(port, '127.0.0.1', () => {
    console.log(`[API] Nitanics API is running at http://127.0.0.1:${port}`);
  });
}
