import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { gleamImportPlugin } from '@chouquette/gleam-vite-loader'
import { tutorialHighlighting } from './scripts/tutorial-highlighting.mjs'
import { siteNavigation } from './scripts/site-navigation.mjs'
import { docsPage } from './scripts/docs-page.mjs'
import { gleamSource } from './scripts/gleam-source.mjs'

const local = path => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    siteNavigation(),
    docsPage(),
    gleamImportPlugin(),
    tailwindcss(),
    tutorialHighlighting(),
    gleamSource(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: local('./index.html'),
        demos: local('./demos/index.html'),
        counter: local('./demos/counter/index.html'),
        todos: local('./demos/todos/index.html'),
        recipes: local('./recipes/index.html'),
        docs: local('./docs/index.html'),
        tutorial: local('./tutorial/index.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
})
