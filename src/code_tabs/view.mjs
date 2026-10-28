// @ts-nocheck

import { html } from 'lit-html'
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js'
import { examples } from './examples.mjs'
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

export function view(model, dispatch, context) {
	const entries = [
		{
			tab: Tab$View(),
			id: context.id('view-tab'),
			matches: Tab$isView,
			label: 'View',
			file: 'view.mjs',
			panel: context.id('view-example'),
			source: examples.view,
		},
		{
			tab: Tab$ModelAndUpdate(),
			id: context.id('model-tab'),
			matches: Tab$isModelAndUpdate,
			label: 'Model & update',
			file: 'postcard.gleam',
			panel: context.id('model-example'),
			source: examples.model,
		},
		{
			tab: Tab$Effects(),
			id: context.id('effects-tab'),
			matches: Tab$isEffects,
			label: 'Effects',
			file: 'effects.mjs',
			panel: context.id('effects-example'),
			source: examples.effects,
		},
	]

	function handleKeydown(event) {
		const direction = {
			ArrowRight: Navigation$Next,
			ArrowLeft: Navigation$Previous,
			Home: Navigation$First,
			End: Navigation$Last,
		}[event.key]

		if (!direction) return

		event.preventDefault()

		dispatch(Msg$UserNavigatedTab(direction()))
	}

	const currentTab = Model$Model$selected(model)

	return html`<div class="code-window"
		aria-label="Gleam returns a model and effects separately; lit-html renders the view, and effect results return as messages">
		<div class="code-window-bar"><span class="window-dots" aria-hidden="true">● ● ●</span><span>Two languages. One app.</span></div>
		<div class="code-tabs" role="tablist" aria-label="Explore the view, model, and effects">
			${entries.map(({ tab, id, matches, label, file, panel }) => {
				const active = matches(currentTab)
				const handleSelectTab = () => dispatch(Msg$UserSelectedTab(tab))
				return html`<button id=${id} type="button" role="tab"
					aria-selected=${String(active)} aria-controls=${panel}
					tabindex=${active ? 0 : -1}
					@click=${handleSelectTab} @keydown=${handleKeydown}>
					${label}<span>${file}</span>
				</button>`
			})}
		</div>
		${entries.map(({ id, matches, panel, source }) => html`<div
			id=${panel} class="code-panel" role="tabpanel" aria-labelledby=${id}
			tabindex="0" ?hidden=${!matches(currentTab)}>
			${unsafeHTML(source)}
		</div>`)}
		<div class="code-connection">Model → view · effects → runner · messages → update</div>
		<p class="code-explanation">Return a pair: the next model and a list of effects. The runtime renders the
			model, then performs the work. <code>[]</code> means no work to run.</p>
		<p class="code-caption">An illustration of the flow. The tutorial walks through complete, runnable files.</p>
	</div>`
}
