// @ts-check

/**
 * @template Msg
 * @param {number} milliseconds
 * @param {(now: number) => Msg} handleTick
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export function every(milliseconds, handleTick) {
	return {
		start: emit => {
			const timer = setInterval(() => emit(handleTick(Date.now())), milliseconds)
			return () => clearInterval(timer)
		},
	}
}

/**
 * @template Msg
 * @param {(width: number, height: number) => Msg} handleResize
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export function windowResize(handleResize) {
	return {
		start: emit => {
			const listener = () => emit(handleResize(window.innerWidth, window.innerHeight))
			window.addEventListener('resize', listener)
			listener()
			return () => window.removeEventListener('resize', listener)
		},
	}
}
