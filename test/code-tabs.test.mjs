import test from 'node:test'
import assert from 'node:assert/strict'
import { from_list as toArray } from '#gleam/array'
import {
  init, update,
  Tab$isView, Tab$View, Tab$isModelAndUpdate, Tab$ModelAndUpdate, Tab$isEffects, Tab$Effects,
  Navigation$Next, Navigation$Previous, Navigation$First, Navigation$Last,
  Msg$UserSelectedTab, Msg$UserNavigatedTab,
} from '../build/dev/javascript/glimlit/site/code_tabs/code_tabs.mjs'
import { run } from '../src/runtime/runner.mjs'

test('homepage clicks select tabs without moving focus or mutating the old model', () => {
  const [initial, initialEffects] = init()
  assert.ok(Tab$isView(initial.selected))
  assert.deepEqual(toArray(initialEffects), [])
  const [next, effects] = update(initial, Msg$UserSelectedTab(Tab$Effects()))
  assert.ok(Tab$isEffects(next.selected))
  assert.ok(Tab$isView(initial.selected))
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
    [Tab$View(), Navigation$Previous(), 'effects-tab'],
    [Tab$Effects(), Navigation$Next(), 'view-tab'],
    [Tab$View(), Navigation$Next(), 'model-tab'],
    [Tab$ModelAndUpdate(), Navigation$Next(), 'effects-tab'],
    [Tab$Effects(), Navigation$Previous(), 'model-tab'],
    [Tab$ModelAndUpdate(), Navigation$Previous(), 'view-tab'],
    [Tab$ModelAndUpdate(), Navigation$First(), 'view-tab'],
    [Tab$View(), Navigation$Last(), 'effects-tab'],
  ]
  for (const [from, direction, expected] of cases) {
    const [initial] = init()
    const [selected] = update(initial, Msg$UserSelectedTab(from))
    const before = focused.length
    const [next, effects] = update(selected, Msg$UserNavigatedTab(direction))
    const matchesExpectedTab = { 'view-tab': Tab$isView, 'model-tab': Tab$isModelAndUpdate, 'effects-tab': Tab$isEffects }[expected]
    assert.ok(matchesExpectedTab(next.selected))
    assert.equal(focused.length, before)
    const work = toArray(effects)
    assert.equal(work.length, 1)
    await run(work[0], () => assert.fail('Focusing a tab should not send a message'))
    assert.equal(focused.at(-1), expected)
  }
})
