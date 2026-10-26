import test from 'node:test'
import assert from 'node:assert/strict'
import { from_list } from '#gleam/array'
import * as app from '../build/dev/javascript/glimlit/todos/todos.mjs'
import { newTodoKey } from '../build/dev/javascript/glimlit/todos/subscriptions.mjs'
import { run, createRuntime, stop } from '../src/runtime/runner.mjs'

function browser(t) {
  const target = new EventTarget()
  class FakeElement {
    constructor(kind = '', editable = false) { this.kind = kind; this.isContentEditable = editable }
    matches(selector) { return Boolean(this.kind && selector.split(', ').includes(this.kind)) }
    closest(selector) { return this.matches(selector) ? this : null }
  }
  for (const [name, value] of [['window', target], ['HTMLElement', FakeElement]]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { value, configurable: true })
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous)
      else delete globalThis[name]
    })
  }
  const key = (options = {}, element = new FakeElement()) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), {
      key: 'n', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
      isComposing: false, ...options,
    })
    Object.defineProperty(event, 'target', { value: element })
    if (options.prevented) event.preventDefault()
    target.dispatchEvent(event)
    return event
  }
  return { target, key, FakeElement }
}

test('todo keyboard source is inert, ignores editing and modified keys, and cleans up', t => {
  const { target, key, FakeElement } = browser(t)
  const add = t.mock.method(target, 'addEventListener')
  const remove = t.mock.method(target, 'removeEventListener')
  const values = []
  const source = newTodoKey(() => 'new todo')
  assert.equal(add.mock.callCount(), 0)
  const cleanup = source.start(value => values.push(value))
  assert.equal(key().defaultPrevented, true)
  assert.deepEqual(values, ['new todo'])
  for (const kind of ['input', 'textarea', 'select', 'dialog']) key({}, new FakeElement(kind))
  key({}, new FakeElement('', true))
  for (const options of [{ key: 'x' }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { repeat: true }, { isComposing: true }, { prevented: true }]) key(options)
  assert.deepEqual(values, ['new todo'])
  cleanup()
  assert.equal(remove.mock.calls[0].arguments[1], add.mock.calls[0].arguments[1])
  assert.equal(key().defaultPrevented, false)
  assert.equal(values.length, 1)
})

test('todo keyboard messages request a deferred focus effect and shutdown stops listening', async t => {
  const { target, key } = browser(t)
  const add = t.mock.method(target, 'addEventListener')
  const remove = t.mock.method(target, 'removeEventListener')
  const focus = []
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    getElementById: id => ({ focus: () => focus.push(id) }),
  } })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else delete globalThis.document
  })
  let [model, effects] = app.init()
  const runtime = createRuntime()
  t.after(() => stop(runtime))
  const pending = []
  const dispatch = message => {
    const [next, work] = app.update(model, message)
    model = next
    pending.push(...from_list(work))
  }
  assert.equal(add.mock.callCount(), 0)
  await run(from_list(effects)[1], dispatch, runtime)
  await run(from_list(effects)[1], dispatch, runtime)
  assert.equal(add.mock.callCount(), 1)
  assert.ok(app.ShortcutStatus$isListening(model.shortcut_status))
  key()
  assert.deepEqual(focus, [])
  assert.equal(pending.length, 1)
  await run(pending.pop(), dispatch, runtime)
  assert.deepEqual(focus, ['new-todo'])
  stop(runtime)
  assert.equal(remove.mock.callCount(), 1)
  key()
  assert.deepEqual(pending, [])
})

test('todo keyboard setup failure leaves the list usable and reports the missing shortcut', async t => {
  const { target } = browser(t)
  t.mock.method(target, 'addEventListener', () => { throw new Error('Unavailable') })
  const [model, effects] = app.init()
  const runtime = createRuntime()
  t.after(() => stop(runtime))
  let message
  await run(from_list(effects)[1], value => { message = value }, runtime)
  assert.ok(app.Msg$isKeyboardShortcutsFailed(message))
  const [failed] = app.update(model, message)
  assert.equal(failed.todos, model.todos)
  assert.ok(app.ShortcutStatus$isShortcutFailed(failed.shortcut_status))
  assert.equal(app.ShortcutStatus$ShortcutFailed$reason(failed.shortcut_status), 'Could not listen for key presses.')
})
