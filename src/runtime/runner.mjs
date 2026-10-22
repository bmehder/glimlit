// @ts-check

import { createSubscriptions } from './subscriptions.mjs'

/** @template Msg @typedef {{active: boolean, subscriptions: import('./subscriptions.mjs').Subscriptions<Msg>}} Runtime */
/** @template Msg @typedef {{subscriptions: import('./subscriptions.mjs').Subscriptions<Msg>, dispatch: (message: Msg) => void}} Context */

/** @template Msg @returns {Runtime<Msg>} */
export function createRuntime() {
	return { active: true, subscriptions: createSubscriptions() }
}

/** @template Msg @param {Runtime<Msg>} runtime */
export function stop(runtime) {
	if (!runtime.active) return
	runtime.active = false
	runtime.subscriptions.stopAll()
}

/**
 * A value containing deferred work and optional callbacks that produce messages.
 * Constructing it does not execute anything.
 * @template Value, Msg
 * @typedef {{
 *   perform: (context: Context<Msg>) => Value | Promise<Value>,
 *   onSuccess?: (value: Value) => Msg,
 *   onFailure?: (error: unknown) => Msg,
 * }} Effect
 */

/**
 * @template Value, Msg
 * @param {Effect<Value, Msg>} effect
 * @param {(message: Msg) => void} dispatch
 * @param {Runtime<Msg>} [runtime]
 * @returns {Promise<void>}
 */
export function run(effect, dispatch, runtime = createRuntime()) {
	/** @param {Msg} message */
	const send = message => { if (runtime.active) dispatch(message) }
	return Promise.resolve().then(() => {
		if (runtime.active) return effect.perform({ subscriptions: runtime.subscriptions, dispatch: send })
	}).then(
		value => {
			if (runtime.active && effect.onSuccess) send(effect.onSuccess(/** @type {Value} */ (value)))
		},
		error => {
			if (!runtime.active) return
			if (effect.onFailure) send(effect.onFailure(error))
			else throw error
		},
	)
}

/** @template Msg @param {Runtime<Msg>} runtime */
export const isActive = runtime => runtime.active
