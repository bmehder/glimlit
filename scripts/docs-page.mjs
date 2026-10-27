import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'comment-parser'
import { createHighlighter } from 'shiki'

const root = new URL('../', import.meta.url)
const sourceFiles = ['src/runtime/runner.mjs', 'src/runtime/subscriptions.mjs']
const examplesFile = 'site/docs/examples.json'
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

export function docsPage() {
  let highlighter
  return {
    name: 'docs-page',
    async buildStart() {
      for (const file of [...sourceFiles, examplesFile]) this.addWatchFile(fileURLToPath(new URL(file, root)))
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        if (!context.path.startsWith('/docs/')) return
        highlighter ??= createHighlighter({ themes: ['github-dark'], langs: ['gleam', 'javascript', 'shellscript', 'html'] })
        const engine = await highlighter
        const examples = JSON.parse(await readFile(new URL(examplesFile, root), 'utf8'))
        const result = html.replace(/<!-- code:([\w-]+) -->/g, (_, name) => {
          const example = examples[name]
          if (!example) throw new Error(`Missing documentation example: ${name}`)
          const { tokens } = engine.codeToTokens(example.source, { lang: example.language, theme: 'github-dark' })
          return `<pre class="docs-code" tabindex="0" aria-label="${escape(name)} code example"><code>${tokens.map(line => line.map(token => `<span style="color:${escape(token.color)}">${escape(token.content)}</span>`).join('')).join('\n')}</code></pre>`
        })
        return result.replace('<!-- runtime-reference -->', await reference())
      },
    },
    handleHotUpdate(context) {
      if ([...sourceFiles, examplesFile].some(file => context.file === fileURLToPath(new URL(file, root)))) {
        context.server.ws.send({ type: 'full-reload', path: '/docs/' })
      }
    },
    async closeBundle() {
      if (highlighter) (await highlighter).dispose()
      highlighter = undefined
    },
  }
}
