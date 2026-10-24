import test from 'node:test'
import assert from 'node:assert/strict'
import { from_list as toArray } from '#gleam/array'
import {
  init, update, tab_id,
  View, ModelAndUpdate, Effects,
  Next, Previous, First, Last,
  UserSelectedTab, UserNavigatedTab,
} from '../build/dev/javascript/glimlit/site/code_tabs/code_tabs.mjs'
import { run } from '../src/runtime/runner.mjs'

test('homepage clicks select tabs without moving focus or mutating the old model', () => {
  const [initial, initialEffects] = init()
  assert.equal(tab_id(initial.selected), 'view-tab')
  assert.deepEqual(toArray(initialEffects), [])
  const [next, effects] = update(initial, new UserSelectedTab(new Effects()))
  assert.equal(tab_id(next.selected), 'effects-tab')
  assert.equal(tab_id(initial.selected), 'view-tab')
  assert.deepEqual(toArray(effects), [])
})

test('homepage keyboard navigation wraps and defers focus until its effect runs', async t => {
  const previousDocument = globalThis.document
  const focused = []
  globalThis.document = { getElementById: id => ({ focus: () => focused.push(id) }) }
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  })
  const cases = [
    [new View(), new Previous(), 'effects-tab'],
    [new Effects(), new Next(), 'view-tab'],
    [new View(), new Next(), 'model-tab'],
    [new ModelAndUpdate(), new Next(), 'effects-tab'],
    [new Effects(), new Previous(), 'model-tab'],
    [new ModelAndUpdate(), new Previous(), 'view-tab'],
    [new ModelAndUpdate(), new First(), 'view-tab'],
    [new View(), new Last(), 'effects-tab'],
  ]
  for (const [from, direction, expected] of cases) {
    const [initial] = init()
    const before = focused.length
    const [next, effects] = update(initial, new UserNavigatedTab(from, direction))
    assert.equal(tab_id(next.selected), expected)
    assert.equal(focused.length, before)
    const work = toArray(effects)
    assert.equal(work.length, 1)
    await run(work[0], () => assert.fail('Focusing a tab should not send a message'))
    assert.equal(focused.at(-1), expected)
  }
})
