import { main } from 'gleam:code_tabs/code_tabs'

const stop = main()
if (import.meta.hot) import.meta.hot.dispose(stop)
