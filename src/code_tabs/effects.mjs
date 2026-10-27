// @ts-nocheck

import { Tab$isView, Tab$isModelAndUpdate, Tab$isEffects } from './code_tabs.mjs'

export const focusTab = tab => ({
	perform: () => {
		let id
		if (Tab$isView(tab)) id = 'view-tab'
		else if (Tab$isModelAndUpdate(tab)) id = 'model-tab'
		else if (Tab$isEffects(tab)) id = 'effects-tab'
		else throw new Error('Unknown homepage tab')
		document.getElementById(id)?.focus()
	},
})
