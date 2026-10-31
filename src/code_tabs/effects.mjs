// @ts-nocheck

import { always, cond, flow, T } from 'ramda'
import { Tab$isEffects, Tab$isModelAndUpdate, Tab$isView } from './code_tabs.mjs'

export const focusTab = tab => ({
	perform: ({ root, id: scopedId }) => {
		const tabId = cond([
			[Tab$isView, always('view-tab')],
			[Tab$isModelAndUpdate, always('model-tab')],
			[Tab$isEffects, always('effects-tab')],
			[T, () => {
				throw new Error('Unknown homepage tab')
			}],
		])
		const id = flow(tab, [tabId, scopedId])

		root?.querySelector(`[id="${id}"]`)?.focus()
	},
})
