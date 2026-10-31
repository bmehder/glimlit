// @ts-check

// Shared browser utilities for example apps, separate from the MVU runtime.

/**
 * Prevent the browser's default action and pass the same event down a pipeline.
 * @template {Event} E
 * @param {E} event
 * @returns {E}
 */
export const preventDefault = event => {
	event.preventDefault()
	return event
}

/**
 * Read the current value from the control that owns this listener.
 * @param {Event} event
 * @returns {string}
 */
export const inputValue = event => {
	const target = event.currentTarget
	return target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
		? target.value
		: ''
}
