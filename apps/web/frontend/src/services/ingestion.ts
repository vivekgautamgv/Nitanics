export interface UploadDocument {
  name: string
  content: string
  size: number
  type: 'pdf' | 'text'
}

export interface IngestionJob {
  processId: string
  collection: string
  directory: string
  fileNames: string[]
  startedAt: number
}

export interface IngestionStatus {
  status: 'running' | 'success' | 'failed'
  logs: string
  error?: string
}

export const INGESTION_API_URL = 'http://127.0.0.1:5176'
export const INGESTION_JOB_KEY = 'nitanics_ingestion_job'
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_DOCUMENTS = 20

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let rememberedJob: IngestionJob | null = null

export function parseIngestionJob(value: string | null): IngestionJob | null {
  if (!value) return null
  try {
    const job = JSON.parse(value)
    if (!job || !UUID_PATTERN.test(job.processId) || typeof job.collection !== 'string' || !job.collection.trim()
      || typeof job.directory !== 'string' || !Array.isArray(job.fileNames)
      || !job.fileNames.every((name: unknown) => typeof name === 'string')
      || !Number.isFinite(job.startedAt)) return null
    return {
      processId: job.processId,
      collection: job.collection,
      directory: job.directory,
      fileNames: job.fileNames,
      startedAt: job.startedAt,
    }
  } catch {
    return null
  }
}

export function loadIngestionJob(): IngestionJob | null {
  try {
    return parseIngestionJob(localStorage.getItem(INGESTION_JOB_KEY)) || rememberedJob
  } catch {
    return rememberedJob
  }
}

// Keep document contents and credentials out of the resumable job record.
export function saveIngestionJob(job: IngestionJob): boolean {
  rememberedJob = job
  try {
    localStorage.setItem(INGESTION_JOB_KEY, JSON.stringify({
      processId: job.processId, collection: job.collection, directory: job.directory,
      fileNames: job.fileNames, startedAt: job.startedAt,
    }))
    return true
  } catch {
    return false
  }
}

export function clearIngestionJob(): void {
  rememberedJob = null
  try { localStorage.removeItem(INGESTION_JOB_KEY) } catch { /* Browser storage may be disabled. */ }
}

function documentSlug(name: string): string {
  return name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function readUploadDocument(file: File, type: UploadDocument['type']): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('The browser could not read this document.'))
    reader.onerror = () => reject(new Error('The browser could not read this document. Select it again.'))
    reader.onabort = () => reject(new Error('Reading was interrupted. Select this document again.'))
    if (type === 'pdf') reader.readAsDataURL(file)
    else reader.readAsText(file)
  })
}

export async function collectUploadDocuments(
  incoming: File[], existing: UploadDocument[],
  read: typeof readUploadDocument = readUploadDocument,
): Promise<{ documents: UploadDocument[]; errors: string[] }> {
  const errors: string[] = []
  const candidates: Array<{ file: File; type: UploadDocument['type'] }> = []
  const names = new Set(existing.map(file => file.name.toLowerCase()))
  const slugs = new Set(existing.map(file => documentSlug(file.name)))
  let totalBytes = existing.reduce((sum, file) => sum + file.size, 0)

  for (const file of incoming) {
    const extension = /\.(md|txt|pdf)$/i.exec(file.name)?.[1].toLowerCase()
    const slug = documentSlug(file.name)
    let reason = ''
    if (!extension) reason = 'Use a Markdown (.md), text (.txt), or PDF (.pdf) document.'
    else if (/[<>:"/\\|?*\u0000-\u001f]/.test(file.name) || file.name.includes('..')
      || /[. ]$/.test(file.name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(file.name) || !slug) {
      reason = 'Rename this document using letters, numbers, spaces, or hyphens.'
    } else if (file.size === 0) reason = 'This document is empty.'
    else if (file.size > MAX_DOCUMENT_BYTES) reason = 'Each document must be 10 MB or smaller.'
    else if (names.has(file.name.toLowerCase())) reason = 'A document with this name is already selected.'
    else if (slugs.has(slug)) reason = 'This name matches another document after normalization. Rename it before uploading.'
    else if (existing.length + candidates.length >= MAX_DOCUMENTS) reason = 'Select at most 20 documents per extraction.'
    else if (totalBytes + file.size > MAX_UPLOAD_BYTES) reason = 'The selected documents must total 25 MB or less.'
    if (reason) {
      errors.push(`${file.name}: ${reason}`)
      continue
    }
    names.add(file.name.toLowerCase())
    slugs.add(slug)
    totalBytes += file.size
    candidates.push({ file, type: extension === 'pdf' ? 'pdf' : 'text' })
  }

  const results = await Promise.allSettled(candidates.map(async ({ file, type }) => {
    const content = await read(file, type)
    if (type === 'text' && (!content.trim() || content.includes('\u0000'))) {
      throw new Error('This document has no readable text. Select a non-empty text document.')
    }
    if (type === 'pdf' && !content.split(';base64,')[1]?.startsWith('JVBERi0')) {
      throw new Error('This file is not a readable PDF. Export it as PDF and select it again.')
    }
    return { name: file.name, content, size: file.size, type }
  }))
  const documents: UploadDocument[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') documents.push(result.value)
    else errors.push(`${candidates[index].file.name}: ${result.reason instanceof Error ? result.reason.message : 'Unable to read document.'}`)
  })
  return { documents, errors }
}

export class IngestionApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
  }
}

export async function fetchIngestionStatus(processId: string, signal: AbortSignal): Promise<IngestionStatus> {
  const response = await fetch(`${INGESTION_API_URL}/api/status?id=${encodeURIComponent(processId)}`, { signal })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new IngestionApiError(data?.error || `The ingestion service returned ${response.status}.`, response.status)
  }
  if (!data || !['running', 'success', 'failed'].includes(data.status)) {
    throw new IngestionApiError('The ingestion service returned an unreadable status.', 502)
  }
  return {
    status: data.status, logs: typeof data.logs === 'string' ? data.logs : '',
    error: typeof data.error === 'string' ? data.error : undefined,
  }
}

// Schedule the next request only after the previous one finishes. A lost connection
// does not mean the extraction failed, so keep checking the same job with backoff.
export function watchIngestionJob(job: IngestionJob, callbacks: {
  onUpdate: (data: IngestionStatus) => void
  onRetry: (message: string) => void
  onUnavailable: (message: string) => void
}, options: {
  fetchStatus?: typeof fetchIngestionStatus
  pollIntervalMs?: number
  retryIntervalMs?: number
  requestTimeoutMs?: number
  missingJobGraceMs?: number
} = {}): () => void {
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let failures = 0
  const query = options.fetchStatus || fetchIngestionStatus

  const poll = async () => {
    if (disposed) return
    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort(), options.requestTimeoutMs ?? 10000)
    let nextDelay = options.pollIntervalMs ?? 1200
    try {
      const data = await query(job.processId, controller.signal)
      if (disposed) return
      failures = 0
      callbacks.onUpdate(data)
      if (data.status !== 'running') return
    } catch (error) {
      if (disposed) return
      const code = error instanceof IngestionApiError ? error.statusCode : 0
      const recentlySubmitted = Date.now() - job.startedAt < (options.missingJobGraceMs ?? 30000)
      if (code >= 400 && code < 500 && ![408, 429].includes(code) && !(code === 404 && recentlySubmitted)) {
        callbacks.onUnavailable(code === 404
          ? 'This job is unavailable. The request may not have reached the service, or the API server restarted. Check the collection and the pipeline output before starting again.'
          : `Unable to check extraction progress: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      failures += 1
      nextDelay = Math.min((options.retryIntervalMs ?? 1500) * 2 ** Math.min(failures - 1, 3), 12000)
      callbacks.onRetry(`Connection interrupted. Checking this job again in ${Math.ceil(nextDelay / 1000)} seconds. Extraction may still be running.`)
    } finally {
      clearTimeout(timeout)
    }
    if (!disposed) timer = setTimeout(poll, nextDelay)
  }
  void poll()
  return () => {
    disposed = true
    clearTimeout(timer)
    controller?.abort()
  }
}
