// @ts-check

import { html } from 'lit-html'
import { thunkify } from 'ramda'
import {
	Model$Model$count,
	Msg$UserClickedDecrement,
	Msg$UserClickedIncrement,
	Msg$UserClickedReset,
} from './counter.mjs'

/**
 * @param {import('./counter.mjs').Model$} model
 * @param {(msg: import('./counter.mjs').Msg$) => void} dispatch
 * @returns {import('lit-html').TemplateResult}
 */
export const view = (model, dispatch) => {
	const count = Model$Model$count(model)

	/**
	 * @param {string} label
	 * @param {string} accessibleName
	 * @param {import('./counter.mjs').Msg$} message
	 */
	const button = (label, accessibleName, message) => {
		const handleClick = thunkify(dispatch)(message)

		return html`
			<button
				class="mr-2 min-w-12 cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-xl text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
				@click=${handleClick}
				aria-label=${accessibleName}
			>
				${label}
			</button>
		`
	}

	return html`
		<h2 class="text-xl font-semibold">Counter</h2>
		<p class="my-8">
			<output class="text-6xl font-medium tabular-nums" aria-live="polite"
				>${count}</output
			>
		</p>
		${button('−', 'Decrease count', Msg$UserClickedDecrement())}
		${button('+', 'Increase count', Msg$UserClickedIncrement())}
		${button('Reset', 'Reset count', Msg$UserClickedReset())}
	`
}
