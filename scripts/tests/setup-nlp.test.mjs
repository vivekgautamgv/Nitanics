import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setupNlp } from '../setup-nlp.mjs'

test('model setup uses the same pipeline uv environment as the API and checks real vectors', async () => {
  const calls = []
  await setupNlp({ run: async (...args) => calls.push(args), log: () => {} })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].slice(0, 2), ['uv', ['sync', '--locked']])
  assert.equal(calls[0][2].cwd, calls[1][2].cwd)
  assert.match(calls[0][2].cwd.replaceAll('\\', '/'), /apps\/ingestion-pipeline$/)
  assert.deepEqual(calls[1][1].slice(0, 5), ['run', '--locked', 'python', '-c', calls[1][1][4]])
  assert.match(calls[1][1][4], /spacy.load\('en_core_web_lg'\)/)
  assert.match(calls[1][1][4], /== 384/)
  assert.match(calls[1][1][4], /model.encode/)
})

test('local check does not sync or download missing models', async () => {
  const calls = []
  await setupNlp({ checkOnly: true, run: async (...args) => calls.push(args), log: () => {} })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0][1].slice(0, 4), ['run', '--no-sync', 'python', '-c'])
  assert.match(calls[0][1][4], /local_files_only=True/)
})

test('a failed dependency install stops setup before trying model loads', async () => {
  let calls = 0
  await assert.rejects(setupNlp({ run: async () => { calls++; throw new Error('Install failed') }, log: () => {} }), /Install failed/)
  assert.equal(calls, 1)
})
