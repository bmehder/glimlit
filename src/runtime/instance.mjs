// @ts-check

/** @typedef {{root?: HTMLElement, id: (name: string) => string}} InstanceContext */

let nextId = 0

/**
 * Describe the identity of server-rendered UI without creating a DOM root.
 * The host must retain this ID on the browser's mount element.
 * @param {string} rootId
 * @returns {InstanceContext}
 */
export function contextForId(rootId) {
	if (!rootId) throw new Error('Glimlit initial HTML requires a stable root ID')
	return { id: name => `${rootId}-${name}` }
}

/** @param {HTMLElement | null} root @returns {InstanceContext} */
export function createContext(root) {
	if (!root || root.nodeType !== 1) throw new Error('Missing Glimlit mount element')
	if (!root.id) {
		if (root.hasAttribute('data-glimlit-ssr')) {
			throw new Error('Server-rendered Glimlit roots must retain their server ID')
		}
		while (!root.id) {
			const candidate = `glimlit-${++nextId}`
			if (!root.ownerDocument.getElementById(candidate)) root.id = candidate
		}
	}
	if (!root.hasAttribute('tabindex')) root.tabIndex = -1
	return { ...contextForId(root.id), root }
}
