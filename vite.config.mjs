import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { tutorialHighlighting } from './scripts/tutorial-highlighting.mjs'
import { siteNavigation } from './scripts/site-navigation.mjs'
import { docsPage } from './scripts/docs-page.mjs'
import { gleamProject } from './scripts/gleam-source.mjs'

const local = path => fileURLToPath(new URL(path, import.meta.url))
const projectRoot = local('./')

export default defineConfig({
  root: local('./site'),
  cacheDir: local('./node_modules/.vite'),
  plugins: [
    siteNavigation(),
    docsPage(),
    gleamProject(projectRoot),
    tailwindcss(),
    tutorialHighlighting(),
  ],
  build: {
    outDir: local('./dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: local('./site/index.html'),
        demos: local('./site/demos/index.html'),
        counter: local('./site/demos/counter/index.html'),
        todos: local('./site/demos/todos/index.html'),
        recipes: local('./site/recipes/index.html'),
        docs: local('./site/docs/index.html'),
        tutorial: local('./site/tutorial/index.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 3000, strictPort: true, fs: { allow: [projectRoot] } },
})
