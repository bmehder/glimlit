// @ts-check

import { preventDefault } from '#browser/events'
import {
	allPass,
	anyPass,
	both,
	complement,
	equals,
	invoker,
	is,
	none,
	pipe,
	prop,
	props,
	toLower,
	when,
} from 'ramda'

/**
 * @template Msg
 * @param {() => Msg} handleNewTodo
 * @param {HTMLElement} [root]
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export function newTodoKey(handleNewTodo, root) {
	return {
		start: dispatch => {
			/** @type {(event: KeyboardEvent) => boolean} */
			const isEditing = pipe(
				prop('target'),
				both(
					is(HTMLElement),
					anyPass([
						invoker(1, 'matches')('input, textarea, select'),
						prop('isContentEditable'),
						invoker(1, 'closest')('dialog'),
					]),
				),
			)

			const isNotEditing = complement(isEditing)

			/** @type {(event: KeyboardEvent) => boolean} */
			const hasNoBlockingFlags = pipe(
				props([
					'defaultPrevented',
					'isComposing',
					'repeat',
					'ctrlKey',
					'metaKey',
					'altKey',
					'shiftKey',
				]),
				none(Boolean),
			)

			/** @type {(event: KeyboardEvent) => boolean} */
			const isNewTodoKey = pipe(prop('key'), toLower, equals('n'))

			const handleKeydown = when(
				allPass([hasNoBlockingFlags, isNotEditing, isNewTodoKey]),
				pipe(preventDefault, handleNewTodo, dispatch),
			)

			if (root) {
				root.addEventListener('keydown', handleKeydown)
				return () => root.removeEventListener('keydown', handleKeydown)
			}

			window.addEventListener('keydown', handleKeydown)
			return () => window.removeEventListener('keydown', handleKeydown)
		},
	}
}
