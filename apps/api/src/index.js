import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory process storage
const activeProcesses = new Map();

// Helper to write JSON response
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  });
  res.end(jsonSafeStringify(data));
}

function jsonSafeStringify(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

// Handler for CORS preflight
function handleOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end();
}

const server = http.createServer((req, res) => {
  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Endpoint: GET /api/status?id=<processId>
  if (req.method === 'GET' && pathname === '/api/status') {
    const processId = parsedUrl.searchParams.get('id');
    if (!processId || !activeProcesses.has(processId)) {
      sendJSON(res, 404, { error: 'Process not found' });
      return;
    }
    const procInfo = activeProcesses.get(processId);
    sendJSON(res, 200, {
      status: procInfo.status,
      logs: procInfo.logs,
      exitCode: procInfo.exitCode
    });
    return;
  }

  // Endpoint: POST /api/ingest
  if (req.method === 'POST' && pathname === '/api/ingest') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { collection, directory = 'Research', provider, apiKey, files } = data;

        if (!collection || !files || !Array.isArray(files) || files.length === 0) {
          sendJSON(res, 400, { error: 'Missing required fields: collection, files' });
          return;
        }

        const processId = Date.now().toString();
        const uploadDir = path.join(__dirname, '..', '..', 'ingestion-pipeline', 'data', 'temp_upload', processId);
        fs.mkdirSync(uploadDir, { recursive: true });

        // Save uploaded files to the temp upload directory
        for (const file of files) {
          const safeName = path.basename(file.name);
          const filepath = path.join(uploadDir, safeName);
          if (typeof file.content === 'string' && file.content.startsWith('data:') && file.content.includes(';base64,')) {
            const base64Data = file.content.split(';base64,')[1];
            fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
          } else {
            fs.writeFileSync(filepath, file.content, 'utf-8');
          }
        }

        // Setup process execution environment
        const env = { ...process.env };
        if (apiKey && provider) {
          if (provider === 'gemini') env.GEMINI_API_KEY = apiKey;
          else if (provider === 'openai') env.OPENAI_API_KEY = apiKey;
          else if (provider === 'anthropic') env.ANTHROPIC_API_KEY = apiKey;
        }

        // Spawn python pipeline script
        const pythonProcess = spawn(
          'uv',
          [
            'run',
            'python',
            'bulk_ingest.py',
            '--folder',
            `data/temp_upload/${processId}`,
            '--collection',
            collection,
            '--directory',
            directory
          ],
          {
            cwd: path.join(__dirname, '..', '..', 'ingestion-pipeline'),
            env
          }
        );

        const procInfo = {
          status: 'running',
          logs: `[API] Spawning ingestion process ${processId}...\n`,
          exitCode: null
        };
        activeProcesses.set(processId, procInfo);

        pythonProcess.stdout.on('data', (data) => {
          procInfo.logs += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          procInfo.logs += `[STDERR] ${data.toString()}`;
        });

        pythonProcess.on('close', (code) => {
          procInfo.exitCode = code;
          procInfo.status = code === 0 ? 'success' : 'failed';
          procInfo.logs += `\n[API] Ingestion process finished with exit code ${code}.\n`;
          
          // Cleanup temp uploaded files
          try {
            fs.rmSync(uploadDir, { recursive: true, force: true });
          } catch (err) {
            console.error(`Failed to clean up upload dir ${uploadDir}:`, err);
          }
        });

        sendJSON(res, 202, { processId, status: 'running' });
      } catch (err) {
        sendJSON(res, 400, { error: 'Invalid JSON payload: ' + err.message });
      }
    });
    return;
  }

  // Catch-all
  sendJSON(res, 404, { error: 'Route not found' });
});

const PORT = 5176;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[API] Nitanics lightweight backend API server is running at http://127.0.0.1:${PORT}`);
});
