import { createRuntime } from '../src/runtime/runner.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { html } from 'lit-html'
import { to_list } from '../build/dev/javascript/gleam_javascript/gleam/javascript/array.mjs'
import { start_loop as start } from '../build/dev/javascript/glimlit/runtime/mvu.mjs'
import { start as mount } from '../build/dev/javascript/glimlit/runtime/mvu.mjs'
import { initialViews } from '../scripts/initial-views.mjs'
import { renderInitial } from '../src/runtime/server.mjs'
import * as counter from '../build/dev/javascript/glimlit/counter/counter.mjs'
import { view as counterView } from '../build/dev/javascript/glimlit/counter/view.mjs'
import * as postcard from '../build/dev/javascript/glimlit/postcard/postcard.mjs'
import { view as postcardView } from '../build/dev/javascript/glimlit/postcard/view.mjs'
import * as tabs from '../build/dev/javascript/glimlit/code_tabs/code_tabs.mjs'
import { view as tabsView } from '../build/dev/javascript/glimlit/code_tabs/view.mjs'

test('the rendering layer commits the first view with real handlers before effects run', async () => {
  const events = []
  let click
  const effect = { perform: () => { events.push('effect'); return 10 }, onSuccess: value => value }
  const stop = start([0, to_list([effect])], (model, message) => [model + message, to_list([])],
    (model, dispatch) => ({ model, handleClick: () => dispatch(1) }),
    description => {
      events.push(['render', description.model])
      click = description.handleClick
    }, createRuntime())
  const firstClick = click
  assert.deepEqual(events, [['render', 0]])
  await new Promise(resolve => setImmediate(resolve))
  firstClick()
  assert.deepEqual(events, [['render', 0], 'effect', ['render', 10], ['render', 11]])
  stop()
  firstClick()
  assert.equal(events.length, 4)
})

test('initial HTML uses the same templates without executing browser effects', async () => {
  let performed = false
  const effect = { perform() { performed = true; throw new Error('Server ran browser work') } }
  const [model] = counter.init()
  const output = await renderInitial([model, to_list([effect])], counterView, 'counter')
  assert.match(output, /<output[^>]*>/)
  assert.match(output, /Increase count/)
  assert.match(output, /lit-part/)
  assert.equal(performed, false)

  const tabsHtml = await renderInitial(tabs.init(), tabsView, 'tabs')
  assert.equal((tabsHtml.match(/role="tabpanel"/g) ?? []).length, 3)
  assert.equal((tabsHtml.match(/ hidden/g) ?? []).length, 2)
  assert.ok(tabsHtml.includes('syntax-function'))
  assert.ok(!tabsHtml.includes('data-static-tab'))
})

test('Postcard templates are independent of the DOM and escape untrusted text', async () => {
  let [model] = postcard.init()
  ;[model] = postcard.update(model, postcard.Msg$UserChangedTitle('<script>alert("x")</script>'))
  const output = await renderInitial([model, to_list([])], postcardView, 'postcard')
  assert.ok(output.includes('&lt;script&gt;'))
  assert.ok(!output.includes('<script>'))
  assert.match(output, /postcard-coral/)
  assert.match(output, /for="postcard-postcard-title"/)
  assert.match(output, /id="postcard-postcard-title"/)
  // Lit SSR does not serialize textarea.value. This is a known blocker for
  // enabling Postcard prerendering on the website, not a framework workaround.
  assert.match(output, /<textarea[^>]*><\/textarea>/)
})

test('a rendering failure stops startup before any effects are scheduled', async () => {
  let performed = false
  assert.throws(() => start([0, to_list([{ perform() { performed = true } }])],
    model => [model, to_list([])], () => html`<p>Hello</p>`, () => { throw new Error('Hydration failed') }, createRuntime()), /Hydration failed/)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(performed, false)
})


test('public startup rejects missing roots and malformed marked HTML before starting effects', async () => {
  let performed = false
  const initial = [0, to_list([{ perform() { performed = true } }])]
  const update = model => [model, to_list([])]
  const view = () => html`<p>Hello</p>`
  for (const root of [null, undefined, () => {}]) {
    assert.throws(() => mount(initial, update, view, root), /Missing Glimlit mount element/)
  }
  const malformed = { id: 'marked', nodeType: 1, hasAttribute: () => true, childNodes: [] }
  assert.throws(() => mount(initial, update, view, malformed), /Marked Glimlit roots require initial HTML/)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(performed, false)
})

test('the host integration marks generated roots without changing app startup', async () => {
  const output = await initialViews().transformIndexHtml.handler('<div id="app"><!-- glimlit:counter --></div>')
  assert.match(output, /<div id="app" data-glimlit-ssr>/)
  assert.match(output, /lit-part/)
  assert.match(output, /Increase count/)
  assert.ok(!output.includes('glimlit:counter'))
})
