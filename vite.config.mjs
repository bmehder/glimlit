import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { gleamImportPlugin } from '@chouquette/gleam-vite-loader'

const local = path => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    gleamImportPlugin(),
    tailwindcss(),
    {
      name: 'demo-view-source',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source !== './view.mjs' || !importer) return
        for (const demo of ['counter', 'todos']) {
          if (importer.startsWith(local(`./build/dev/javascript/glimlit/${demo}/`))) {
            return local(`./src/${demo}/view.mjs`)
          }
        }
      },
    },
  ],
  // Serve view source directly; resolve its Gleam imports to generated modules.
  resolve: {
    alias: {
      './runner.mjs': local('./src/runtime/runner.mjs'),
      './effects.mjs': local('./src/todos/effects.mjs'),
      './todos.mjs': local('./build/dev/javascript/glimlit/todos/todos.mjs'),
      './counter.mjs': local('./build/dev/javascript/glimlit/counter/counter.mjs'),
      './browser.mjs': local('./src/runtime/browser.mjs'),
    },
  },
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
})
