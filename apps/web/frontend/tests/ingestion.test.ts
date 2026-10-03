import { describe, expect, test } from 'bun:test'
import {
  collectUploadDocuments, readUploadDocument, parseIngestionJob, saveIngestionJob, clearIngestionJob,
  watchIngestionJob, IngestionApiError, MAX_DOCUMENT_BYTES, MAX_UPLOAD_BYTES,
  type IngestionJob, type IngestionStatus, type UploadDocument,
} from '../src/services/ingestion'

const file = (name: string, size = 10) => ({ name, size } as File)
const readText = async () => 'A useful source document.'
const job: IngestionJob = {
  processId: 'cea280a3-b21b-44b7-ab90-50827247df39', collection: 'Research',
  directory: 'Workspace', fileNames: ['notes.md'], startedAt: Date.now() - 60000,
}

describe('ingestion document preparation', () => {
  test('keeps usable documents while explaining duplicates, collisions, unsafe names and empty files', async () => {
    const existing: UploadDocument[] = [{ name: 'Notes.md', size: 10, content: 'Notes', type: 'text' }]
    const result = await collectUploadDocuments([
      file('NOTES.md'), file('notes.pdf'), file('../unsafe.md'), file('con.txt'),
      file('image.png'), file('empty.txt', 0), file('report.md'), file('other.txt'),
    ], existing, readText)
    expect(result.documents.map(document => document.name)).toEqual(['report.md', 'other.txt'])
    expect(result.errors).toHaveLength(6)
    expect(result.errors.join(' ')).toContain('already selected')
    expect(result.errors.join(' ')).toContain('normalization')
  })

  test('bounds per-file size, total size and batch count before reading', async () => {
    const result = await collectUploadDocuments([
      file('too-large.md', MAX_DOCUMENT_BYTES + 1), file('one.md', 9 * 1024 * 1024),
      file('two.md', 9 * 1024 * 1024), file('three.md', 9 * 1024 * 1024),
    ], [], readText)
    expect(result.documents.map(document => document.name)).toEqual(['one.md', 'two.md'])
    expect(result.errors).toHaveLength(2)
    expect(result.documents.reduce((size, document) => size + document.size, 0)).toBeLessThanOrEqual(MAX_UPLOAD_BYTES)
    const countResult = await collectUploadDocuments(Array.from({ length: 21 }, (_, index) => file(`doc-${index}.txt`)), [], readText)
    expect(countResult.documents).toHaveLength(20)
    expect(countResult.errors[0]).toContain('at most 20')
  })

  test('a browser read failure settles the batch and preserves successful files in selection order', async () => {
    const result = await collectUploadDocuments([file('first.md'), file('broken.md'), file('last.md')], [], async document => {
      if (document.name === 'broken.md') throw new Error('File access denied. Select it again.')
      if (document.name === 'first.md') await new Promise(resolve => setTimeout(resolve, 5))
      return document.name
    })
    expect(result.documents.map(document => document.name)).toEqual(['first.md', 'last.md'])
    expect(result.errors).toEqual(['broken.md: File access denied. Select it again.'])
  })

  test('rejects whitespace, binary text and disguised PDFs but accepts uppercase PDF names', async () => {
    const content: Record<string, string> = {
      'blank.txt': ' \n\t', 'binary.txt': 'data\u0000', 'fake.pdf': 'data:application/pdf;base64,aGVsbG8=',
      'valid.PDF': 'data:application/pdf;base64,JVBERi0xLjQ=',
    }
    const result = await collectUploadDocuments(Object.keys(content).map(name => file(name)), [], async document => content[document.name])
    expect(result.documents.map(document => document.name)).toEqual(['valid.PDF'])
    expect(result.errors).toHaveLength(3)
  })

  test('FileReader errors and aborts reject instead of leaving an unfinished upload', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'FileReader')
    class FailingReader {
      onerror?: () => void
      onabort?: () => void
      readAsText() { queueMicrotask(() => this.onerror?.()) }
      readAsDataURL() { queueMicrotask(() => this.onabort?.()) }
    }
    Object.defineProperty(globalThis, 'FileReader', { value: FailingReader, configurable: true })
    try {
      await expect(readUploadDocument(file('notes.md'), 'text')).rejects.toThrow('could not read')
      await expect(readUploadDocument(file('notes.pdf'), 'pdf')).rejects.toThrow('interrupted')
    } finally {
      if (original) Object.defineProperty(globalThis, 'FileReader', original)
      else Reflect.deleteProperty(globalThis, 'FileReader')
    }
  })
})

describe('resumable ingestion jobs', () => {
  test('ignores corrupt records and stores only job identity and destination metadata', () => {
    expect(parseIngestionJob('{bad json')).toBeNull()
    expect(parseIngestionJob(JSON.stringify({ ...job, processId: '../invalid' }))).toBeNull()
    expect(parseIngestionJob(JSON.stringify(job))).toEqual(job)
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    let stored = ''
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      setItem: (_: string, value: string) => { stored = value },
      removeItem: () => { stored = '' },
    } })
    try {
      expect(saveIngestionJob({ ...job, apiKey: 'test-key', content: 'test-content' } as IngestionJob)).toBe(true)
      expect(Object.keys(JSON.parse(stored)).sort()).toEqual(['collection', 'directory', 'fileNames', 'processId', 'startedAt'])
      clearIngestionJob()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  test('serial polling recovers from a transient connection failure and stops on completion', async () => {
    let active = 0
    let maximumActive = 0
    let calls = 0
    let retryCount = 0
    let stop = () => {}
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => { stop(); reject(new Error('Polling did not complete')) }, 1000)
      stop = watchIngestionJob(job, {
        onUpdate: status => {
          if (status.status === 'success') { clearTimeout(deadline); resolve() }
        },
        onRetry: () => { retryCount += 1 },
        onUnavailable: message => reject(new Error(message)),
      }, {
        pollIntervalMs: 1, retryIntervalMs: 1,
        fetchStatus: async () => {
          calls += 1
          active += 1
          maximumActive = Math.max(maximumActive, active)
          await new Promise(resolveRequest => setTimeout(resolveRequest, 10))
          active -= 1
          if (calls === 1) throw new Error('Connection interrupted')
          return { status: calls === 2 ? 'running' : 'success', logs: 'output' }
        },
      })
    })
    stop()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(maximumActive).toBe(1)
    expect(calls).toBe(3)
    expect(retryCount).toBe(1)
  })

  test('allows a newly submitted job to appear, but explains a missing older job', async () => {
    const observe = (startedAt: number, statuses: Array<IngestionStatus | Error>) => new Promise<string>(resolve => {
      let stop = () => {}
      stop = watchIngestionJob({ ...job, startedAt }, {
        onUpdate: result => { if (result.status === 'success') { stop(); resolve('success') } },
        onRetry: () => {}, onUnavailable: message => { stop(); resolve(message) },
      }, { retryIntervalMs: 1, fetchStatus: async () => {
        const result = statuses.shift()!
        if (result instanceof Error) throw result
        return result
      } })
    })
    expect(await observe(Date.now(), [new IngestionApiError('Process not found', 404), { status: 'success', logs: '' }])).toBe('success')
    expect(await observe(Date.now() - 60000, [new IngestionApiError('Process not found', 404)])).toContain('API server restarted')
  })

  test('stopping polling aborts the pending request and suppresses late updates', async () => {
    let aborted = false
    let updates = 0
    const stop = watchIngestionJob(job, {
      onUpdate: () => { updates += 1 }, onRetry: () => { updates += 1 }, onUnavailable: () => { updates += 1 },
    }, { fetchStatus: async (_id, signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')) })
    }) })
    stop()
    await new Promise(resolve => setTimeout(resolve, 1))
    expect(aborted).toBe(true)
    expect(updates).toBe(0)
  })
})
