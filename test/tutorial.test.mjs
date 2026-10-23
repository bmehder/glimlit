import test from 'node:test';
import assert from 'node:assert/strict';
import { from_list as toArray } from '#gleam/array';
import { createRuntime, run, stop } from '../src/runtime/runner.mjs';
import {
  init, update, theme_name, Ocean,
  UserChangedTitle, UserChangedMessage, UserSelectedTheme,
  UserClickedSave, UserClickedRestore, UserToggledShortcuts, UserPressedNextTheme,
  Msg$StorageReturnedDesign as restored, Msg$StorageWasEmpty as empty,
  Msg$StorageFailed as failed, Msg$ShortcutsChanged as shortcutsChanged,
} from '../build/dev/javascript/glimlit/tutorial/tutorial.mjs';

function replaceGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else delete globalThis[name];
  });
}

test('postcard editing is immutable and preserves unrelated fields', () => {
  const [initial, initialEffects] = init();
  assert.deepEqual(toArray(initialEffects), []);
  const [titled, titleEffects] = update(initial, new UserChangedTitle('A weekend away'));
  const [written, messageEffects] = update(titled, new UserChangedMessage('Hello <script>'));
  const [coloured, colourEffects] = update(written, new UserSelectedTheme(new Ocean()));
  assert.equal(coloured.title, 'A weekend away');
  assert.equal(coloured.message, 'Hello <script>');
  assert.equal(theme_name(coloured.theme), 'ocean');
  assert.notEqual(initial.title, titled.title);
  assert.equal(initial.message, titled.message);
  assert.equal(theme_name(initial.theme), 'coral');
  for (const effects of [titleEffects, messageEffects, colourEffects]) assert.deepEqual(toArray(effects), []);
});

test('saving is deferred, stores a snapshot, and reports success through update', async t => {
  const saved = new Map();
  let calls = 0;
  replaceGlobal(t, 'localStorage', { setItem(key, value) { calls++; saved.set(key, value); } });
  const [initial] = init();
  const [draft] = update(initial, new UserChangedTitle('Saved title'));
  const [saving, effects] = update(draft, new UserClickedSave());
  assert.equal(calls, 0);
  assert.match(saving.notice, /Saving/);
  const [newer] = update(saving, new UserChangedTitle('Newer draft'));
  let message;
  await run(toArray(effects)[0], result => { message = result; });
  assert.deepEqual(JSON.parse(saved.get('glimlit.postcard.v1')), {
    title: 'Saved title', message: initial.message, theme: 'coral',
  });
  const [done] = update(newer, message);
  assert.equal(done.title, 'Newer draft');
  assert.match(done.notice, /Saved in this browser/);
});

test('restoring saved JSON restores the design and preserves shortcut state', async t => {
  replaceGlobal(t, 'localStorage', {
    getItem(key) {
      assert.equal(key, 'glimlit.postcard.v1');
      return JSON.stringify({ title: 'From the coast', message: 'See you soon', theme: 'meadow' });
    },
  });
  const [initial] = init();
  const [enabled] = update(initial, shortcutsChanged(true));
  const [, effects] = update(enabled, new UserClickedRestore());
  let message;
  await run(toArray(effects)[0], result => { message = result; });
  const [next, followups] = update(enabled, message);
  assert.equal(next.title, 'From the coast');
  assert.equal(next.message, 'See you soon');
  assert.equal(theme_name(next.theme), 'meadow');
  assert.equal(next.shortcuts, true);
  assert.deepEqual(toArray(followups), []);
});

test('missing, invalid, and failed storage preserve the current draft', async t => {
  const [initial] = init();
  const [draft] = update(initial, new UserChangedTitle('Keep my draft'));
  for (const message of [empty(), failed('Storage blocked'),
    ...['not JSON', '{}', 'null', '[]', '{"title":4,"message":"Hi","theme":"coral"}',
      '{"title":"Hi","message":"Hi","theme":"unknown"}'].map(restored),
  ]) {
    const [next] = update(draft, message);
    assert.equal(next.title, draft.title);
    assert.equal(next.message, draft.message);
    assert.equal(next.theme, draft.theme);
    assert.notEqual(next.notice, draft.notice);
  }
  replaceGlobal(t, 'localStorage', {
    setItem() { throw new Error('Quota'); }, getItem() { throw new Error('Blocked'); },
  });
  for (const request of [new UserClickedSave(), new UserClickedRestore()]) {
    const [, effects] = update(draft, request);
    let message;
    await run(toArray(effects)[0], result => { message = result; });
    const [next] = update(draft, message);
    assert.equal(next.title, draft.title);
    assert.match(next.notice, /Could not/);
  }
});

test('a missing storage entry produces an empty result', async t => {
  replaceGlobal(t, 'localStorage', { getItem: () => null });
  const [initial] = init();
  const [, effects] = update(initial, new UserClickedRestore());
  let message;
  await run(toArray(effects)[0], result => { message = result; });
  assert.deepEqual(message, empty());
});

test('shortcut messages cycle every theme only while enabled', () => {
  const [initial] = init();
  assert.equal(update(initial, new UserPressedNextTheme())[0], initial);
  let [model] = update(initial, shortcutsChanged(true));
  for (const expected of ['ocean', 'meadow', 'coral']) {
    [model] = update(model, new UserPressedNextTheme());
    assert.equal(theme_name(model.theme), expected);
    assert.equal(model.title, initial.title);
  }
});

test('shortcuts ignore editing and modifiers and clean up on disable and app stop', async t => {
  class FakeElement {
    constructor(editing = false) { this.editing = editing; this.isContentEditable = false; }
    closest() { return this.editing ? this : null; }
  }
  const target = new EventTarget();
  replaceGlobal(t, 'window', target);
  replaceGlobal(t, 'Element', FakeElement);
  const add = t.mock.method(target, 'addEventListener');
  const remove = t.mock.method(target, 'removeEventListener');
  const runtime = createRuntime();
  t.after(() => stop(runtime));
  let [model] = init();
  const dispatch = message => { [model] = update(model, message); };
  async function toggle() {
    const [next, effects] = update(model, new UserToggledShortcuts());
    model = next;
    await run(toArray(effects)[0], dispatch, runtime);
  }
  function key(options = {}, element = new FakeElement()) {
    const event = new Event('keydown');
    for (const [name, value] of Object.entries({ key: 'n', repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...options })) {
      Object.defineProperty(event, name, { value });
    }
    Object.defineProperty(event, 'target', { value: element });
    target.dispatchEvent(event);
  }
  assert.equal(add.mock.callCount(), 0);
  await toggle();
  assert.equal(model.shortcuts, true);
  assert.equal(add.mock.callCount(), 1);
  key();
  assert.equal(theme_name(model.theme), 'ocean');
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }, { key: 'x' }]) key(options);
  key({}, new FakeElement(true));
  const editable = new FakeElement();
  editable.isContentEditable = true;
  key({}, editable);
  assert.equal(theme_name(model.theme), 'ocean');
  key({ key: 'N' });
  assert.equal(theme_name(model.theme), 'meadow');
  await toggle();
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(remove.mock.calls[0].arguments[1], add.mock.calls[0].arguments[1]);
  key();
  assert.equal(theme_name(model.theme), 'meadow');
  await toggle();
  stop(runtime);
  assert.equal(remove.mock.callCount(), 2);
  key();
  assert.equal(theme_name(model.theme), 'meadow');
});
