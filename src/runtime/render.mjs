// @ts-check
import { render } from 'lit-html'
import { hydrate } from '@lit-labs/ssr-client'

/**
 * Internal renderer for a single app root. Hosts mark Lit-generated HTML with
 * data-glimlit-ssr; app developers always start with main(root).
 * Hydration is synchronous so handlers are attached before effects run.
 * @param {HTMLElement | null} root
 * @returns {(template: import('lit-html').TemplateResult) => void}
 */
export function createRenderer(root) {
	if (!root || root.nodeType !== 1) throw new Error('Missing Glimlit mount element')
	let needsHydration = root.hasAttribute('data-glimlit-ssr')
	if (needsHydration && ![...root.childNodes].some(node =>
		node.nodeType === 8 && node.nodeValue?.startsWith('lit-part '))) {
		throw new Error('Marked Glimlit roots require initial HTML produced by Lit SSR')
	}
	return template => {
		if (needsHydration) {
			hydrate(template, root)
			needsHydration = false
			root.removeAttribute('data-glimlit-ssr')
		} else render(template, root)
	}
}
