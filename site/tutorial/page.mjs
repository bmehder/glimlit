import { trackChapters } from '../shared/chapters.mjs'

const guide = document.getElementById('guide')
const status = document.getElementById('copy-status')
const controller = new AbortController()
const timers = new Set()
const stopTracking = trackChapters(guide)

for (const button of guide.querySelectorAll('[data-copy-file]')) button.hidden = false

async function handleCopy(event) {
	const button = event.target instanceof Element && event.target.closest('[data-copy-file]')
	if (!button) return
	const download = button.closest('.source-details').querySelector('a[download]')
	const url = download.getAttribute('href')
	const source = decodeURIComponent(url.slice(url.indexOf(',') + 1))
	try {
		await navigator.clipboard.writeText(source)
		if (controller.signal.aborted) return
		button.textContent = 'Copied'
		status.textContent = 'File copied. Paste it into the matching file in src/postcard/.'
		const timer = setTimeout(() => {
			button.textContent = 'Copy file'
			timers.delete(timer)
		}, 2000)
		timers.add(timer)
	} catch {
		if (!controller.signal.aborted)
			status.textContent = 'Clipboard access is unavailable. Select the code to copy it, or use Download.'
	}
}

guide.addEventListener('click', handleCopy, { signal: controller.signal })

if (import.meta.hot) import.meta.hot.dispose(() => {
	controller.abort()
	stopTracking()
	for (const timer of timers) clearTimeout(timer)
})
