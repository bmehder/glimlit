import { main } from 'gleam:recipes/recipes'

const stop = main()
if (import.meta.hot) import.meta.hot.dispose(stop)
