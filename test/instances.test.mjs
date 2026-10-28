import test from 'node:test'
import assert from 'node:assert/strict'
import { createContext, contextForId } from '../src/runtime/instance.mjs'
import { createRuntime, run, stop } from '../src/runtime/runner.mjs'

function root(id) {
  return { nodeType: 1, id, hasAttribute: () => false }
}

test('server and browser contexts produce matching scoped IDs without global DOM access', () => {
  const element = root('postcard-one')
  const browser = createContext(element)
  const server = contextForId(element.id)
  assert.equal(browser.root, element)
  assert.equal(server.root, undefined)
  assert.equal(browser.id('title'), 'postcard-one-title')
  assert.equal(browser.id('title'), server.id('title'))
  assert.notEqual(browser.id('title'), createContext(root('postcard-two')).id('title'))
  assert.throws(() => contextForId(''), /stable root ID/)
  assert.throws(() => createContext({ ...root(''), hasAttribute: () => true }), /retain their server ID/)
})

test('unnamed browser roots receive distinct IDs while avoiding existing document IDs', () => {
  const first = root(''), second = root('')
  const elements = [first, second, root('glimlit-1')]
  const document = { getElementById: id => elements.find(element => element.id === id) ?? null }
  first.ownerDocument = second.ownerDocument = document
  const a = createContext(first), b = createContext(second)
  assert.notEqual(first.id, 'glimlit-1')
  assert.notEqual(first.id, second.id)
  assert.equal(a.id('field'), `${first.id}-field`)
  assert.equal(b.id('field'), `${second.id}-field`)
})

test('effect contexts and subscription lifetimes stay isolated between roots', async () => {
  const a = root('one'), b = root('two')
  const first = createRuntime(a), second = createRuntime(b)
  const contexts = [], messages = [], emitters = [], cleaned = []
  const watch = { perform(context) {
    contexts.push(context)
    context.subscriptions.start('same-key', { start(emit) {
      emitters.push(emit)
      return () => cleaned.push(context.root)
    } })
  } }
  try {
    await run(watch, message => messages.push(['one', message]), first)
    await run(watch, message => messages.push(['two', message]), second)
    assert.deepEqual(contexts.map(context => context.root), [a, b])
    assert.deepEqual(contexts.map(context => context.id('field')), ['one-field', 'two-field'])
    emitters[1]('hello')
    stop(first)
    emitters[0]('ignored')
    emitters[1]('still active')
    assert.deepEqual(messages, [['two', 'hello'], ['two', 'still active']])
    assert.deepEqual(cleaned, [a])
  } finally { stop(first); stop(second) }
  assert.deepEqual(cleaned, [a, b])
})
