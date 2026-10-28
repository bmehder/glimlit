// Build-time worker: a fresh module graph avoids cached views across watch builds.
import { renderInitial } from '../src/runtime/server.mjs'

const app = process.argv[2]
if (!['counter', 'code_tabs'].includes(app)) throw new Error('Unknown prerendered app')
const { init } = await import(`../build/dev/javascript/glimlit/${app}/${app}.mjs`)
const { view } = await import(`../build/dev/javascript/glimlit/${app}/view.mjs`)
process.stdout.write(await renderInitial(init(), view))
