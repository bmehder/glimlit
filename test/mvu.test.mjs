import test from 'node:test';
import assert from 'node:assert/strict';
import { to_list as toList } from '#gleam/array';
import { start } from '../build/dev/javascript/glimlit/runtime/loop.mjs';

test('dispatch uses the latest model even through an earlier view callback', () => {
  const rendered = [];
  let dispatch;
  start([0, toList([])], (model, msg) => [model + msg, toList([])], (model, send) => {
    rendered.push(model);
    dispatch = send;
  }, () => {});
  const firstDispatch = dispatch;
  firstDispatch(1);
  firstDispatch(2);
  dispatch(-1);
  assert.deepEqual(rendered, [0, 1, 3, 2]);
});
