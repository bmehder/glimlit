import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { gleamImportPlugin } from '@chouquette/gleam-vite-loader'

const local = path => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [gleamImportPlugin(), tailwindcss()],
  // Serve view source directly; resolve its Gleam imports to generated modules.
  resolve: {
    alias: {
      './runner.mjs': local('./src/runtime/runner.mjs'),
      './effects.mjs': local('./src/todos/effects.mjs'),
      './view.mjs': local('./src/todos/view.mjs'),
      './todos.mjs': local('./build/dev/javascript/mvu_lit/todos/todos.mjs'),
      './counter_view.mjs': local('./src/counter/counter_view.mjs'),
      './counter.mjs': local('./build/dev/javascript/mvu_lit/counter/counter.mjs'),
      './browser.mjs': local('./src/runtime/browser.mjs'),
    },
  },
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
})
