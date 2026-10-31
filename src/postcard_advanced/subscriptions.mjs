// @ts-nocheck

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

export const nextThemeKey = (handleNext, root) => ({
	start: dispatch => {
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

		const isNextThemeKey = pipe(prop('key'), toLower, equals('n'))

		const handleKeydown = when(
			allPass([hasNoBlockingFlags, isNotEditing, isNextThemeKey]),
			pipe(preventDefault, handleNext, dispatch),
		)

		const target = root ?? window
		target.addEventListener('keydown', handleKeydown)
		return () => target.removeEventListener('keydown', handleKeydown)
	},
})
