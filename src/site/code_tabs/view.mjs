// @ts-nocheck

import { html, render } from 'lit-html'
import {
	View,
	ModelAndUpdate,
	Effects,
	Next,
	Previous,
	First,
	Last,
	UserSelectedTab,
	UserNavigatedTab,
	Model$Model$selected as selected,
	Tab$isView as isView,
	Tab$isModelAndUpdate as isModelAndUpdate,
	Tab$isEffects as isEffects,
} from './code_tabs.mjs'

const tabs = () => [
	{
		tab: new View(),
		id: 'view-tab',
		matches: isView,
		label: 'View',
		file: 'view.mjs',
		panel: 'view-example',
	},
	{
		tab: new ModelAndUpdate(),
		id: 'model-tab',
		matches: isModelAndUpdate,
		label: 'Model & update',
		file: 'tutorial.gleam',
		panel: 'model-example',
	},
	{
		tab: new Effects(),
		id: 'effects-tab',
		matches: isEffects,
		label: 'Effects',
		file: 'effects.mjs',
		panel: 'effects-example',
	},
]

function navigate(event, dispatch) {
	const direction = {
		ArrowRight: () => new Next(),
		ArrowLeft: () => new Previous(),
		Home: () => new First(),
		End: () => new Last(),
	}[event.key]
	if (!direction) return
	event.preventDefault()
	dispatch(new UserNavigatedTab(direction()))
}

export function view(model, dispatch) {
	const tablist = document.querySelector('.code-tabs')
	if (!tablist) throw new Error('Missing homepage tab list')
	const entries = tabs()
	const currentTab = selected(model)

	// Keep the highlighted code in the initial HTML, readable before JS starts.
	entries.forEach(({ matches, panel }) => {
		document.getElementById(panel).hidden = !matches(currentTab)
	})

	tablist
		.querySelectorAll('[data-static-tab]')
		.forEach(fallback => fallback.remove())

	render(
		html`${entries.map(({ tab, id, matches, label, file, panel }) => {
			const active = matches(currentTab)
			return html`<button
				id=${id}
				type="button"
				role="tab"
				aria-selected=${String(active)}
				aria-controls=${panel}
				tabindex=${active ? 0 : -1}
				@click=${() => dispatch(new UserSelectedTab(tab))}
				@keydown=${event => navigate(event, dispatch)}
			>
				${label}<span>${file}</span>
			</button>`
		})}`,
		tablist,
	)
}
