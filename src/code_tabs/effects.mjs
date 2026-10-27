// @ts-nocheck

import { Tab$isView, Tab$isModelAndUpdate, Tab$isEffects } from './code_tabs.mjs'

export const focusTab = tab => ({
	perform: () => {
		const id = Tab$isView(tab)
			? 'view-tab'
			: Tab$isModelAndUpdate(tab)
				? 'model-tab'
				: Tab$isEffects(tab)
					? 'effects-tab'
					: null
		if (id === null) throw new Error('Unknown homepage tab')
		document.getElementById(id)?.focus()
	},
})
