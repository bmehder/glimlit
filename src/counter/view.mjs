// @ts-check

import { html, render } from 'lit-html'
import {
	Msg$UserClickedIncrement,
	Msg$UserClickedIncrementBy10,
	Msg$UserClickedDecrement,
	Msg$UserClickedReset,
	Model$Model$count,
} from './counter.mjs'

/**
 * @param {import('./counter.mjs').Model$} model
 * @param {(msg: import('./counter.mjs').Msg$) => void} dispatch
 * @returns {void}
 */
export function view(model, dispatch) {
	const app = document.getElementById('app')
	if (!app) throw new Error('Missing #app mount element')

	render(
		html`
			<h2 class="text-xl font-semibold">Counter</h2>
			<p class="my-8">
				<output class="text-6xl font-medium tabular-nums" aria-live="polite"
					>${Model$Model$count(model)}</output
				>
			</p>
			${button('−', 'Decrease count', Msg$UserClickedDecrement(), dispatch)}
			${button('+', 'Increase count', Msg$UserClickedIncrement(), dispatch)}
			${button(
				'+10',
				'Increase count by 10',
				Msg$UserClickedIncrementBy10(),
				dispatch,
			)}
			${button('Reset', 'Reset count', Msg$UserClickedReset(), dispatch)}
		`,
		app,
	)
}

/**
 * @param {string} label
 * @param {string} accessibleName
 * @param {import('./counter.mjs').Msg$} message
 * @param {(msg: import('./counter.mjs').Msg$) => void} dispatch
 */
function button(label, accessibleName, message, dispatch) {
	return html`
		<button
			class="mr-2 min-w-12 cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-xl text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
			@click=${() => dispatch(message)}
			aria-label=${accessibleName}
		>
			${label}
		</button>
	`
}
