// @ts-nocheck

export function nextThemeKey(onNext) {
	return {
		start: emit => {
			const listener = event => {
				const editing =
					event.target instanceof Element &&
					(event.target.closest('input, textarea, select') ||
						event.target.isContentEditable)
				if (
					editing ||
					event.repeat ||
					event.ctrlKey ||
					event.metaKey ||
					event.altKey
				)
					return
				if (event.key.toLowerCase() === 'n') emit(onNext())
			}
			window.addEventListener('keydown', listener)
			return () => window.removeEventListener('keydown', listener)
		},
	}
}
