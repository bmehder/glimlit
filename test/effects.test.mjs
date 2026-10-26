import test from 'node:test';
import assert from 'node:assert/strict';
import { from_list as toArray, to_list as toList } from '#gleam/array';
import { init, update, Msg$UserTypedNewTodo, Msg$UserSubmittedNewTodo, Msg$UserToggledTodoCompletion, Msg$UserClickedDeleteTodo, Msg$UserClickedEditTodo, Msg$UserTypedTodoEdit, Msg$UserSubmittedTodoEdit,
  Msg$LocalStorageReturnedTodos, Msg$LocalStorageHadNoTodos,
  Msg$LocalStorageSavedTodos, Msg$LocalStorageFailed, StorageState$isFailed, StorageState$isReady,
  Msg$UserClickedRunEffectOrdering,
  Model$Model$storage, Status$isCompleted,
} from '../build/dev/javascript/glimlit/todos/todos.mjs';
import { run } from '../src/runtime/runner.mjs';
import { start } from '../build/dev/javascript/glimlit/runtime/mvu.mjs';

test('startup requests a load; only persisted edits request saving', () => {
  const [model, effects] = init();
  assert.deepEqual(toArray(effects)[0].onSuccess(null), Msg$LocalStorageHadNoTodos());
  const [draft, draftEffects] = update(model, Msg$UserTypedNewTodo('New todo'));
  assert.deepEqual(toArray(draftEffects), []);
  const [added, saves] = update(draft, Msg$UserSubmittedNewTodo());
  assert.equal(toArray(saves).length, 2);
  const [saved, followups] = update(added, Msg$LocalStorageSavedTodos());
  assert.ok(StorageState$isReady(Model$Model$storage(saved)));
  assert.deepEqual(toArray(followups), []);
});

test('load validates JSON, restores completion and IDs, and does not trigger a save', () => {
  const [initial] = init();
  const [loaded, effects] = update(initial, Msg$LocalStorageReturnedTodos('[{"id":9,"title":"Saved","status":"completed"}]'));
  assert.equal(loaded.next_id, 10);
  assert.ok(Status$isCompleted(toArray(loaded.todos)[0].status));
  assert.deepEqual(toArray(effects), []);
  const [empty] = update(initial, Msg$LocalStorageReturnedTodos('[]'));
  assert.deepEqual(toArray(empty.todos), []);
  for (const invalid of ['bad JSON', '{}', '[{"id":0,"title":"","status":"active"}]', '[{"id":0,"title":"A","status":"active"},{"id":0,"title":"B","status":"active"}]']) {
    const [failed] = update(initial, Msg$LocalStorageReturnedTodos(invalid));
    assert.ok(StorageState$isFailed(Model$Model$storage(failed)));
    assert.equal(failed.todos, initial.todos);
  }
  const [missing] = update(initial, Msg$LocalStorageHadNoTodos());
  assert.equal(missing.todos, initial.todos);
  const [failed] = update(loaded, Msg$LocalStorageFailed('Blocked'));
  assert.equal(failed.todos, loaded.todos);
});

const settle = () => new Promise(resolve => setImmediate(resolve));

test('effects start in list order and the second can finish before the first', async t => {
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    timers.push({ callback, milliseconds });
    return timers.length;
  });
  const logged = t.mock.method(console, 'log', () => {});
  const [initial] = init();
  const [next, effects] = update(initial, Msg$UserClickedRunEffectOrdering());
  assert.equal(next, initial);
  assert.equal(toArray(effects).length, 2);
  assert.equal(timers.length, 0);
  assert.equal(logged.mock.callCount(), 0);

  const dispose = start([initial, effects], (model, message) => {
    assert.fail('Logging effects should not dispatch messages');
  }, () => {});
  t.after(dispose);
  await settle();
  const logs = () => logged.mock.calls.map(call => call.arguments[0]);
  assert.deepEqual(logs(), ['First effect started', 'Second effect started']);
  assert.deepEqual(timers.map(timer => timer.milliseconds), [1000, 100]);

  timers[1].callback();
  await settle();
  assert.deepEqual(logs(), ['First effect started', 'Second effect started', 'Second effect finished']);
  timers[0].callback();
  await settle();
  assert.deepEqual(logs(), ['First effect started', 'Second effect started', 'Second effect finished', 'First effect finished']);
});

test('runtime renders before performing effects and callbacks use the latest model', async () => {
  const events = [];
  let send;
  const load = { perform: () => { events.push(['effect', 'load']); return 2; }, onSuccess: value => value };
  start([0, toList([load])], (model, msg) => [model + msg, toList([])], (model, dispatch) => {
    events.push(['view', model]); send = dispatch;
  });
  const firstSend = send;
  await settle();
  firstSend(3);
  firstSend(4);
  assert.deepEqual(events, [['view', 0], ['effect', 'load'], ['view', 2], ['view', 5], ['view', 9]]);
});

test('effect values save and load through callbacks and report storage failures', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage; });
  const [initial, initialEffects] = init();
  const messageFrom = effect => new Promise(resolve => { void run(effect, resolve); });
  assert.deepEqual(await messageFrom(toArray(initialEffects)[0]), Msg$LocalStorageHadNoTodos());
  const [changed, effects] = update(initial, Msg$UserToggledTodoCompletion(0));
  assert.deepEqual(await messageFrom(toArray(effects)[0]), Msg$LocalStorageSavedTodos());
  const [restored] = update(initial, await messageFrom(toArray(initialEffects)[0]));
  assert.deepEqual(toArray(restored.todos), toArray(changed.todos));
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  const [failed] = update(changed, await messageFrom(toArray(effects)[0]));
  assert.ok(StorageState$isFailed(Model$Model$storage(failed)));
});

test('effects returned by update run after rendering and dispatch their result', async () => {
  const events = [];
  let send;
  const save = { perform: () => { events.push(['effect', 'save']); return 10; }, onSuccess: value => value };
  start([0, toList([])], (model, msg) => [model + msg, toList(msg === 1 ? [save] : [])], (model, dispatch) => {
    events.push(['view', model]); send = dispatch;
  });
  send(1);
  await settle();
  assert.deepEqual(events, [['view', 0], ['view', 1], ['effect', 'save'], ['view', 11]]);
});

test('successful CRUD changes log alongside saving; failures can log alone', async t => {
  const logged = t.mock.method(console, 'log', () => {});
  const [initial] = init();
  const [draft] = update(initial, Msg$UserTypedNewTodo('New'));
  const [editing] = update(initial, Msg$UserClickedEditTodo(0));
  const [edited] = update(editing, Msg$UserTypedTodoEdit('Updated'));
  const cases = [
    [draft, Msg$UserSubmittedNewTodo(), 'Todo added.'],
    [initial, Msg$UserToggledTodoCompletion(0), 'Todo completion toggled.'],
    [edited, Msg$UserSubmittedTodoEdit(), 'Todo updated.'],
    [initial, Msg$UserClickedDeleteTodo(0), 'Todo deleted.'],
  ];
  for (const [model, message, expected] of cases) {
    const [, effects] = update(model, message);
    const values = toArray(effects);
    assert.equal(values.length, 2);
    const before = logged.mock.callCount();
    await run(values[1], () => assert.fail('Logging must not dispatch'));
    assert.deepEqual(logged.mock.calls[before].arguments, [expected]);
  }
  for (const message of [Msg$UserTypedNewTodo('Typing'), Msg$UserSubmittedNewTodo(), Msg$UserClickedDeleteTodo(999)]) {
    assert.deepEqual(toArray(update(initial, message)[1]), []);
  }
  const [, failureEffects] = update(initial, Msg$LocalStorageFailed('Blocked'));
  assert.equal(toArray(failureEffects).length, 1);
  await run(toArray(failureEffects)[0], () => assert.fail('Logging must not dispatch'));
  assert.deepEqual(logged.mock.calls.at(-1).arguments, ['Todo storage failed: Blocked']);
});
