// @ts-nocheck

import { preventDefault } from '#browser/events'
import { html } from 'lit-html'
import { flow, pipe, thunkify } from 'ramda'
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js'
import { examples } from './examples.mjs'
import {
	Model$Model$selected,
	Msg$UserNavigatedTab,
	Msg$UserSelectedTab,
	Navigation$First,
	Navigation$Last,
	Navigation$Next,
	Navigation$Previous,
	Tab$Effects,
	Tab$isEffects,
	Tab$isModelAndUpdate,
	Tab$isView,
	Tab$ModelAndUpdate,
	Tab$View,
} from './code_tabs.mjs'

export const view = (model, dispatch, { id }) => {
	const entries = [
		{
			tab: Tab$View(),
			id: id('view-tab'),
			matches: Tab$isView,
			label: 'View',
			file: 'view.mjs',
			panel: id('view-example'),
			source: examples.view,
		},
		{
			tab: Tab$ModelAndUpdate(),
			id: id('model-tab'),
			matches: Tab$isModelAndUpdate,
			label: 'Model & update',
			file: 'postcard.gleam',
			panel: id('model-example'),
			source: examples.model,
		},
		{
			tab: Tab$Effects(),
			id: id('effects-tab'),
			matches: Tab$isEffects,
			label: 'Effects',
			file: 'effects.mjs',
			panel: id('effects-example'),
			source: examples.effects,
		},
	]

	const handleKeydown = event => {
		const makeDirection = {
			ArrowRight: Navigation$Next,
			ArrowLeft: Navigation$Previous,
			Home: Navigation$First,
			End: Navigation$Last,
		}[event.key]

		if (!makeDirection) return

		preventDefault(event)

		flow(makeDirection(), [Msg$UserNavigatedTab, dispatch])
	}

	const currentTab = Model$Model$selected(model)

	const tabButton = ({ tab, id, matches, label, file, panel }) => {
		const active = matches(currentTab)
		const handleSelectTab = thunkify(pipe(Msg$UserSelectedTab, dispatch))(tab)

		return html`<button
			id=${id}
			type="button"
			role="tab"
			aria-selected=${String(active)}
			aria-controls=${panel}
			tabindex=${active ? 0 : -1}
			@click=${handleSelectTab}
			@keydown=${handleKeydown}
		>
			${label}<span>${file}</span>
		</button>`
	}

	const tabPanel = ({ id, matches, panel, source }) =>
		html`<div
			id=${panel}
			class="code-panel"
			role="tabpanel"
			aria-labelledby=${id}
			tabindex="0"
			?hidden=${!matches(currentTab)}
		>
			${unsafeHTML(source)}
		</div>`

	const buttons = entries.map(tabButton)
	const panels = entries.map(tabPanel)

	return html`<div
		class="code-window"
		aria-label="Gleam returns a model and effects separately; lit-html renders the view, and effect results return as messages"
	>
		<div class="code-window-bar">
			<span class="window-dots" aria-hidden="true">● ● ●</span
			><span>Two languages. One app.</span>
		</div>
		<div
			class="code-tabs"
			role="tablist"
			aria-label="Explore the view, model, and effects"
		>
			${buttons}
		</div>
		${panels}
		<div class="code-connection">
			Model → view · effects → runner · messages → update
		</div>
		<p class="code-explanation">
			Return a pair: the next model and a list of effects. The runtime renders the
			model, then performs the work. <code>[]</code> means no work to run.
		</p>
		<p class="code-caption">
			An illustration of the flow. The tutorial walks through complete, runnable
			files.
		</p>
	</div>`
}
