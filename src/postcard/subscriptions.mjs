// @ts-nocheck

export function nextThemeKey(handleNext, root) {
	return {
		start: dispatch => {
			const handleKeydown = event => {
				const editing =
					event.target instanceof HTMLElement &&
					(event.target.matches('input, textarea, select') ||
						event.target.isContentEditable ||
						event.target.closest('dialog'))
				if (
					editing ||
					event.defaultPrevented ||
					event.isComposing ||
					event.repeat ||
					event.ctrlKey ||
					event.metaKey ||
					event.altKey ||
					event.shiftKey
				) return
				if (event.key.toLowerCase() !== 'n') return
				event.preventDefault()
				dispatch(handleNext())
			}
			const target = root ?? window
			target.addEventListener('keydown', handleKeydown)
			return () => target.removeEventListener('keydown', handleKeydown)
		},
	}
}
