import test from 'node:test';
import assert from 'node:assert/strict';
import { from_list as toArray } from '#gleam/array';
import { init, update, Msg$UserClickedIncrement, Msg$UserClickedDecrement, Msg$UserClickedReset } from '../build/dev/javascript/glimlit/counter/counter.mjs';

test('counter returns model/effect pairs and preserves the previous model', () => {
  const [initial, initialEffects] = init();
  assert.equal(initial.count, 0);
  assert.deepEqual(toArray(initialEffects), []);
  const [lower, effects] = update(initial, Msg$UserClickedDecrement());
  assert.equal(initial.count, 0);
  assert.equal(lower.count, -1);
  assert.deepEqual(toArray(effects), []);
  const [higher, incrementEffects] = update(lower, Msg$UserClickedIncrement());
  assert.equal(higher.count, 0);
  assert.deepEqual(toArray(incrementEffects), []);
  const [reset, resetEffects] = update(lower, Msg$UserClickedReset());
  assert.equal(reset.count, 0);
  assert.deepEqual(toArray(resetEffects), []);
});
