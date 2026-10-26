// @ts-check

/**
 * @template Msg
 * @param {(hash: string) => Msg} handleChange
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export const hashRoute = handleChange => ({
	start: emit => {
		const changed = () => emit(handleChange(window.location.hash))
		window.addEventListener('hashchange', changed)
		changed()
		return () => window.removeEventListener('hashchange', changed)
	},
})
