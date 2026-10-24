import { main } from '../../../build/dev/javascript/glimlit/site/code_tabs/code_tabs.mjs'

const stop = main()
if (import.meta.hot) import.meta.hot.dispose(stop)
