// @ts-check

/** @template Msg @typedef {{start: (dispatch: (message: Msg) => void) => () => void}} Subscription */
/** @template Msg @typedef {{start: (key: string, subscription: Subscription<Msg>) => void, stop: (key: string) => void, stopAll: () => void}} Subscriptions */
/** @typedef {{active: boolean, cleanup: () => void}} Entry */
/** @typedef {Map<string, Entry>} ActiveSubscriptions */

/**
 * Create an independent manager with start, stop, and stopAll operations.
 * Active string keys are unique within this manager. Stopping a subscription
 * disables its dispatch callback before cleanup runs. Every source uses the dispatcher
 * supplied when this manager is created.
 * @public
 * @template Msg
 * @param {(message: Msg) => void} dispatch
 * @returns {Subscriptions<Msg>}
 */
export function createSubscriptions(dispatch) {
	/** @type {ActiveSubscriptions} */
	const active = new Map()
	return {
		start: (key, subscription) => start(active, key, subscription, dispatch),
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
		// Each source receives dispatch guarded by this entry's lifetime.
		const cleanup = subscription.start(whileActive(entry, dispatch))
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
	// Setup can dispatch a message before returning cleanup. If that message stops the
	// subscription, stop() has only the placeholder cleanup to call; run the
	// real cleanup now that it is available.
	if (!entry.active) cleanup()
}

/** @param {ActiveSubscriptions} active @param {string} key @param {Entry} entry */
function deactivate(active, key, entry) {
	entry.active = false
	if (active.get(key) === entry) active.delete(key)
}
