// @ts-check

/**
 * @template Msg
 * @param {() => Msg} handleNewTodo
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export function newTodoKey(handleNewTodo) {
	return {
		start: emit => {
			/** @param {KeyboardEvent} event */
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
				emit(handleNewTodo())
			}
			window.addEventListener('keydown', handleKeydown)
			return () => window.removeEventListener('keydown', handleKeydown)
		},
	}
}
