// @ts-check
// Temporary, server-only compatibility layer for Lit SSR native textarea values.
// Keep outside the MVU loop and browser renderer. Remove when upstream can
// serialize textarea.value without changing shared, hydratable templates.
import { parseFragment } from 'parse5'
import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'

/** @param {string} text */
const escapeText = text => text.replace(/[&<>]/g, character =>
	character === '&' ? '&amp;' : character === '<' ? '&lt;' : '&gt;')

/**
 * Render a shared Lit template, filling only explicitly marked textarea defaults.
 * Keep data-ssr-value in both templates so hydration sees the same bindings.
 * This does not preserve edits made before hydration.
 * @param {import('lit-html').TemplateResult} template
 * @returns {Promise<string>}
 */
export async function renderWithSsrCompatibility(template) {
	const html = await collectResult(render(template))
	const fragment = parseFragment(html, { sourceCodeLocationInfo: true })
	/** @type {{offset: number, text: string}[]} */
	const insertions = []
	/** @param {import('parse5').DefaultTreeAdapterMap['node']} node */
	function visit(node) {
		if ('tagName' in node && node.tagName === 'textarea') {
			const value = node.attrs.find(attribute => attribute.name === 'data-ssr-value')
			const location = node.sourceCodeLocation
			if (value) {
				if (!location?.startTag || !location.endTag ||
					location.startTag.endOffset !== location.endTag.startOffset) {
					throw new Error('SSR compatibility requires an empty textarea with a closing tag')
				}
				// HTML discards one leading newline immediately after <textarea>.
				const prefix = value.value.startsWith('\n') ? '\n' : ''
				insertions.push({ offset: location.startTag.endOffset, text: prefix + escapeText(value.value) })
			}
		}
		if ('childNodes' in node) node.childNodes.forEach(visit)
	}
	visit(fragment)
	// Insert backwards so parser offsets stay valid. Never reserialize Lit markers.
	return insertions.sort((a, b) => b.offset - a.offset).reduce(
		(output, { offset, text }) => output.slice(0, offset) + text + output.slice(offset), html)
}
