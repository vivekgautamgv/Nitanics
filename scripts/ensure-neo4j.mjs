import Docker from 'dockerode'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { access, mkdir, writeFile } from 'node:fs/promises'
import net from 'node:net'
import readline from 'node:readline/promises'
import { stdin, stdout, stderr, exit } from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const cfg = {
  image: process.env.MT_NEO4J_IMAGE || 'neo4j:5.26.0-community',
  container: process.env.MT_NEO4J_CONTAINER || 'memorytonic-neo4j',
  boltHost: process.env.MT_NEO4J_HOST || '127.0.0.1',
  boltPort: Number(process.env.MT_NEO4J_BOLT_PORT || 7687),
  httpPort: Number(process.env.MT_NEO4J_HTTP_PORT || 7474),
  user: process.env.MT_NEO4J_USER || 'neo4j',
  password: process.env.MT_NEO4J_PASSWORD || '12345678',
  database: process.env.MT_NEO4J_DATABASE || 'memorytonic',
}

const paths = {
  ingestionEnv: resolve(repoRoot, 'apps/ingestion-pipeline/neo4j/.env'),
  graphStudioEnv: resolve(repoRoot, 'apps/web/modules/graph-studio/.env'),
  frontendEnv: resolve(repoRoot, 'apps/web/frontend/.env'),
  mcpEnv: resolve(repoRoot, 'apps/mcp/.env'),
  apiEnv: resolve(repoRoot, 'apps/api/.env'),
  bootstrapScript: resolve(repoRoot, 'apps/ingestion-pipeline/neo4j/bootstrap.py'),
  bootstrapCwd: resolve(repoRoot, 'apps/ingestion-pipeline'),
}

function log(msg) {
  stdout.write(`${msg}\n`)
}

function warn(msg) {
  stderr.write(`${msg}\n`)
}

function hasTty() {
  return Boolean(stdin.isTTY && stdout.isTTY)
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function writeEnvFile(path, content, overwrite = false) {
  const exists = await fileExists(path)
  if (exists && !overwrite) return false
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
  return true
}

async function ensureEnvFiles() {
  const ingestion = [
    `NEO4J_HTTP=http://${cfg.boltHost}:${cfg.httpPort}`,
    `NEO4J_USER=${cfg.user}`,
    `NEO4J_PASSWORD=${cfg.password}`,
    `NEO4J_DATABASE=${cfg.database}`,
    '',
  ].join('\n')

  const vite = [
    `VITE_NEO4J_URI=bolt://${cfg.boltHost}:${cfg.boltPort}`,
    `VITE_NEO4J_USER=${cfg.user}`,
    `VITE_NEO4J_PASSWORD=${cfg.password}`,
    `VITE_NEO4J_DATABASE=${cfg.database}`,
    '',
  ].join('\n')

  const mcp = [
    `NEO4J_URI=neo4j://${cfg.boltHost}:${cfg.boltPort}`,
    `NEO4J_USER=${cfg.user}`,
    `NEO4J_PASSWORD=${cfg.password}`,
    `NEO4J_DATABASE=${cfg.database}`,
    '',
  ].join('\n')

  await writeEnvFile(paths.ingestionEnv, ingestion, false)
  await writeEnvFile(paths.graphStudioEnv, vite, false)
  await writeEnvFile(paths.frontendEnv, vite, false)
  await writeEnvFile(paths.mcpEnv, mcp, false)
  await writeEnvFile(paths.apiEnv, mcp, false)
}

async function waitForTcp(host, port, retries = 40, delayMs = 1500) {
  for (let i = 0; i < retries; i += 1) {
    const ok = await new Promise((resolveWait) => {
      const socket = net.createConnection({ host, port })
      let done = false
      const finish = (val) => {
        if (done) return
        done = true
        socket.destroy()
        resolveWait(val)
      }
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
      socket.setTimeout(1200, () => finish(false))
    })
    if (ok) return true
    await new Promise(r => setTimeout(r, delayMs))
  }
  return false
}

async function dockerPing(docker) {
  try {
    await docker.ping()
    return true
  } catch {
    return false
  }
}

function followPullStream(docker, stream) {
  return new Promise((resolvePull, rejectPull) => {
    docker.modem.followProgress(stream, (err, output) => {
      if (err) rejectPull(err)
      else resolvePull(output)
    })
  })
}

async function ensureImage(docker) {
  try {
    await docker.getImage(cfg.image).inspect()
    log(`[neo4j] Docker image present: ${cfg.image}`)
    return
  } catch {
    log(`[neo4j] Pulling Docker image: ${cfg.image}`)
  }

  const stream = await docker.pull(cfg.image)
  await followPullStream(docker, stream)
  log('[neo4j] Image pull complete')
}

function neo4jContainerConfig() {
  return {
    Image: cfg.image,
    name: cfg.container,
    Env: [
      `NEO4J_AUTH=${cfg.user}/${cfg.password}`,
      `NEO4J_dbms_default__database=${cfg.database}`,
      `NEO4J_initial_dbms_default__database=${cfg.database}`,
      'NEO4J_PLUGINS=["apoc","graph-data-science"]',
      'NEO4J_ACCEPT_LICENSE_AGREEMENT=yes',
    ],
    ExposedPorts: {
      '7474/tcp': {},
      '7687/tcp': {},
    },
    HostConfig: {
      PortBindings: {
        '7474/tcp': [{ HostPort: String(cfg.httpPort) }],
        '7687/tcp': [{ HostPort: String(cfg.boltPort) }],
      },
      RestartPolicy: {
        Name: 'unless-stopped',
      },
      Mounts: [
        { Type: 'volume', Source: `${cfg.container}-data`, Target: '/data' },
        { Type: 'volume', Source: `${cfg.container}-logs`, Target: '/logs' },
        { Type: 'volume', Source: `${cfg.container}-plugins`, Target: '/plugins' },
      ],
    },
  }
}

async function ensureContainer(docker) {
  const container = docker.getContainer(cfg.container)
  let inspect
  try {
    inspect = await container.inspect()
  } catch {
    inspect = null
  }

  if (!inspect) {
    log(`[neo4j] Creating container: ${cfg.container}`)
    const created = await docker.createContainer(neo4jContainerConfig())
    await created.start()
    return created
  }

  if (!inspect.State.Running) {
    log(`[neo4j] Starting existing container: ${cfg.container}`)
    await container.start()
  } else {
    log(`[neo4j] Container already running: ${cfg.container}`)
  }
  return container
}

function authHeaders() {
  const token = Buffer.from(`${cfg.user}:${cfg.password}`, 'utf8').toString('base64')
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
  }
}

async function runCypher(database, statement, parameters = {}) {
  const url = `http://${cfg.boltHost}:${cfg.httpPort}/db/${database}/tx/commit`
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      statements: [{ statement, parameters }],
    }),
  })
  const body = await response.json()
  if (!response.ok || body.errors?.length) {
    const errorText = body.errors?.[0]?.message || response.statusText
    throw new Error(errorText)
  }
  return body
}

async function ensureDatabase() {
  if (!/^[A-Za-z0-9_-]+$/.test(cfg.database)) {
    throw new Error(`invalid database name: ${cfg.database}`)
  }

  const statusQuery = `SHOW DATABASES YIELD name, currentStatus WHERE name = '${cfg.database}' RETURN currentStatus`

  for (let i = 0; i < 40; i += 1) {
    try {
      const statusResult = await runCypher('system', statusQuery)
      const row = statusResult.results?.[0]?.data?.[0]?.row
      const status = String(row?.[0] || '').toLowerCase()
      if (status === 'online') return
    } catch {
      // keep retrying while DB is warming up
    }
    await new Promise(r => setTimeout(r, 1500))
  }

  try {
    await runCypher('system', `CREATE DATABASE ${cfg.database} IF NOT EXISTS`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('unsupported administration command')) {
      throw new Error(
        `database '${cfg.database}' is missing and cannot be auto-created in this Neo4j mode. ` +
        `Recreate Docker container with default database '${cfg.database}', or use local/remote mode.`,
      )
    }
    throw err
  }

  for (let i = 0; i < 30; i += 1) {
    const statusResult = await runCypher('system', statusQuery)
    const row = statusResult.results?.[0]?.data?.[0]?.row
    const status = String(row?.[0] || '').toLowerCase()
    if (status === 'online') return
    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error(`database ${cfg.database} did not become online`)
}

async function tryBootstrap() {
  if (process.env.MT_SKIP_BOOTSTRAP === '1') {
    log('[neo4j] bootstrap skipped (MT_SKIP_BOOTSTRAP=1)')
    return
  }
  if (!(await fileExists(paths.bootstrapScript))) {
    warn('[neo4j] bootstrap script not found, skipping')
    return
  }

  log('[neo4j] Running schema bootstrap (idempotent)')
  await new Promise((resolveRun, rejectRun) => {
    const proc = spawn('python', ['neo4j/bootstrap.py'], {
      cwd: paths.bootstrapCwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    proc.once('error', rejectRun)
    proc.once('exit', (code) => {
      if (code === 0) resolveRun()
      else rejectRun(new Error(`bootstrap failed with exit code ${code}`))
    })
  })
}

async function askFallbackMode() {
  if (!hasTty()) return 'abort'
  const rl = readline.createInterface({ input: stdin, output: stdout })
  try {
    log('')
    log('[neo4j] Docker is not reachable.')
    log('[neo4j] Choose Neo4j mode:')
    log('  1) Local Neo4j Desktop / service (localhost)')
    log('  2) Remote Neo4j server')
    log('  3) Abort startup')
    const answer = (await rl.question('Select 1/2/3: ')).trim()
    if (answer === '1') return 'local'
    if (answer === '2') return 'remote'
    return 'abort'
  } finally {
    rl.close()
  }
}

async function configureRemoteEnvViaPrompt() {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  try {
    const uri = (await rl.question(`Bolt URI [bolt://${cfg.boltHost}:${cfg.boltPort}]: `)).trim()
      || `bolt://${cfg.boltHost}:${cfg.boltPort}`
    const user = (await rl.question(`Username [${cfg.user}]: `)).trim() || cfg.user
    const password = (await rl.question('Password: ')).trim() || cfg.password
    const database = (await rl.question(`Database [${cfg.database}]: `)).trim() || cfg.database

    const host = uri
      .replace('bolt://', '')
      .replace('neo4j://', '')
      .split(':')[0]
      .replace(/\//g, '')
    const port = Number(uri.split(':').pop()) || cfg.boltPort

    const ingestion = [
      `NEO4J_HTTP=http://${host}:7474`,
      `NEO4J_USER=${user}`,
      `NEO4J_PASSWORD=${password}`,
      `NEO4J_DATABASE=${database}`,
      '',
    ].join('\n')
    const vite = [
      `VITE_NEO4J_URI=${uri}`,
      `VITE_NEO4J_USER=${user}`,
      `VITE_NEO4J_PASSWORD=${password}`,
      `VITE_NEO4J_DATABASE=${database}`,
      '',
    ].join('\n')
    const mcp = [
      `NEO4J_URI=${uri.replace('bolt://', 'neo4j://')}`,
      `NEO4J_USER=${user}`,
      `NEO4J_PASSWORD=${password}`,
      `NEO4J_DATABASE=${database}`,
      '',
    ].join('\n')

    await writeEnvFile(paths.ingestionEnv, ingestion, true)
    await writeEnvFile(paths.graphStudioEnv, vite, true)
    await writeEnvFile(paths.frontendEnv, vite, true)
    await writeEnvFile(paths.mcpEnv, mcp, true)
    await writeEnvFile(paths.apiEnv, mcp, true)

    log('[neo4j] Remote configuration written to .env files')
    log('[neo4j] Continuing with remote Neo4j mode')
  } finally {
    rl.close()
  }
}

function printLocalInstructions() {
  log('[neo4j] Local mode selected.')
  log('[neo4j] Ensure your Neo4j server is running with:')
  log(`  - bolt://${cfg.boltHost}:${cfg.boltPort}`)
  log(`  - http://${cfg.boltHost}:${cfg.httpPort}`)
  log(`  - user: ${cfg.user}`)
  log(`  - database: ${cfg.database}`)
}

async function ensureDockerNeo4j() {
  const docker = new Docker()
  const available = await dockerPing(docker)
  if (!available) return false

  log('[neo4j] Docker available (via Dockerode)')
  await ensureImage(docker)
  await ensureContainer(docker)

  const boltReady = await waitForTcp(cfg.boltHost, cfg.boltPort)
  if (!boltReady) throw new Error(`bolt port not reachable on ${cfg.boltHost}:${cfg.boltPort}`)
  const httpReady = await waitForTcp(cfg.boltHost, cfg.httpPort)
  if (!httpReady) throw new Error(`http port not reachable on ${cfg.boltHost}:${cfg.httpPort}`)

  await ensureDatabase()
  await tryBootstrap()
  log('[neo4j] Docker Neo4j is ready')
  return true
}

async function main() {
  log('[neo4j] startup check begin')
  await ensureEnvFiles()

  try {
    const dockerReady = await ensureDockerNeo4j()
    if (dockerReady) return
  } catch (err) {
    warn(`[neo4j] Docker startup failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const mode = await askFallbackMode()
  if (mode === 'local') {
    printLocalInstructions()
    return
  }
  if (mode === 'remote') {
    await configureRemoteEnvViaPrompt()
    return
  }

  warn('[neo4j] Startup aborted. Use Docker, local Neo4j, or remote Neo4j, then run again.')
  exit(1)
}

main().catch((err) => {
  warn(`[neo4j] fatal: ${err instanceof Error ? err.message : String(err)}`)
  exit(1)
})
