import test from 'node:test';
import assert from 'node:assert/strict';
import { from_list as toArray } from '#gleam/array';
import { createRuntime, run, stop } from '../src/runtime/runner.mjs';
import {
  init, update, UserClickedStartResize, UserClickedStopResize,
  UserClickedStartClock, UserClickedStopClock,
  resize_can_start, resize_can_stop, clock_can_stop,
} from '../build/dev/javascript/glimlit/todos/todos.mjs';

test('resize emits immediately, observes events, and stops independently of the clock', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = Object.assign(new EventTarget(), { innerWidth: 1280, innerHeight: 720 });
  Object.defineProperty(globalThis, 'window', { value: target, configurable: true });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'window', original); else delete globalThis.window; });
  const add = t.mock.method(target, 'addEventListener');
  const remove = t.mock.method(target, 'removeEventListener');
  let tick;
  t.mock.method(globalThis, 'setInterval', callback => { tick = callback; return 123; });
  const clear = t.mock.method(globalThis, 'clearInterval', () => {});
  const runtime = createRuntime();
  t.after(() => stop(runtime));
  let [model] = init();
  const todos = model.todos;
  const dispatch = message => { [model] = update(model, message); };
  async function send(message) {
    const [next, effects] = update(model, message);
    model = next;
    for (const effect of toArray(effects)) await run(effect, dispatch, runtime);
  }
  assert.equal(resize_can_start(model), true);
  await send(new UserClickedStartClock());
  await send(new UserClickedStartResize());
  assert.equal(resize_can_stop(model), true);
  assert.equal(clock_can_stop(model), true);
  assert.deepEqual([model.window_width, model.window_height], [1280, 720]);
  assert.equal(add.mock.callCount(), 1);
  await send(new UserClickedStartResize());
  assert.equal(add.mock.callCount(), 1);
  target.innerWidth = 900;
  target.innerHeight = 600;
  target.dispatchEvent(new Event('resize'));
  assert.deepEqual([model.window_width, model.window_height], [900, 600]);
  await send(new UserClickedStopClock());
  target.innerWidth = 800;
  target.dispatchEvent(new Event('resize'));
  assert.equal(model.window_width, 800);
  await send(new UserClickedStartClock());
  await send(new UserClickedStopResize());
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(remove.mock.calls[0].arguments[1], add.mock.calls[0].arguments[1]);
  target.innerWidth = 700;
  target.dispatchEvent(new Event('resize'));
  assert.equal(model.window_width, 800);
  tick();
  assert.ok(model.clock_time > 0);
  assert.equal(clock_can_stop(model), true);
  assert.equal(resize_can_start(model), true);
  assert.equal(model.todos, todos);
  assert.equal(clear.mock.callCount(), 1);
  await send(new UserClickedStartResize());
  assert.equal(model.window_width, 700);
  stop(runtime);
  assert.equal(remove.mock.callCount(), 2);
  assert.equal(clear.mock.callCount(), 2);
});
