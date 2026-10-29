import test from 'node:test'
import assert from 'node:assert/strict'
import { html } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'
import { parseFragment } from 'parse5'
import { renderWithSsrCompatibility } from '../src/runtime/lit-ssr-compat.mjs'

function elements(node, tag) {
  return [ ...(node.tagName === tag ? [node] : []),
    ...(node.childNodes ?? []).flatMap(child => elements(child, tag)) ]
}

test('marked textarea defaults round-trip text, escaping and leading newlines', async () => {
  for (const value of ['', 'Hello', '\nFirst\nSecond', '\n\n', '&amp; < > " \'', '</textarea><script>bad()</script>', '💌']) {
    const output = await renderWithSsrCompatibility(html`<textarea data-ssr-value=${value} .value=${live(value)}></textarea>`)
    const tree = parseFragment(output)
    assert.equal(elements(tree, 'script').length, 0)
    const [textarea] = elements(tree, 'textarea')
    assert.equal(textarea.childNodes.map(node => node.value ?? '').join(''), value)
  }
})

test('only marked textareas change; other bytes and Lit markers stay intact', async () => {
  const template = html`<p>${'Before'}</p><textarea .value=${'Unmarked'}></textarea><textarea data-ssr-value=${'One'}></textarea><textarea data-ssr-value=${'Two'}></textarea><p>${'After'}</p>`
  const original = await collectResult(render(template))
  const output = await renderWithSsrCompatibility(template)
  assert.equal(output.replace('>One</textarea>', '></textarea>').replace('>Two</textarea>', '></textarea>'), original)
})

test('conflicting textarea child content fails explicitly', async () => {
  await assert.rejects(renderWithSsrCompatibility(html`<textarea data-ssr-value=${'One'}>Two</textarea>`), /requires an empty textarea/)
})
