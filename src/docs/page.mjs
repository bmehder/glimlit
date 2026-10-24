import { trackChapters } from '../tutorial/navigation.mjs'

const stop = trackChapters(document.getElementById('documentation'))
if (import.meta.hot) import.meta.hot.dispose(stop)
