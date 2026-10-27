import test from 'node:test';
import assert from 'node:assert/strict';
import { from_list as toArray } from '#gleam/array';
import { createRuntime, run, stop } from '../src/runtime/runner.mjs';
import {
  init, update, Theme$Ocean, Theme$isOcean, Theme$isCoral, Theme$isMeadow,
  Notice$isSaving, Notice$isSaved, Notice$isSaveFailed, Notice$isRestoreFailed,
  Notice$isShortcutSetupFailed, Msg$KeyboardShortcutsFailed,
  Msg$UserChangedTitle, Msg$UserChangedMessage, Msg$UserSelectedTheme,
  Msg$UserClickedSave, Msg$UserClickedRestore, Msg$UserToggledShortcuts, Msg$UserPressedNextTheme,
  Msg$LocalStorageReturnedDesign as restored, Msg$LocalStorageWasEmpty as empty,
  Msg$LocalStorageSaveFailed as failed, Msg$KeyboardShortcutsChanged as shortcutsChanged,
} from '../build/dev/javascript/glimlit/postcard/postcard.mjs';

function themeName(theme) {
  if (Theme$isOcean(theme)) return 'ocean';
  if (Theme$isCoral(theme)) return 'coral';
  if (Theme$isMeadow(theme)) return 'meadow';
  throw new Error('Unknown theme');
}

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
  const [titled, titleEffects] = update(initial, Msg$UserChangedTitle('A weekend away'));
  const [written, messageEffects] = update(titled, Msg$UserChangedMessage('Hello <script>'));
  const [coloured, colourEffects] = update(written, Msg$UserSelectedTheme(Theme$Ocean()));
  assert.equal(coloured.title, 'A weekend away');
  assert.equal(coloured.message, 'Hello <script>');
  assert.equal(themeName(coloured.theme), 'ocean');
  assert.notEqual(initial.title, titled.title);
  assert.equal(initial.message, titled.message);
  assert.equal(themeName(initial.theme), 'coral');
  for (const effects of [titleEffects, messageEffects, colourEffects]) assert.deepEqual(toArray(effects), []);
});

test('saving is deferred, stores a snapshot, and reports success through update', async t => {
  const saved = new Map();
  let calls = 0;
  replaceGlobal(t, 'localStorage', { setItem(key, value) { calls++; saved.set(key, value); } });
  const [initial] = init();
  const [draft] = update(initial, Msg$UserChangedTitle('Saved title'));
  const [saving, effects] = update(draft, Msg$UserClickedSave());
  assert.equal(calls, 0);
  assert.ok(Notice$isSaving(saving.notice));
  const [newer] = update(saving, Msg$UserChangedTitle('Newer draft'));
  let message;
  await run(toArray(effects)[0], result => { message = result; });
  assert.deepEqual(JSON.parse(saved.get('glimlit.postcard.v1')), {
    title: 'Saved title', message: initial.message, theme: 'coral',
  });
  const [done] = update(newer, message);
  assert.equal(done.title, 'Newer draft');
  assert.ok(Notice$isSaved(done.notice));
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
  const [, effects] = update(enabled, Msg$UserClickedRestore());
  let message;
  await run(toArray(effects)[0], result => { message = result; });
  const [next, followups] = update(enabled, message);
  assert.equal(next.title, 'From the coast');
  assert.equal(next.message, 'See you soon');
  assert.equal(themeName(next.theme), 'meadow');
  assert.equal(next.shortcuts, true);
  assert.deepEqual(toArray(followups), []);
});

test('missing, invalid, and failed storage preserve the current draft', async t => {
  const [initial] = init();
  const [draft] = update(initial, Msg$UserChangedTitle('Keep my draft'));
  for (const message of [empty(), failed(),
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
  for (const request of [Msg$UserClickedSave(), Msg$UserClickedRestore()]) {
    const [, effects] = update(draft, request);
    let message;
    await run(toArray(effects)[0], result => { message = result; });
    const [next] = update(draft, message);
    assert.equal(next.title, draft.title);
    assert.ok(Notice$isSaveFailed(next.notice) || Notice$isRestoreFailed(next.notice));
  }
});

test('a missing storage entry produces an empty result', async t => {
  replaceGlobal(t, 'localStorage', { getItem: () => null });
  const [initial] = init();
  const [, effects] = update(initial, Msg$UserClickedRestore());
  let message;
  await run(toArray(effects)[0], result => { message = result; });
  assert.deepEqual(message, empty());
});

test('shortcut messages cycle every theme only while enabled', () => {
  const [initial] = init();
  assert.equal(update(initial, Msg$UserPressedNextTheme())[0], initial);
  let [model] = update(initial, shortcutsChanged(true));
  for (const expected of ['ocean', 'meadow', 'coral']) {
    [model] = update(model, Msg$UserPressedNextTheme());
    assert.equal(themeName(model.theme), expected);
    assert.equal(model.title, initial.title);
  }
});

test('shortcuts ignore editing and modifiers and clean up on disable and app stop', async t => {
  class FakeElement {
    constructor(editing = false) { this.editing = editing; this.isContentEditable = false; }
    matches() { return this.editing; }
    closest(selector) { return selector === 'dialog' && this.dialog ? this : null; }
  }
  const target = new EventTarget();
  replaceGlobal(t, 'window', target);
  replaceGlobal(t, 'HTMLElement', FakeElement);
  const add = t.mock.method(target, 'addEventListener');
  const remove = t.mock.method(target, 'removeEventListener');
  const runtime = createRuntime();
  t.after(() => stop(runtime));
  let [model] = init();
  const dispatch = message => { [model] = update(model, message); };
  async function toggle() {
    const [next, effects] = update(model, Msg$UserToggledShortcuts());
    model = next;
    await run(toArray(effects)[0], dispatch, runtime);
  }
  function key(options = {}, element = new FakeElement()) {
    const event = new Event('keydown', { cancelable: true });
    for (const [name, value] of Object.entries({ key: 'n', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, ...options })) {
      Object.defineProperty(event, name, { value });
    }
    Object.defineProperty(event, 'target', { value: element });
    if (options.prevented) event.preventDefault();
    target.dispatchEvent(event);
    return event;
  }
  assert.equal(add.mock.callCount(), 0);
  await toggle();
  assert.equal(model.shortcuts, true);
  assert.equal(add.mock.callCount(), 1);
  assert.equal(key().defaultPrevented, true);
  assert.equal(themeName(model.theme), 'ocean');
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }, { shiftKey: true }, { isComposing: true }, { prevented: true }, { key: 'x' }]) key(options);
  key({}, new FakeElement(true));
  const dialog = new FakeElement();
  dialog.dialog = true;
  key({}, dialog);
  const editable = new FakeElement();
  editable.isContentEditable = true;
  key({}, editable);
  assert.equal(themeName(model.theme), 'ocean');
  key({ key: 'N' });
  assert.equal(themeName(model.theme), 'meadow');
  await toggle();
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(remove.mock.calls[0].arguments[1], add.mock.calls[0].arguments[1]);
  key();
  assert.equal(themeName(model.theme), 'meadow');
  await toggle();
  stop(runtime);
  assert.equal(remove.mock.callCount(), 2);
  key();
  assert.equal(themeName(model.theme), 'meadow');
});


test('failed shortcut setup preserves the design and checkbox state', () => {
  const [initial] = init();
  const [next, effects] = update(initial, Msg$KeyboardShortcutsFailed());
  assert.equal(next.title, initial.title);
  assert.equal(next.message, initial.message);
  assert.equal(next.theme, initial.theme);
  assert.equal(next.shortcuts, initial.shortcuts);
  assert.ok(Notice$isShortcutSetupFailed(next.notice));
  assert.deepEqual(toArray(effects), []);
});
