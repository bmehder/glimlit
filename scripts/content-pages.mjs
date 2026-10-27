import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'comment-parser'
import { createHighlighter } from 'shiki'

const root = new URL('../', import.meta.url)
const sourceFiles = ['src/runtime/runner.mjs', 'src/runtime/subscriptions.mjs']
const docsExamples = 'site/docs/examples.json'
const tutorialExamples = 'site/tutorial/examples.json'
const guideFile = 'site/tutorial/guide.html'
const checkpointRoot = new URL('site/tutorial/checkpoints/', root)
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

async function reference() {
  const entries = []
  for (const file of sourceFiles) {
    const source = await readFile(new URL(file, root), 'utf8')
    const lines = source.split('\n')
    for (const comment of parse(source, { spacing: 'preserve' })) {
      if (!comment.tags.some(tag => tag.tag === 'public')) continue
      const declaration = lines.slice(comment.source.at(-1).number + 1).find(line => line.trim())
      const name = declaration?.match(/^export (?:function|const) (\w+)/)?.[1]
      if (!name || !comment.description.trim()) throw new Error(`Public JSDoc must describe an export in ${file}`)
      const params = comment.tags.filter(tag => tag.tag === 'param')
      const returns = comment.tags.find(tag => tag.tag === 'returns')?.type ?? 'void'
      entries.push(`<article class="api-entry" id="api-${name}">
        <p class="api-module">${escape(file)}</p>
        <h3><code>${name}(${params.map(param => escape(param.name) + (param.optional ? '?' : '')).join(', ')})</code></h3>
        <p>${escape(comment.description)}</p>
        ${params.length ? `<div class="docs-table"><table><thead><tr><th>Parameter</th><th>Type</th></tr></thead><tbody>${params.map(param => `<tr><td><code>${escape(param.name)}</code>${param.optional ? ' (optional)' : ''}</td><td><code>${escape(param.type)}</code></td></tr>`).join('')}</tbody></table></div>` : ''}
        <p>Returns <code>${escape(returns)}</code>. <a href="https://github.com/bmehder/glimlit/blob/main/${file}" target="_blank" rel="noopener noreferrer">View source ↗<span class="sr-only"> (opens in a new tab)</span></a></p>
      </article>`)
    }
  }
  if (!entries.length) throw new Error('No public runtime JSDoc entries were found')
  return entries.join('\n')
}

// Docs and tutorial use the same build-time code highlighting. Only interactive
// controls and the Glimlit islands need browser JavaScript.
export function contentPages() {
  let highlighter

  return {
    name: 'static-content-pages',
    async buildStart() {
      for (const file of [...sourceFiles, docsExamples, tutorialExamples, guideFile]) {
        this.addWatchFile(fileURLToPath(new URL(file, root)))
      }
      this.addWatchFile(fileURLToPath(checkpointRoot))
      for (const folder of await readdir(checkpointRoot)) {
        if (!/^\d\d-/.test(folder)) continue
        const directory = new URL(`${folder}/`, checkpointRoot)
        this.addWatchFile(fileURLToPath(directory))
        for (const name of await readdir(directory)) {
          this.addWatchFile(fileURLToPath(new URL(name, directory)))
        }
      }
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        const isTutorial = context.path.startsWith('/tutorial/')
        if (!isTutorial && !context.path.startsWith('/docs/')) return
        highlighter ??= createHighlighter({ themes: ['github-dark'], langs: ['gleam', 'javascript', 'shellscript', 'html'] })
        const engine = await highlighter
        const examples = JSON.parse(await readFile(new URL(isTutorial ? tutorialExamples : docsExamples, root), 'utf8'))

        function code(source, language, label) {
          const { tokens } = engine.codeToTokens(source.trim(), { lang: language, theme: 'github-dark' })
          return `<pre${isTutorial ? '' : ' class="docs-code"'} data-language="${escape(language)}" tabindex="0" aria-label="${escape(label)} code example"><code>${tokens.map(line => line.map(token => `<span style="color:${escape(token.color)}">${escape(token.content)}</span>`).join('')).join('\n')}</code></pre>`
        }

        if (isTutorial) {
          let guide = await readFile(new URL(guideFile, root), 'utf8')
          const folders = [...guide.matchAll(/<!-- checkpoint:([\w-]+) -->/g)].map(match => match[1])
          for (const folder of folders) {
            const directory = new URL(`${folder}/`, checkpointRoot)
            const rank = name => name.endsWith('.gleam') ? 0 : name === 'view.mjs' ? 1 : 2
            const names = (await readdir(directory))
              .filter(name => /\.(gleam|mjs)$/.test(name))
              .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
            const files = await Promise.all(names.map(async name => {
              const source = await readFile(new URL(name, directory), 'utf8')
              const language = name.endsWith('.gleam') ? 'gleam' : 'javascript'
              return `<details class="source-details">
                <summary>src/postcard/${escape(name)}</summary>
                <div class="source-toolbar">
                  <span>${language === 'gleam' ? 'Gleam' : 'JavaScript'}</span>
                  <button type="button" data-copy-file hidden aria-label="Copy ${escape(folder)}/${escape(name)}">Copy file</button>
                  <a href="data:text/plain;charset=utf-8,${escape(encodeURIComponent(source))}" download="${escape(name)}">Download</a>
                </div>
                ${code(source, language, `${folder}/${name}`)}
              </details>`
            }))
            const checkpoint = `<h3>Complete checkpoint</h3>
              <p>Replace the files below in <code>src/postcard/</code> with these complete versions. You can also copy this checkpoint from your checkout:</p>
              ${code(`cp site/tutorial/checkpoints/${folder}/* src/postcard/`, 'shellscript', `${folder} copy command`)}
              ${files.join('\n')}`
            guide = guide.replace(`<!-- checkpoint:${folder} -->`, () => checkpoint)
          }
          html = html.replace('<!-- tutorial-guide -->', () => guide)
        }

        html = html.replace(/<!-- code:([\w-]+) -->/g, (_, name) => {
          const example = examples[name]
          if (!example) throw new Error(`Missing ${isTutorial ? 'tutorial' : 'documentation'} example: ${name}`)
          return code(example.source, example.language, name)
        })
        return isTutorial ? html : html.replace('<!-- runtime-reference -->', await reference())
      },
    },
    handleHotUpdate(context) {
      const isTutorial = [tutorialExamples, guideFile].some(file => context.file === fileURLToPath(new URL(file, root))) ||
        context.file.startsWith(fileURLToPath(checkpointRoot))
      const isDocs = [...sourceFiles, docsExamples].some(file => context.file === fileURLToPath(new URL(file, root)))
      if (isTutorial || isDocs) {
        context.server.ws.send({ type: 'full-reload', path: isTutorial ? '/tutorial/' : '/docs/' })
      }
    },
    async closeBundle() {
      if (highlighter) (await highlighter).dispose()
      highlighter = undefined
    },
  }
}
