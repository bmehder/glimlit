import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubscriptions } from '../src/runtime/subscriptions.mjs';
import { createRuntime, run, stop } from '../src/runtime/runner.mjs';
import { start } from '../build/dev/javascript/glimlit/runtime/loop.mjs';
import { from_list as toArray, to_list as toList } from '#gleam/array';

const settle = () => new Promise(resolve => setImmediate(resolve));

test('subscriptions are inert, keyed, independently stoppable, and suppress late messages', () => {
  const manager = createSubscriptions(value => messages.push(value));
  const messages = [];
  let starts = 0, cleanups = 0, emit;
  const subscription = { start: send => { starts++; emit = send; return () => { cleanups++; send('cleanup'); }; } };
  assert.equal(starts, 0);
  manager.start('one', subscription);
  const oldEmit = emit;
  manager.start('one', subscription);
  assert.equal(starts, 1);
  manager.start('two', subscription);
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
  const manager = createSubscriptions(() => manager.stop('one'));
  let cleaned = 0;
  manager.start('one', {
    start: emit => { emit('ready'); return () => { cleaned++; }; },
  });
  assert.equal(cleaned, 1);
});

test('failed setup can be retried and disposing tries all cleanup functions', () => {
  const manager = createSubscriptions(() => {});
  assert.throws(() => manager.start('one', { start() { throw new Error('Setup'); } }), /Setup/);
  let cleaned = 0;
  manager.start('one', { start: () => () => { throw new Error('Cleanup'); } });
  manager.start('two', { start: () => () => { cleaned++; } });
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
  await run({ perform: ({ subscriptions }) => subscriptions.start('events', subscription), onSuccess: () => 'started' }, message => messages.push(message), runtime);
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
  await run({ perform: ({ subscriptions }) => subscriptions.start('same-key', subscription), onSuccess: () => 'started' }, () => {}, first);
  await run({ perform: ({ subscriptions }) => subscriptions.start('same-key', subscription), onSuccess: () => 'started' }, () => {}, second);
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

test('start returns app cleanup and old view callbacks cannot update a stopped app', async () => {
  let send, cleaned = 0;
  const renders = [];
  const initialEffect = {
    perform: ({ subscriptions }) => subscriptions.start('resource', { start: () => () => { cleaned++; } }),
    onSuccess: () => 1,
  };
  const dispose = start([0, toList([initialEffect])], (model, message) => [model + message, toList([])], (model, dispatch) => { renders.push(model); send = dispatch; }, () => {});
  await settle();
  dispose();
  send(10);
  await settle();
  assert.equal(cleaned, 1);
  assert.deepEqual(renders, [0, 1]);
});

test('all sources share their app dispatcher across renders while separate apps stay isolated', async t => {
  function mount(initial) {
    const emitters = new Map();
    const cleaned = [];
    const rendered = [];
    let send;
    const watch = key => ({
      perform: ({ subscriptions }) => subscriptions.start(key, {
        start: emit => {
          emitters.set(key, emit);
          return () => cleaned.push(key);
        },
      }),
    });
    const dispose = start([initial, toList([
      { perform: () => 1, onSuccess: value => ({ add: value }) },
      watch('first'),
    ])], (model, message) => message.watch
      ? [model, toList([watch(message.watch)])]
      : [model + message.add, toList([])], (model, dispatch) => {
      rendered.push(model);
      send = dispatch;
    }, () => {});
    t.after(dispose);
    return { emitters, cleaned, rendered, dispose, send: message => send(message) };
  }
  const first = mount(0), second = mount(100);
  await settle();
  first.send({ add: 10 });
  first.send({ watch: 'second' });
  await settle();
  first.emitters.get('first')({ add: 2 });
  first.emitters.get('second')({ add: 3 });
  second.emitters.get('first')({ add: 4 });
  assert.equal(first.rendered.at(-1), 16);
  assert.equal(second.rendered.at(-1), 105);
  first.dispose();
  first.emitters.get('first')({ add: 1000 });
  first.emitters.get('second')({ add: 1000 });
  second.emitters.get('first')({ add: 5 });
  assert.equal(first.rendered.at(-1), 16);
  assert.equal(second.rendered.at(-1), 110);
  assert.deepEqual(first.cleaned, ['first', 'second']);
  assert.deepEqual(second.cleaned, []);
});

test('a runtime can stop before its first effect without creating sources or sending results', async () => {
  const runtime = createRuntime();
  stop(runtime);
  stop(runtime);
  await run({ perform: () => assert.fail('Stopped runtime ran work'), onSuccess: () => 'late' },
    () => assert.fail('Stopped runtime dispatched'), runtime);
  assert.equal(runtime.subscriptions, null);
});
