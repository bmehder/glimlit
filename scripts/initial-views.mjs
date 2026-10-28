import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))

// This website prerenders two examples. Host-specific page generation stays out
// of the MVU runtime; any host can use renderInitial with the shared app view.
export function initialViews() {
	let server
	return {
		name: 'glimlit-initial-views',
		configureServer(value) { server = value },
		// A live Lit root cannot be hydrated again by an HMR restart. Wait for the
		// compiler hook, then reload pages when a prerendered app changes.
		handleHotUpdate: {
			order: 'post',
			handler(context) {
				const relative = context.file.slice(root.length)
				if (/^src\/(counter|code_tabs|runtime)\//.test(relative) || relative === 'site/home.mjs') {
					context.server.ws.send({ type: 'full-reload' })
					return []
				}
			},
		},
		transformIndexHtml: {
			order: 'pre',
			async handler(html) {
				for (const match of html.matchAll(/(<div\b[^>]*>)(\s*)<!-- glimlit:(counter|code_tabs) -->/g)) {
					const app = match[3]
					let initial
					if (server) {
						const { renderInitial } = await server.ssrLoadModule(`${root}src/runtime/server.mjs`)
						const { init } = await server.ssrLoadModule(`${root}build/dev/javascript/glimlit/${app}/${app}.mjs`)
						const { view } = await server.ssrLoadModule(`${root}src/${app}/view.mjs`)
						initial = await renderInitial(init(), view)
					} else {
						const { stdout } = await execute(process.execPath, ['scripts/render-initial.mjs', app], { cwd: root })
						initial = stdout
					}
					html = html.replace(match[0], () => `${match[1].slice(0, -1)} data-glimlit-ssr>${match[2]}${initial}`)
				}
				return html
			},
		},
	}
}
