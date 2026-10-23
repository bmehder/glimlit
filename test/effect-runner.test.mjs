import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/runtime/runner.mjs';
import { loadTodos, saveTodos } from '../build/dev/javascript/glimlit/todos/effects.mjs';

test('constructing and storing effect values does not perform their work', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { assert.fail('Storage accessed during construction'); } });
  try {
    const descriptions = [loadTodos(), saveTodos('[]')];
    assert.ok(descriptions.every(effect => typeof effect.perform === 'function'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('runner executes arbitrary deferred work and dispatches its callback message', async () => {
  const messages = [];
  let calls = 0;
  const effect = {
    perform: () => { calls++; return 21; },
    onSuccess: value => ({ type: 'Calculated', value: value * 2 }),
  };
  assert.equal(calls, 0);
  await run(effect, message => messages.push(message));
  assert.equal(calls, 1);
  assert.deepEqual(messages, [{ type: 'Calculated', value: 42 }]);
});

test('runner supports async work and effects with no result callback', async () => {
  const messages = [];
  await run({ perform: async () => 'later', onSuccess: value => value }, message => messages.push(message));
  let performed = false;
  await run({ perform: () => { performed = true; } }, () => assert.fail('No callback means no dispatch'));
  assert.equal(performed, true);
  assert.deepEqual(messages, ['later']);
});

test('runner maps sync throws and async rejections through onFailure', async () => {
  const messages = [];
  const failure = new Error('Failed');
  for (const perform of [() => { throw failure; }, () => Promise.reject(failure)]) {
    await run({ perform, onFailure: error => error.message }, message => messages.push(message));
  }
  assert.deepEqual(messages, ['Failed', 'Failed']);
  await assert.rejects(run({ perform: () => { throw failure; } }, () => {}), /Failed/);
});

test('callback and dispatch errors are not relabeled as effect failures', async () => {
  let failureCalls = 0;
  const onFailure = () => { failureCalls++; return 'wrong'; };
  await assert.rejects(run({ perform: () => 1, onSuccess: () => { throw new Error('Callback error'); }, onFailure }, () => {}), /Callback error/);
  await assert.rejects(run({ perform: () => 1, onSuccess: value => value, onFailure }, () => { throw new Error('Dispatch error'); }), /Dispatch error/);
  assert.equal(failureCalls, 0);
});
