// @ts-check

import {
	Msg$LocalStorageReturnedRecipes,
	Msg$LocalStorageHadNoRecipes,
	Msg$LocalStorageLoadFailed,
	Msg$LocalStorageSavedRecipes,
	Msg$LocalStorageSaveFailed,
	Msg$HttpReturnedSamples,
	Msg$HttpSamplesRequestFailed,
	Msg$BrowserHashChanged,
} from './recipes.mjs'
import { hashRoute } from './subscriptions.mjs'

/** @typedef {import('./recipes.mjs').Msg$} Msg */
export const storageKey = 'glimlit.recipes.v1'

/** @returns {import('../runtime/runner.mjs').Effect<string | null, Msg>} */
export const load = () => ({
	perform: () => localStorage.getItem(storageKey),
	onSuccess: saved =>
		saved === null
			? Msg$LocalStorageHadNoRecipes()
			: Msg$LocalStorageReturnedRecipes(saved),
	onFailure: () =>
		Msg$LocalStorageLoadFailed(
			'Browser storage is unavailable. Try again, or start with the starter recipes in memory.',
		),
})

/** @param {string} source @param {number} saveId @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export const save = (source, saveId) => ({
	perform: () => localStorage.setItem(storageKey, source),
	onSuccess: () => Msg$LocalStorageSavedRecipes(saveId),
	onFailure: () =>
		Msg$LocalStorageSaveFailed(
			saveId,
			'Could not save in this browser. Your changes are still here; retry before leaving.',
		),
})

/** @param {number} request @returns {import('../runtime/runner.mjs').Effect<string, Msg>} */
export const fetchSamples = request => ({
	perform: async () => {
		const response = await fetch('/recipes/samples.json')
		if (!response.ok) throw new Error(`Sample request failed: ${response.status}`)
		return response.text()
	},
	onSuccess: source => Msg$HttpReturnedSamples(request, source),
	onFailure: () =>
		Msg$HttpSamplesRequestFailed(
			request,
			'Could not load the samples. Your collection is unchanged. Check your connection and try again.',
		),
})

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export const watchRoute = () => ({
	perform: ({ subscriptions }) =>
		subscriptions.start(
			'recipes-route',
			hashRoute(hash => Msg$BrowserHashChanged(hash)),
		),
})

/** @param {string} hash @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export const navigate = hash => ({
	perform: () => {
		window.location.hash = hash
	},
})

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export const focusErrors = () => ({
	perform: () => document.getElementById('recipe-errors')?.focus(),
})

/** @returns {import('../runtime/runner.mjs').Effect<void, Msg>} */
export const focusContent = () => ({
	perform: () => {
		const heading = document.querySelector('#recipe-app h2')
		if (heading instanceof HTMLElement) {
			heading.tabIndex = -1
			heading.focus()
		}
	},
})
