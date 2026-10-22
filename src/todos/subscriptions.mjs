// @ts-check

/**
 * @template Msg
 * @param {number} milliseconds
 * @param {(now: number) => Msg} onTick
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export function every(milliseconds, onTick) {
	return {
		start: emit => {
			const timer = setInterval(() => emit(onTick(Date.now())), milliseconds)
			return () => clearInterval(timer)
		},
	}
}

/**
 * @template Msg
 * @param {(width: number, height: number) => Msg} onResize
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export function windowResize(onResize) {
	return {
		start: emit => {
			const listener = () => emit(onResize(window.innerWidth, window.innerHeight))
			window.addEventListener('resize', listener)
			listener()
			return () => window.removeEventListener('resize', listener)
		},
	}
}
