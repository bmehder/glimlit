// @ts-check

import { createSubscriptions } from './subscriptions.mjs'

/** @template Msg @typedef {{active: boolean, subscriptions: import('./subscriptions.mjs').Subscriptions<Msg> | null}} Runtime */
/** @template Msg @typedef {{subscriptions: import('./subscriptions.mjs').Subscriptions<Msg>, dispatch: (message: Msg) => void}} Context */

/**
 * Create an independent runtime. Its subscription manager is created by the first
 * run call and keeps that app dispatcher for all of its sources.
 * @public
 * @template Msg
 * @returns {Runtime<Msg>}
 */
export function createRuntime() {
	return { active: true, subscriptions: null }
}

/**
 * Stop a runtime, clean up its subscriptions, and ignore future messages.
 * Repeated calls do nothing. This does not cancel work already in progress.
 * @public
 * @template Msg
 * @param {Runtime<Msg>} runtime
 */
export function stop(runtime) {
	if (!runtime.active) return
	runtime.active = false
	runtime.subscriptions?.stopAll()
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
 * Perform deferred work and dispatch its success or failure message.
 * Work is scheduled through a Promise and is skipped if the runtime is stopped.
 * Without onFailure, a work failure rejects the returned Promise.
 * Reuse a runtime only for effects belonging to the same app dispatcher.
 * @public
 * @template Value, Msg
 * @param {Effect<Value, Msg>} effect
 * @param {(message: Msg) => void} dispatch
 * @param {Runtime<Msg>} [runtime]
 * @returns {Promise<void>}
 */
export function run(effect, dispatch, runtime = createRuntime()) {
	/** @param {Msg} message */
	const send = message => {
		if (runtime.active) dispatch(message)
	}
	return Promise.resolve()
		.then(() => {
			if (runtime.active) {
				// All sources in an app share the first effect's guarded dispatcher.
				const subscriptions = runtime.subscriptions ??= createSubscriptions(send)
				return effect.perform({ subscriptions, dispatch: send })
			}
		})
		.then(
			value => {
				if (runtime.active && effect.onSuccess)
					send(effect.onSuccess(/** @type {Value} */ (value)))
			},
			error => {
				if (!runtime.active) return
				if (effect.onFailure) send(effect.onFailure(error))
				else throw error
			},
		)
}

/**
 * Report whether the runtime still accepts work and messages.
 * @function isActive
 * @public
 * @template Msg
 * @param {Runtime<Msg>} runtime
 * @returns {boolean}
 */
export const isActive = runtime => runtime.active
