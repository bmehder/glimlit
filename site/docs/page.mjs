import { trackChapters } from '../shared/chapters.mjs'

const stop = trackChapters(document.getElementById('documentation'))
if (import.meta.hot) import.meta.hot.dispose(stop)
