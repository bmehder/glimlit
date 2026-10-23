import test from 'node:test';
import assert from 'node:assert/strict';
import { from_list as toArray } from '#gleam/array';
import { run } from '../src/runtime/runner.mjs';
import { init, update, UserClickedFetchTodo, is_fetching, fetch_message } from '../build/dev/javascript/glimlit/todos/todos.mjs';

async function resultOf(effect) {
  let message;
  await run(effect, value => { message = value; });
  return message;
}

test('fetch is deferred until run, updates its state, and logs the response', async t => {
  const body = '{"id":1,"title":"Example"}';
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(body));
  const logMock = t.mock.method(console, 'log', () => {});
  const [initial] = init();
  const [loading, effects] = update(initial, new UserClickedFetchTodo());
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(is_fetching(loading), true);
  const [stillLoading, duplicateEffects] = update(loading, new UserClickedFetchTodo());
  assert.equal(stillLoading, loading);
  assert.deepEqual(toArray(duplicateEffects), []);
  const response = await resultOf(toArray(effects)[0]);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ['https://jsonplaceholder.typicode.com/todos/1']);
  const [fetched, logs] = update(loading, response);
  assert.equal(is_fetching(fetched), false);
  assert.equal(fetched.todos, initial.todos);
  assert.match(fetch_message(fetched), /logged/);
  await run(toArray(logs)[0], () => assert.fail('Log must not dispatch'));
  assert.deepEqual(logMock.mock.calls[0].arguments, [`Fetched example todo: ${body}`]);
  assert.equal(toArray(update(fetched, new UserClickedFetchTodo())[1]).length, 1);
});

test('HTTP and network failures produce failure messages and allow retry', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  for (const expected of ['HTTP 503', 'Offline']) {
    if (expected === 'Offline') fetchMock.mock.mockImplementation(async () => { throw new Error('Offline'); });
    const [initial] = init();
    const [loading, effects] = update(initial, new UserClickedFetchTodo());
    const [failed, logs] = update(loading, await resultOf(toArray(effects)[0]));
    assert.equal(is_fetching(failed), false);
    assert.ok(fetch_message(failed).includes(expected));
    assert.equal(failed.todos, initial.todos);
    assert.equal(toArray(logs).length, 1);
    assert.equal(toArray(update(failed, new UserClickedFetchTodo())[1]).length, 1);
  }
});
