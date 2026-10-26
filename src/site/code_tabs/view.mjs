// @ts-nocheck

import { html, render } from 'lit-html'
import {
	Tab$View,
	Tab$ModelAndUpdate,
	Tab$Effects,
	Navigation$Next,
	Navigation$Previous,
	Navigation$First,
	Navigation$Last,
	Msg$UserSelectedTab,
	Msg$UserNavigatedTab,
	Model$Model$selected,
	Tab$isView,
	Tab$isModelAndUpdate,
	Tab$isEffects,
} from './code_tabs.mjs'

const tabs = () => [
	{
		tab: Tab$View(),
		id: 'view-tab',
		matches: Tab$isView,
		label: 'View',
		file: 'view.mjs',
		panel: 'view-example',
	},
	{
		tab: Tab$ModelAndUpdate(),
		id: 'model-tab',
		matches: Tab$isModelAndUpdate,
		label: 'Model & update',
		file: 'tutorial.gleam',
		panel: 'model-example',
	},
	{
		tab: Tab$Effects(),
		id: 'effects-tab',
		matches: Tab$isEffects,
		label: 'Effects',
		file: 'effects.mjs',
		panel: 'effects-example',
	},
]

function navigate(event, dispatch) {
	const direction = {
		ArrowRight: () => Navigation$Next(),
		ArrowLeft: () => Navigation$Previous(),
		Home: () => Navigation$First(),
		End: () => Navigation$Last(),
	}[event.key]
	if (!direction) return
	event.preventDefault()
	dispatch(Msg$UserNavigatedTab(direction()))
}

export function view(model, dispatch) {
	const tablist = document.querySelector('.code-tabs')
	if (!tablist) throw new Error('Missing homepage tab list')
	const entries = tabs()
	const currentTab = Model$Model$selected(model)

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
				@click=${() => dispatch(Msg$UserSelectedTab(tab))}
				@keydown=${event => navigate(event, dispatch)}
			>
				${label}<span>${file}</span>
			</button>`
		})}`,
		tablist,
	)
}
