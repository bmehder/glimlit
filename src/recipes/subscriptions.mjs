// @ts-check

import { pipe } from 'ramda'

/**
 * @template Msg
 * @param {(hash: string) => Msg} handleChange
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export const hashRoute = handleChange => ({
	start: dispatch => {
		const handleHashChange = pipe(
			() => window.location.hash,
			handleChange,
			dispatch,
		)
		window.addEventListener('hashchange', handleHashChange)
		handleHashChange()
		return () => window.removeEventListener('hashchange', handleHashChange)
	},
})
