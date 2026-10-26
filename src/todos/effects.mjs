// @ts-check

import { every, windowResize } from './subscriptions.mjs'
import {
	Msg$WindowResizeStarted,
	Msg$WindowResized,
	Msg$WindowResizeStopped,
	Msg$WindowResizeSubscriptionFailed,
	Msg$ClockStarted,
	Msg$ClockTicked,
	Msg$ClockStopped,
	Msg$ClockSubscriptionFailed,
	Msg$HttpReturnedTodo,
	Msg$HttpTodoRequestFailed,
	Msg$LocalStorageReturnedTodos,
	Msg$LocalStorageHadNoTodos,
	Msg$LocalStorageSavedTodos,
	Msg$LocalStorageFailed,
} from './todos.mjs'

/** @typedef {import('./todos.mjs').Msg$} Msg */

const key = 'mvu-lit.todos.v1'

/** @returns {import('../runtime/runner.mjs').Effect<string | null, Msg>} */
export function loadTodos() {
	return {
		perform: () => localStorage.getItem(key),
		onSuccess: saved =>
			saved === null ? Msg$LocalStorageHadNoTodos() : Msg$LocalStorageReturnedTodos(saved),
		onFailure: () => Msg$LocalStorageFailed('Browser storage is unavailable.'),
	}
}

/** @param {string} json @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function saveTodos(json) {
	return {
		perform: () => localStorage.setItem(key, json),
		onSuccess: () => Msg$LocalStorageSavedTodos(),
		onFailure: () => Msg$LocalStorageFailed('Browser storage is unavailable.'),
	}
}

/** @param {string} message @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function log(message) {
	return {
		perform: () => console.log(message),
	}
}

/** @param {string} label @param {number} milliseconds @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function delayedLog(label, milliseconds) {
	return {
		perform: async () => {
			console.log(`${label} started`)
			await new Promise(resolve => setTimeout(resolve, milliseconds))
			console.log(`${label} finished`)
		},
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<string, Msg>} */
export function fetchExample() {
	return {
		perform: async () => {
			const response = await fetch('https://jsonplaceholder.typicode.com/todos/1')
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			return response.text()
		},
		onSuccess: Msg$HttpReturnedTodo,
		onFailure: error =>
			Msg$HttpTodoRequestFailed(
				error instanceof Error ? error.message : 'Network request failed.',
			),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function startClock() {
	return {
		perform: ({ subscriptions, dispatch }) =>
			subscriptions.start('clock', every(1000, Msg$ClockTicked), dispatch),
		onSuccess: Msg$ClockStarted,
		onFailure: () => Msg$ClockSubscriptionFailed('Could not manage the clock.'),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function stopClock() {
	return {
		perform: ({ subscriptions }) => subscriptions.stop('clock'),
		onSuccess: Msg$ClockStopped,
		onFailure: () => Msg$ClockSubscriptionFailed('Could not manage the clock.'),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function startResize() {
	return {
		perform: ({ subscriptions, dispatch }) =>
			subscriptions.start('window-resize', windowResize(Msg$WindowResized), dispatch),
		onSuccess: Msg$WindowResizeStarted,
		onFailure: () => Msg$WindowResizeSubscriptionFailed('Could not watch window size.'),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function stopResize() {
	return {
		perform: ({ subscriptions }) => subscriptions.stop('window-resize'),
		onSuccess: Msg$WindowResizeStopped,
		onFailure: () =>
			Msg$WindowResizeSubscriptionFailed('Could not stop watching window size.'),
	}
}
