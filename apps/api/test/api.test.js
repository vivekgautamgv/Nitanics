import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApiServer, validateIngestion, UPLOAD_LIMITS } from '../src/index.js';

const payload = overrides => ({ collection: 'Research', directory: 'Notes', provider: 'openai', files: [{ name: 'report.md', content: 'Document facts.' }], ...overrides });

test('uploads reject unsafe names, duplicate project slugs, invalid PDF and oversized content', () => {
  assert.throws(() => validateIngestion(payload({ files: [{ name: '../source.md', content: 'text' }] })), /valid filenames/);
  assert.throws(() => validateIngestion(payload({ files: [{ name: 'con.md', content: 'text' }] })), /valid filenames/);
  assert.throws(() => validateIngestion(payload({ files: [{ name: 'file.pdf', content: 'data:application/pdf;base64,dGV4dA==' }] })), /Invalid PDF/);
  assert.throws(() => validateIngestion(payload({ files: [{ name: 'a b.md', content: 'text' }, { name: 'a-b.txt', content: 'text' }] })), /distinct names/);
  assert.throws(() => validateIngestion(payload({ files: [{ name: 'big.txt', content: 'x'.repeat(UPLOAD_LIMITS.fileBytes + 1) }] })), /exceed the limit/);
  assert.equal(validateIngestion(payload()).files[0].content.toString(), 'Document facts.');
});

async function setup(t, spawnProcess, extraOptions = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nitanics-api-test-'));
  const exportsDirectory = path.join(directory, 'exports');
  const server = createApiServer({ spawnProcess, pipelineDirectory: directory, exportsDirectory, ...extraOptions });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, exportsDirectory };
}

function childProcess() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => child.emit('close', null, 'SIGTERM');
  return child;
}

const post = (base, route, body, headers = {}) => fetch(`${base}${route}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('missing uv becomes a failed job without crashing the API', async t => {
  const { base } = await setup(t, () => {
    const child = childProcess();
    setImmediate(() => child.emit('error', Object.assign(new Error('spawn uv ENOENT'), { code: 'ENOENT' })));
    return child;
  });
  const response = await post(base, '/api/ingest', payload());
  assert.equal(response.status, 202);
  const { processId } = await response.json();
  const status = await (await fetch(`${base}/api/status?id=${processId}`)).json();
  assert.equal(status.status, 'failed');
  assert.match(status.error, /uv was not found/);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});

test('matching request ID is idempotent, selected provider is isolated, and logs redact API keys', async t => {
  let calls = 0;
  const children = [];
  const { base } = await setup(t, (_command, _args, options) => {
    calls++;
    assert.equal(options.env.OPENAI_API_KEY, 'test-secret');
    assert.equal(options.env.GEMINI_API_KEY, undefined);
    assert.equal(options.env.ANTHROPIC_API_KEY, undefined);
    const child = childProcess();
    children.push(child);
    return child;
  });
  const body = payload({ requestId: randomUUID(), apiKey: 'test-secret' });
  const first = await (await post(base, '/api/ingest', body)).json();
  const repeated = await (await post(base, '/api/ingest', body)).json();
  assert.equal(first.processId, repeated.processId);
  assert.equal(calls, 1);
  assert.equal((await post(base, '/api/ingest', { ...body, collection: 'Different' })).status, 409);
  children[0].stderr.emit('data', Buffer.from('key=test-secret'));
  children[0].emit('close', 1);
  const status = await (await fetch(`${base}/api/status?id=${first.processId}`)).json();
  assert.equal(status.status, 'failed');
  assert.match(status.logs, /key=\[redacted\]/);
  assert.equal(status.fingerprint, undefined);
});

test('export publishes its actual unique download and serves the ZIP', async t => {
  const { base } = await setup(t, (_command, args) => {
    const child = childProcess();
    writeFileSync(args[args.indexOf('--output') + 1], Buffer.from('zip test bytes'));
    setImmediate(() => child.emit('close', 0));
    return child;
  });
  const response = await post(base, '/api/export', { collection: 'Collection / punctuation: 日本語' });
  assert.equal(response.status, 202);
  const { processId } = await response.json();
  const status = await (await fetch(`${base}/api/status?id=${processId}`)).json();
  assert.equal(status.status, 'success');
  assert.equal(status.downloadUrl, `/api/download?file=${processId}.zip`);
  assert.equal(await (await fetch(`${base}${status.downloadUrl}`)).text(), 'zip test bytes');
  assert.equal((await fetch(`${base}/api/download?file=..%2Fsecret.zip`)).status, 400);
});

test('API rejects nonlocal browser origins, malformed JSON and an overloaded job queue', async t => {
  const children = [];
  const { base } = await setup(t, () => { const child = childProcess(); children.push(child); return child; });
  assert.equal((await post(base, '/api/ingest', payload(), { Origin: 'https://example.com' })).status, 403);
  const local = await fetch(`${base}/api/health`, { headers: { Origin: 'http://127.0.0.1:5174' } });
  assert.equal(local.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5174');
  assert.equal((await fetch(`${base}/api/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })).status, 400);
  assert.equal((await post(base, '/api/ingest', payload())).status, 202);
  assert.equal((await post(base, '/api/ingest', payload())).status, 202);
  assert.equal((await post(base, '/api/ingest', payload())).status, 429);
  for (const child of children) child.emit('close', 1);
});

test('a timed-out job terminates and reports failure after its child closes', async t => {
  const { base } = await setup(t, childProcess, { jobTimeoutMs: 20 });
  const { processId } = await (await post(base, '/api/ingest', payload())).json();
  await new Promise(resolve => setTimeout(resolve, 40));
  const status = await (await fetch(`${base}/api/status?id=${processId}`)).json();
  assert.equal(status.status, 'failed');
  assert.match(status.error, /exceeded one hour/);
  assert.equal((await (await fetch(`${base}/api/health`)).json()).runningJobs, 0);
});
