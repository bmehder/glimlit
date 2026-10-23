import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHighlighter } from 'shiki'

const virtualId = 'virtual:tutorial-highlighting'
const resolvedId = `\0${virtualId}`
const examplesPath = fileURLToPath(new URL('../src/tutorial/examples.json', import.meta.url))
const checkpointsPath = fileURLToPath(new URL('../docs/tutorial/', import.meta.url))

export function tutorialHighlighting() {
  let highlighter
  return {
    name: 'tutorial-highlighting',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    async load(id) {
      if (id !== resolvedId) return
      highlighter ??= createHighlighter({
        themes: ['github-dark'],
        langs: ['gleam', 'javascript', 'html', 'shellscript'],
      })
      const engine = await highlighter
      this.addWatchFile(examplesPath)
      const examples = JSON.parse(await readFile(examplesPath, 'utf8'))
      const sources = Object.values(examples)
      const folders = (await readdir(checkpointsPath)).filter(folder => /^\d\d-/.test(folder)).sort()
      for (const folder of folders) {
        sources.push({ language: 'shellscript', source: `cp docs/tutorial/${folder}/* src/tutorial/` })
        const directory = new URL(`../docs/tutorial/${folder}/`, import.meta.url)
        for (const filename of (await readdir(directory)).sort()) {
          if (!/\.(gleam|mjs)$/.test(filename)) continue
          const path = fileURLToPath(new URL(filename, directory))
          this.addWatchFile(path)
          sources.push({
            language: filename.endsWith('.gleam') ? 'gleam' : 'javascript',
            source: await readFile(path, 'utf8'),
          })
        }
      }
      const highlighted = Object.fromEntries(sources.map(({ source, language }) => {
        const text = source.trim()
        const { tokens } = engine.codeToTokens(text, { lang: language, theme: 'github-dark' })
        return [text, {
          language,
          lines: tokens.map(line => line.map(({ content, color }) => ({ content, color }))),
        }]
      }))
      return `export default ${JSON.stringify(highlighted)}`
    },
    handleHotUpdate(context) {
      if (context.file !== examplesPath && !context.file.startsWith(checkpointsPath)) return
      const module = context.server.moduleGraph.getModuleById(resolvedId)
      if (module) {
        context.server.moduleGraph.invalidateModule(module)
        return [...context.modules, module]
      }
    },
    async closeBundle() {
      if (highlighter) (await highlighter).dispose()
      highlighter = undefined
    },
  }
}
