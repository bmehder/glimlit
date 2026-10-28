// @ts-check
import { contextForId } from './instance.mjs'
import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'

/**
 * Produce initial HTML using the same view as the browser. Initialization must
 * be deterministic on both sides. Returned effects are deliberately not run.
 * @template Model, Msg
 * @param {[Model, unknown]} initial
 * @param {(model: Model, dispatch: (message: Msg) => void, context: import('./instance.mjs').InstanceContext) => import('lit-html').TemplateResult} view
 * @param {string} rootId The same root ID used by the browser.
 * @returns {Promise<string>}
 */
export function renderInitial(initial, view, rootId) {
	const [model] = initial
	return collectResult(render(view(model, () => {}, contextForId(rootId))))
}
