import { main } from 'gleam:code_tabs/code_tabs'

const stop = main(document.getElementById('code-tabs-app'))
if (import.meta.hot) import.meta.hot.dispose(stop)
