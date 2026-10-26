import { createSubscriptions } from '../../src/runtime/subscriptions.mjs'
// These examples are type-checked, not executed. Each expected error must remain
// an error, so the checks fail if the generated/runtime types stop catching it.
import {
  Msg$UserTypedNewTodo,
  Model$Model$draft,
} from '../../build/dev/javascript/glimlit/todos/todos.mjs'

/** @typedef {import('../../build/dev/javascript/glimlit/todos/todos.mjs').Model$} Model */
/** @typedef {import('../../build/dev/javascript/glimlit/todos/todos.mjs').Msg$} Msg */

/** @param {Model} model @param {(message: Msg) => void} dispatch */
export function viewContract(model, dispatch) {
  dispatch(Msg$UserTypedNewTodo(Model$Model$draft(model)))
  // @ts-expect-error The generated constructor requires a string payload.
  Msg$UserTypedNewTodo(123)
  // @ts-expect-error The generated model has no such field.
  model.missingField
  // @ts-expect-error Dispatch accepts app messages, not arbitrary values.
  dispatch(123)
}

/** @type {import('../../src/runtime/runner.mjs').Effect<string, Msg>} */
export const validEffect = {
  perform: async () => 'Saved',
  onSuccess: title => Msg$UserTypedNewTodo(title),
  onFailure: () => Msg$UserTypedNewTodo('Could not save'),
}

/** @type {import('../../src/runtime/runner.mjs').Effect<string, Msg>} */
export const invalidEffect = {
  // @ts-expect-error perform must produce the annotated result type.
  perform: () => 123,
  // @ts-expect-error A result callback must return an app message.
  onSuccess: title => title,
}

/** @type {import('../../src/runtime/subscriptions.mjs').Subscription<Msg>} */
export const validSubscription = {
  start: emit => {
    emit(Msg$UserTypedNewTodo('Listening'))
    // @ts-expect-error emit accepts the annotated app message type.
    emit('not a message')
    return () => {}
  },
}

/** @type {import('../../src/runtime/subscriptions.mjs').Subscription<Msg>} */
export const invalidSubscription = {
  // @ts-expect-error Setup must return a synchronous cleanup function.
  start: () => {},
}

/** @type {import('../../src/runtime/subscriptions.mjs').Subscriptions<Msg>} */
export const subscriptionManager = createSubscriptions(message => {
  /** @type {Msg} */
  const appMessage = message;
  void appMessage;
});
subscriptionManager.start('valid', validSubscription);
// @ts-expect-error The manager already has its dispatcher; start accepts only key and source.
subscriptionManager.start('invalid-dispatch', validSubscription, () => {});
// @ts-expect-error Every source must emit this manager's app message type.
subscriptionManager.start('invalid-messages', { start: emit => { emit(123); return () => {}; } });
