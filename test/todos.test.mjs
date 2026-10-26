import test from 'node:test';
import { from_list as toArray } from '#gleam/array';
import assert from 'node:assert/strict';
import {
  init as initWithEffects, update as updateWithEffects, StorageState$Ready, ShortcutStatus$Listening, Model$Model, Editing$NotEditing, Editing$isNotEditing,
  Editing$Editing$id, Editing$Editing$text, Status$isActive, Status$isCompleted, Msg$UserTypedNewTodo, Msg$UserSubmittedNewTodo,
  Msg$UserToggledTodoCompletion, Msg$UserClickedEditTodo, Msg$UserTypedTodoEdit,
  Msg$UserSubmittedTodoEdit, Msg$UserClickedCancelTodoEdit, Msg$UserClickedDeleteTodo,
} from '../build/dev/javascript/glimlit/todos/todos.mjs';

const init = () => initWithEffects()[0];
const update = (model, message) => updateWithEffects(model, message)[0];
const add = (model, text) => update(update(model, Msg$UserTypedNewTodo(text)), Msg$UserSubmittedNewTodo());
const items = model => toArray(model.todos);
const emptyModel = () => {
  let model = init();
  for (const item of items(model)) model = update(model, Msg$UserClickedDeleteTodo(item.id));
  return Model$Model(model.todos, '', 0, Editing$NotEditing(), StorageState$Ready(), ShortcutStatus$Listening());
};

test('add trims titles, rejects blanks, and allocates stable IDs after deletion', () => {
  const original = emptyModel();
  assert.equal(items(add(original, '  ')).length, 0);
  let model = add(original, '  Buy milk  ');
  assert.equal(items(model)[0].title, 'Buy milk');
  assert.equal(model.draft, '');
  assert.equal(items(original).length, 0);
  model = update(model, Msg$UserClickedDeleteTodo(0));
  model = add(model, 'Walk outside');
  assert.equal(items(model)[0].id, 1);
});

test('complete, edit, cancel, and save affect only the selected todo', () => {
  let model = add(add(emptyModel(), 'First'), 'Second');
  model = update(model, Msg$UserToggledTodoCompletion(1));
  assert.deepEqual(items(model).map(item => Status$isCompleted(item.status)), [false, true]);
  model = update(model, Msg$UserClickedEditTodo(1));
  assert.equal(Editing$Editing$text(model.editing), 'Second');
  model = update(model, Msg$UserTypedTodoEdit('Discard this'));
  model = update(model, Msg$UserClickedCancelTodoEdit());
  assert.equal(items(model)[1].title, 'Second');
  model = update(model, Msg$UserClickedEditTodo(1));
  model = update(model, Msg$UserTypedTodoEdit('   '));
  model = update(model, Msg$UserSubmittedTodoEdit());
  assert.equal(Editing$Editing$id(model.editing), 1);
  assert.equal(items(model)[1].title, 'Second');
  model = update(model, Msg$UserTypedTodoEdit('  Updated  '));
  model = update(model, Msg$UserSubmittedTodoEdit());
  assert.deepEqual(items(model).map(item => item.title), ['First', 'Updated']);
  assert.equal(Status$isCompleted(items(model)[1].status), true);
  assert.equal(Editing$isNotEditing(model.editing), true);
});

test('deleting an edited item clears editing state and preserves other items', () => {
  let model = add(add(emptyModel(), 'First'), 'Second');
  model = update(model, Msg$UserClickedEditTodo(0));
  model = update(model, Msg$UserClickedDeleteTodo(0));
  assert.equal(Editing$isNotEditing(model.editing), true);
  assert.deepEqual(items(model).map(item => item.title), ['Second']);
  assert.equal(update(model, Msg$UserClickedEditTodo(999)), model);
});

test('default todos are active and editing messages without an edit leave the model alone', () => {
  const model = init();
  assert.equal(items(model).length, 3);
  assert.ok(items(model).every(item => Status$isActive(item.status)));
  assert.equal(Editing$isNotEditing(model.editing), true);
  assert.equal(update(model, Msg$UserTypedTodoEdit('No active edit')), model);
  assert.equal(update(model, Msg$UserSubmittedTodoEdit()), model);
});

test('toggle is reversible and deleting another item preserves the current edit', () => {
  let model = add(add(emptyModel(), 'First'), 'Second');
  model = update(model, Msg$UserToggledTodoCompletion(0));
  model = update(model, Msg$UserToggledTodoCompletion(0));
  assert.equal(Status$isActive(items(model)[0].status), true);
  model = update(model, Msg$UserClickedEditTodo(1));
  model = update(model, Msg$UserTypedTodoEdit('Work in progress'));
  model = update(model, Msg$UserClickedDeleteTodo(0));
  assert.equal(Editing$Editing$id(model.editing), 1);
  assert.equal(Editing$Editing$text(model.editing), 'Work in progress');
  model = update(model, Msg$UserSubmittedTodoEdit());
  assert.equal(items(model)[0].title, 'Work in progress');
});
