import { createRuntime } from '../src/runtime/runner.mjs'
import test from 'node:test';
import assert from 'node:assert/strict';
import { to_list as toList } from '#gleam/array';
import { start_loop as start } from '../build/dev/javascript/glimlit/runtime/mvu.mjs';

test('dispatch uses the latest model even through an earlier view callback', () => {
  const rendered = [];
  let dispatch;
  start([0, toList([])], (model, msg) => [model + msg, toList([])], (model, send) => {
    rendered.push(model);
    dispatch = send;
  }, () => {}, createRuntime());
  const firstDispatch = dispatch;
  firstDispatch(1);
  firstDispatch(2);
  dispatch(-1);
  assert.deepEqual(rendered, [0, 1, 3, 2]);
});
