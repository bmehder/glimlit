import test from 'node:test';
import { from_list as toArray } from '#gleam/array';
import assert from 'node:assert/strict';
import {
  init as initWithEffects, update as updateWithEffects, Ready, NotRequested, Stopped, Model$Model, Editing$NotEditing, Editing$isNotEditing,
  Editing$Editing$id, Editing$Editing$text, Status$isActive, Status$isCompleted, UserTypedNewTodo, UserSubmittedNewTodo,
  UserToggledTodoCompletion, UserClickedEditTodo, UserTypedTodoEdit,
  UserSubmittedTodoEdit, UserClickedCancelTodoEdit, UserClickedDeleteTodo,
} from '../build/dev/javascript/glimlit/todos/todos.mjs';

const init = () => initWithEffects()[0];
const update = (model, message) => updateWithEffects(model, message)[0];
const add = (model, text) => update(update(model, new UserTypedNewTodo(text)), new UserSubmittedNewTodo());
const items = model => toArray(model.todos);
const emptyModel = () => {
  let model = init();
  for (const item of items(model)) model = update(model, new UserClickedDeleteTodo(item.id));
  return Model$Model(model.todos, '', 0, Editing$NotEditing(), new Ready(), new NotRequested(), new Stopped(), 0, new Stopped(), 0, 0);
};

test('add trims titles, rejects blanks, and allocates stable IDs after deletion', () => {
  const original = emptyModel();
  assert.equal(items(add(original, '  ')).length, 0);
  let model = add(original, '  Buy milk  ');
  assert.equal(items(model)[0].title, 'Buy milk');
  assert.equal(model.draft, '');
  assert.equal(items(original).length, 0);
  model = update(model, new UserClickedDeleteTodo(0));
  model = add(model, 'Walk outside');
  assert.equal(items(model)[0].id, 1);
});

test('complete, edit, cancel, and save affect only the selected todo', () => {
  let model = add(add(emptyModel(), 'First'), 'Second');
  model = update(model, new UserToggledTodoCompletion(1));
  assert.deepEqual(items(model).map(item => Status$isCompleted(item.status)), [false, true]);
  model = update(model, new UserClickedEditTodo(1));
  assert.equal(Editing$Editing$text(model.editing), 'Second');
  model = update(model, new UserTypedTodoEdit('Discard this'));
  model = update(model, new UserClickedCancelTodoEdit());
  assert.equal(items(model)[1].title, 'Second');
  model = update(model, new UserClickedEditTodo(1));
  model = update(model, new UserTypedTodoEdit('   '));
  model = update(model, new UserSubmittedTodoEdit());
  assert.equal(Editing$Editing$id(model.editing), 1);
  assert.equal(items(model)[1].title, 'Second');
  model = update(model, new UserTypedTodoEdit('  Updated  '));
  model = update(model, new UserSubmittedTodoEdit());
  assert.deepEqual(items(model).map(item => item.title), ['First', 'Updated']);
  assert.equal(Status$isCompleted(items(model)[1].status), true);
  assert.equal(Editing$isNotEditing(model.editing), true);
});

test('deleting an edited item clears editing state and preserves other items', () => {
  let model = add(add(emptyModel(), 'First'), 'Second');
  model = update(model, new UserClickedEditTodo(0));
  model = update(model, new UserClickedDeleteTodo(0));
  assert.equal(Editing$isNotEditing(model.editing), true);
  assert.deepEqual(items(model).map(item => item.title), ['Second']);
  assert.equal(update(model, new UserClickedEditTodo(999)), model);
});

test('default todos are active and editing messages without an edit leave the model alone', () => {
  const model = init();
  assert.equal(items(model).length, 3);
  assert.ok(items(model).every(item => Status$isActive(item.status)));
  assert.equal(Editing$isNotEditing(model.editing), true);
  assert.equal(update(model, new UserTypedTodoEdit('No active edit')), model);
  assert.equal(update(model, new UserSubmittedTodoEdit()), model);
});

test('toggle is reversible and deleting another item preserves the current edit', () => {
  let model = add(add(emptyModel(), 'First'), 'Second');
  model = update(model, new UserToggledTodoCompletion(0));
  model = update(model, new UserToggledTodoCompletion(0));
  assert.equal(Status$isActive(items(model)[0].status), true);
  model = update(model, new UserClickedEditTodo(1));
  model = update(model, new UserTypedTodoEdit('Work in progress'));
  model = update(model, new UserClickedDeleteTodo(0));
  assert.equal(Editing$Editing$id(model.editing), 1);
  assert.equal(Editing$Editing$text(model.editing), 'Work in progress');
  model = update(model, new UserSubmittedTodoEdit());
  assert.equal(items(model)[0].title, 'Work in progress');
});
