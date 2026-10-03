import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceDocsMiddleware } from '../../source-docs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Vite plugin: serve Component 01 source HTML documents at /source-viewer/
 * htmlPath in Neo4j: "data/sources/YYYY-MM-DD/project_name/01_html.html"
 * Resolved to: ../01-ingestion/data/sources/YYYY-MM-DD/project_name/01_html.html
 */
function serveSourceDocs(): Plugin {
  const repoRoot = resolve(__dirname, '..', '..', '..', '..')
  return {
    name: 'serve-source-docs',
    configureServer(server) {
      server.middlewares.use('/source-viewer', sourceDocsMiddleware(repoRoot))
    },
    configurePreviewServer(server) {
      server.middlewares.use('/source-viewer', sourceDocsMiddleware(repoRoot))
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    serveSourceDocs(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@ingestion': resolve(__dirname, '..', '..', '..', 'ingestion-pipeline'),
      '@shared': resolve(__dirname, '..', '..', '..', '..', 'packages', 'shared'),
    },
  },
})
