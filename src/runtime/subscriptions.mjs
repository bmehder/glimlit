// @ts-check

/** @template Msg @typedef {{start: (emit: (message: Msg) => void) => () => void}} Subscription */
/** @template Msg @typedef {{start: (key: string, subscription: Subscription<Msg>, dispatch: (message: Msg) => void) => void, stop: (key: string) => void, stopAll: () => void}} Subscriptions */
/** @typedef {{active: boolean, cleanup: () => void}} Entry */
/** @typedef {Map<string, Entry>} ActiveSubscriptions */

/**
 * Create an independent manager with start, stop, and stopAll operations.
 * Active string keys are unique within this manager. Stopping a subscription
 * disables its emit callback before cleanup runs.
 * @public
 * @template Msg
 * @returns {Subscriptions<Msg>}
 */
export function createSubscriptions() {
	/** @type {ActiveSubscriptions} */
	const active = new Map()
	return {
		start: (key, subscription, dispatch) => start(active, key, subscription, dispatch),
		stop: key => stop(active, key),
		stopAll: () => stopAll(active),
	}
}

/**
 * @template Msg
 * @param {ActiveSubscriptions} active
 * @param {string} key
 * @param {Subscription<Msg>} subscription
 * @param {(message: Msg) => void} dispatch
 */
function start(active, key, subscription, dispatch) {
	if (active.has(key)) return
	const entry = { active: true, cleanup: () => {} }
	active.set(key, entry)
	try {
		// Subscriptions receive emit: dispatch guarded by this entry's lifetime.
		const emit = whileActive(entry, dispatch)
		const cleanup = subscription.start(emit)
		attachCleanup(entry, cleanup)
	} catch (error) {
		deactivate(active, key, entry)
		throw error
	}
}

/** @param {ActiveSubscriptions} active @param {string} key */
function stop(active, key) {
	const entry = active.get(key)
	if (!entry) return
	deactivate(active, key, entry)
	entry.cleanup()
}

/** @param {ActiveSubscriptions} active */
function stopAll(active) {
	const errors = []
	for (const key of [...active.keys()]) {
		try {
			stop(active, key)
		} catch (error) {
			errors.push(error)
		}
	}
	if (errors.length) throw new AggregateError(errors, 'Subscription cleanup failed')
}

/** @template Msg @param {Entry} entry @param {(message: Msg) => void} dispatch */
function whileActive(entry, dispatch) {
	/** @param {Msg} message */
	return message => {
		if (entry.active) dispatch(message)
	}
}

/** @param {Entry} entry @param {() => void} cleanup */
function attachCleanup(entry, cleanup) {
	if (typeof cleanup !== 'function')
		throw new TypeError('Subscription must return cleanup')
	entry.cleanup = cleanup
	// Setup can emit before returning cleanup. If that message stops the
	// subscription, stop() has only the placeholder cleanup to call; run the
	// real cleanup now that it is available.
	if (!entry.active) cleanup()
}

/** @param {ActiveSubscriptions} active @param {string} key @param {Entry} entry */
function deactivate(active, key, entry) {
	entry.active = false
	if (active.get(key) === entry) active.delete(key)
}
