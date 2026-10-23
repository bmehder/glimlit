import test from 'node:test';
import assert from 'node:assert/strict';
import { from_list as toArray } from '#gleam/array';
import { init, update, UserClickedIncrement, UserClickedIncrementBy10, UserClickedDecrement, UserClickedReset } from '../build/dev/javascript/glimlit/counter/counter.mjs';

test('counter returns model/effect pairs and preserves the previous model', () => {
  const [initial, initialEffects] = init();
  assert.equal(initial.count, 0);
  assert.deepEqual(toArray(initialEffects), []);
  const [lower, effects] = update(initial, new UserClickedDecrement());
  assert.equal(initial.count, 0);
  assert.equal(lower.count, -1);
  assert.deepEqual(toArray(effects), []);
  const [higher] = update(lower, new UserClickedIncrement());
  const [ten, tenEffects] = update(higher, new UserClickedIncrementBy10());
  assert.equal(ten.count, 10);
  assert.deepEqual(toArray(tenEffects), []);
  const [reset, resetEffects] = update(ten, new UserClickedReset());
  assert.equal(reset.count, 0);
  assert.deepEqual(toArray(resetEffects), []);
});
