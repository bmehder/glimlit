import { main } from 'gleam:recipes/recipes'

const stop = main(document.getElementById('recipe-app'))
if (import.meta.hot) import.meta.hot.dispose(stop)
