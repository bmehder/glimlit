import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubscriptions } from '../src/runtime/subscriptions.mjs';
import { createRuntime, run, stop } from '../src/runtime/runner.mjs';
import { start } from '../build/dev/javascript/mvu_lit/runtime/mvu.mjs';
import { from_list as toArray, to_list as toList } from '#gleam/array';
import {
  init, update, UserClickedStartClock, UserClickedStopClock,
  Msg$ClockStarted, Msg$ClockStopped, Msg$ClockTicked,
  clock_can_start, clock_can_stop,
} from '../build/dev/javascript/mvu_lit/todos/todos.mjs';

const settle = () => new Promise(resolve => setImmediate(resolve));

test('subscriptions are inert, keyed, independently stoppable, and suppress late messages', () => {
  const manager = createSubscriptions();
  const messages = [];
  let starts = 0, cleanups = 0, emit;
  const subscription = { start: send => { starts++; emit = send; return () => { cleanups++; send('cleanup'); }; } };
  assert.equal(starts, 0);
  manager.start('one', subscription, value => messages.push(value));
  const oldEmit = emit;
  manager.start('one', subscription, value => messages.push(value));
  assert.equal(starts, 1);
  manager.start('two', subscription, value => messages.push(value));
  manager.stop('one');
  oldEmit('late');
  emit('still active');
  manager.stop('one');
  assert.equal(cleanups, 1);
  assert.deepEqual(messages, ['still active']);
  manager.stopAll();
  assert.equal(cleanups, 2);
});

test('setup may emit immediately, and cleanup still runs if stopped during setup', () => {
  const manager = createSubscriptions();
  let cleaned = 0;
  manager.start('one', {
    start: emit => { emit('ready'); return () => { cleaned++; }; },
  }, () => manager.stop('one'));
  assert.equal(cleaned, 1);
});

test('failed setup can be retried and disposing tries all cleanup functions', () => {
  const manager = createSubscriptions();
  assert.throws(() => manager.start('one', { start() { throw new Error('Setup'); } }, () => {}), /Setup/);
  let cleaned = 0;
  manager.start('one', { start: () => () => { throw new Error('Cleanup'); } }, () => {});
  manager.start('two', { start: () => () => { cleaned++; } }, () => {});
  assert.throws(() => manager.stopAll(), AggregateError);
  assert.equal(cleaned, 1);
  assert.doesNotThrow(() => manager.stopAll());
});

test('the same contract works for event listeners, not just timers', async () => {
  const target = new EventTarget();
  const runtime = createRuntime();
  const messages = [];
  const subscription = {
    start: emit => {
      const listener = () => emit('changed');
      target.addEventListener('change', listener);
      return () => target.removeEventListener('change', listener);
    },
  };
  await run({ perform: ({ subscriptions, dispatch }) => subscriptions.start('events', subscription, dispatch), onSuccess: () => 'started' }, message => messages.push(message), runtime);
  target.dispatchEvent(new Event('change'));
  await run({ perform: ({ subscriptions }) => subscriptions.stop('events'), onSuccess: () => 'stopped' }, message => messages.push(message), runtime);
  target.dispatchEvent(new Event('change'));
  assert.deepEqual(messages, ['started', 'changed', 'stopped']);
  stop(runtime);
});

test('app runtimes are isolated and stopped apps ignore pending results', async () => {
  const first = createRuntime(), second = createRuntime();
  let cleaned = 0;
  const subscription = { start: () => () => { cleaned++; } };
  await run({ perform: ({ subscriptions, dispatch }) => subscriptions.start('same-key', subscription, dispatch), onSuccess: () => 'started' }, () => {}, first);
  await run({ perform: ({ subscriptions, dispatch }) => subscriptions.start('same-key', subscription, dispatch), onSuccess: () => 'started' }, () => {}, second);
  let resolve;
  const pending = run({ perform: () => new Promise(done => { resolve = done; }), onSuccess: value => value }, () => assert.fail('Disposed app dispatched'), first);
  await Promise.resolve();
  stop(first);
  resolve('late');
  await pending;
  assert.equal(cleaned, 1);
  stop(first);
  stop(second);
  assert.equal(cleaned, 2);
});

test('clock uses the existing effect path, reports start/stop, and can restart', async t => {
  let tick;
  const interval = t.mock.method(globalThis, 'setInterval', callback => { tick = callback; return 123; });
  const clear = t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(Date, 'now', () => 123456);
  const runtime = createRuntime();
  t.after(() => stop(runtime));
  const messages = [];
  const dispatch = message => messages.push(message);
  const [initial] = init();
  assert.equal(clock_can_start(initial), true);
  const [starting, effects] = update(initial, new UserClickedStartClock());
  assert.equal(interval.mock.callCount(), 0);
  assert.deepEqual(toArray(update(starting, new UserClickedStartClock())[1]), []);
  await run(toArray(effects)[0], dispatch, runtime);
  assert.deepEqual(messages.pop(), Msg$ClockStarted());
  const [running] = update(starting, Msg$ClockStarted());
  assert.equal(clock_can_stop(running), true);
  tick();
  assert.deepEqual(messages.pop(), Msg$ClockTicked(123456));
  const [ticked] = update(running, Msg$ClockTicked(123456));
  assert.equal(ticked.clock_time, 123456);
  const [stopping, stops] = update(ticked, new UserClickedStopClock());
  await run(toArray(stops)[0], dispatch, runtime);
  assert.deepEqual(messages.pop(), Msg$ClockStopped());
  assert.deepEqual(clear.mock.calls[0].arguments, [123]);
  tick();
  assert.deepEqual(messages, []);
  const [stopped] = update(stopping, Msg$ClockStopped());
  assert.equal(clock_can_start(stopped), true);
  assert.equal(update(stopped, Msg$ClockTicked(999))[0], stopped);
  await run(toArray(update(stopped, new UserClickedStartClock())[1])[0], dispatch, runtime);
  assert.equal(interval.mock.callCount(), 2);
});

test('start returns app cleanup and old view callbacks cannot update a stopped app', async () => {
  let send, cleaned = 0;
  const renders = [];
  const initialEffect = {
    perform: ({ subscriptions, dispatch }) => subscriptions.start('resource', { start: () => () => { cleaned++; } }, dispatch),
    onSuccess: () => 1,
  };
  const dispose = start([0, toList([initialEffect])], (model, message) => [model + message, toList([])], (model, dispatch) => { renders.push(model); send = dispatch; });
  await settle();
  dispose();
  send(10);
  await settle();
  assert.equal(cleaned, 1);
  assert.deepEqual(renders, [0, 1]);
});
