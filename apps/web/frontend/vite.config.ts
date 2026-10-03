import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceDocsMiddleware } from '../source-docs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Vite plugin: serve Component 01 source HTML documents at /source-viewer/
 * Same pattern as Component 02's serveSourceDocs plugin.
 */
function serveSourceDocs(): Plugin {
  const repoRoot = resolve(__dirname, '..', '..', '..')
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
    dedupe: ['react', 'react-dom', 'neo4j-driver'],
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
