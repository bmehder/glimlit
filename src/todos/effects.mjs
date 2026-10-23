// @ts-check

import { every, windowResize } from './subscriptions.mjs'
import {
	Msg$WindowResizeStarted as windowResizeStarted,
	Msg$WindowResized as windowResized,
	Msg$WindowResizeStopped as windowResizeStopped,
	Msg$WindowResizeSubscriptionFailed as windowResizeSubscriptionFailed,
	Msg$ClockStarted as clockStarted,
	Msg$ClockTicked as clockTicked,
	Msg$ClockStopped as clockStopped,
	Msg$ClockSubscriptionFailed as clockSubscriptionFailed,
	Msg$HttpReturnedTodo as httpReturnedTodo,
	Msg$HttpTodoRequestFailed as httpTodoRequestFailed,
	Msg$LocalStorageReturnedTodos as localStorageReturnedTodos,
	Msg$LocalStorageHadNoTodos as localStorageHadNoTodos,
	Msg$LocalStorageSavedTodos as localStorageSavedTodos,
	Msg$LocalStorageFailed as localStorageFailed,
} from './todos.mjs'

/** @typedef {import('./todos.mjs').Msg$} Msg */

const key = 'mvu-lit.todos.v1'

/** @returns {import('../runtime/runner.mjs').Effect<string | null, Msg>} */
export function loadTodos() {
	return {
		perform: () => localStorage.getItem(key),
		onSuccess: saved =>
			saved === null ? localStorageHadNoTodos() : localStorageReturnedTodos(saved),
		onFailure: () => localStorageFailed('Browser storage is unavailable.'),
	}
}

/** @param {string} json @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function saveTodos(json) {
	return {
		perform: () => localStorage.setItem(key, json),
		onSuccess: () => localStorageSavedTodos(),
		onFailure: () => localStorageFailed('Browser storage is unavailable.'),
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
		onSuccess: httpReturnedTodo,
		onFailure: error =>
			httpTodoRequestFailed(
				error instanceof Error ? error.message : 'Network request failed.',
			),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function startClock() {
	return {
		perform: ({ subscriptions, dispatch }) =>
			subscriptions.start('clock', every(1000, clockTicked), dispatch),
		onSuccess: clockStarted,
		onFailure: () => clockSubscriptionFailed('Could not manage the clock.'),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function stopClock() {
	return {
		perform: ({ subscriptions }) => subscriptions.stop('clock'),
		onSuccess: clockStopped,
		onFailure: () => clockSubscriptionFailed('Could not manage the clock.'),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function startResize() {
	return {
		perform: ({ subscriptions, dispatch }) =>
			subscriptions.start('window-resize', windowResize(windowResized), dispatch),
		onSuccess: windowResizeStarted,
		onFailure: () => windowResizeSubscriptionFailed('Could not watch window size.'),
	}
}

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export function stopResize() {
	return {
		perform: ({ subscriptions }) => subscriptions.stop('window-resize'),
		onSuccess: windowResizeStopped,
		onFailure: () => windowResizeSubscriptionFailed('Could not stop watching window size.'),
	}
}
