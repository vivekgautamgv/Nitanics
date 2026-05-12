import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReadStream, existsSync, statSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Vite plugin: serve Component 01 source HTML documents at /source-viewer/
 * Same pattern as Component 02's serveSourceDocs plugin.
 */
function serveSourceDocs(): Plugin {
  const ingestionDir = resolve(__dirname, '..', '..', '..', 'ingestion-pipeline')
  return {
    name: 'serve-source-docs',
    configureServer(server) {
      server.middlewares.use('/source-viewer', (req, res) => {
        const reqUrl = decodeURIComponent((req.url || '').split('?')[0])
        const filePath = resolve(ingestionDir, reqUrl.startsWith('/') ? reqUrl.slice(1) : reqUrl)

        if (!filePath.startsWith(ingestionDir)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }

        try {
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            const ext = filePath.split('.').pop()?.toLowerCase()
            const contentType = ext === 'html' ? 'text/html; charset=utf-8'
              : ext === 'json' ? 'application/json; charset=utf-8'
              : 'application/octet-stream'
            res.setHeader('Content-Type', contentType)
            createReadStream(filePath).pipe(res)
            return
          }
        } catch {
          // fall through to 404
        }
        res.statusCode = 404
        res.end('Source document not found')
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    serveSourceDocs(),
  ],
  server: {
    port: 5174,
    fs: {
      // Allow access to C02 files for Graph Studio embedding
      allow: [resolve(__dirname, '..')],
    },
  },
  resolve: {
    // Force single React instance — C02's components must use C03's React
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@graph': resolve(__dirname, '..', 'modules', 'graph-studio', 'src'),
      '@ingestion': resolve(__dirname, '..', '..', 'ingestion-pipeline'),
      '@shared': resolve(__dirname, '..', '..', '..', 'packages', 'shared'),
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
    },
  },
})
