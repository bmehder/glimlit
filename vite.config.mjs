import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { gleamImportPlugin } from '@chouquette/gleam-vite-loader'
import { tutorialHighlighting } from './scripts/tutorial-highlighting.mjs'
import { siteNavigation } from './scripts/site-navigation.mjs'
import { docsPage } from './scripts/docs-page.mjs'

const local = path => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    siteNavigation(),
    docsPage(),
    gleamImportPlugin(),
    tailwindcss(),
    tutorialHighlighting(),
    {
      name: 'demo-view-source',
      enforce: 'pre',
      resolveId(source, importer) {
        if (!['./view.mjs', './effects.mjs', './subscriptions.mjs'].includes(source) || !importer) return
        for (const demo of ['counter', 'todos', 'tutorial', 'site/code_tabs']) {
          if (importer.startsWith(local(`./build/dev/javascript/glimlit/${demo}/`))) {
            return local(`./src/${demo}/${source.slice(2)}`)
          }
        }
      },
    },
  ],
  // Serve view source directly; resolve its Gleam imports to generated modules.
  resolve: {
    alias: {
      './runner.mjs': local('./src/runtime/runner.mjs'),
      './todos.mjs': local('./build/dev/javascript/glimlit/todos/todos.mjs'),
      './counter.mjs': local('./build/dev/javascript/glimlit/counter/counter.mjs'),
      './code_tabs.mjs': local('./build/dev/javascript/glimlit/site/code_tabs/code_tabs.mjs'),
      './tutorial.mjs': local('./build/dev/javascript/glimlit/tutorial/tutorial.mjs'),
      './browser.mjs': local('./src/runtime/browser.mjs'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: local('./index.html'),
        demo: local('./demo/index.html'),
        docs: local('./docs/index.html'),
        tutorial: local('./tutorial/index.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
})
