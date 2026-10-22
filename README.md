# Glimlet

**A small MVU framework for Gleam and lit-html.**

Gleam owns your model, messages, and pure update function. JavaScript views use
HTML templates and dispatch Gleam messages. Effects are values that describe work;
subscriptions are values that describe ongoing sources of messages.

The aim is to keep the whole loop understandable. There is one `start` function,
a small effect runner, and a subscription manager. No Lustre dependency, custom
HTML DSL, or app-specific effect interpreter.

This repository contains the framework and two working examples. It is currently
a browser application, rather than a separately published package. Server-side
rendering is not implemented.

## Run it

You need Gleam on your PATH, plus Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. The todo example runs by default. Vite compiles Gleam
and refreshes generated JavaScript declarations when Gleam files change. Views
and Tailwind styles also update during development.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Compile Gleam and bundle the app into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Compile Gleam and run the tests |
| `gleam format --check` | Check Gleam formatting |

To run the counter instead, switch the call in `src/mvu_lit.gleam` from
`todos.main()` to `counter.main()`.

## The loop

```text
message → update(model, message) → #(next_model, effects)
                                      │            │
                                      ▼            ▼
                                     view      run effects
                                      │            │
                                      └─ messages ──┘
```

Both `init` and `update` return a model and a list of effects. An empty list means
there is no work to perform. The runtime stores the new model, renders it, and then
runs the effects. Effect callbacks and view events send messages through the same
update function.

A minimal Gleam app looks like this:

```gleam
import runtime/effect.{type Effect}
import runtime/mvu

pub type Model {
  Model(count: Int)
}

pub type Msg {
  UserClickedIncrement
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(Model(count: 0), [])
}

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserClickedIncrement -> #(Model(count: model.count + 1), [])
  }
}

@external(javascript, "./counter_view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
```

The returned function stops the app and cleans up its subscriptions. The browser
entry point calls it when Vite disposes the module during development.

## Views are HTML templates

Views use ordinary lit-html templates, with JSDoc for editor checking:

```js
// @ts-check
import { html, render } from 'lit-html'
import {
  UserClickedIncrement,
  Model$Model$count as count,
} from './counter.mjs'

/**
 * @param {import('./counter.mjs').Model$} model
 * @param {(msg: import('./counter.mjs').Msg$) => void} dispatch
 */
export function view(model, dispatch) {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app mount element')

  render(html`
    <p>${count(model)}</p>
    <button @click=${() => dispatch(new UserClickedIncrement())}>
      Increment
    </button>
  `, app)
}
```

The imported constructors, accessor functions, and types come from Gleam's
compiled JavaScript and generated declarations. `Model$` and `Msg$` are generated
type names; names such as `Msg$HttpReturnedTodo` are generated constructor
functions that can be used as callbacks. No hand-maintained JavaScript copy of the
Gleam types is needed. `jsconfig.json` connects source imports to generated files.

Use source-and-event message names, such as `UserClickedIncrement`,
`HttpReturnedTodo`, and `WindowResized`. They make each update branch's trigger
clear.

## Effects describe work

An effect is an object with a deferred `perform` function and optional callbacks
that turn its result or failure into a message. Constructing an effect does
nothing.

For example, the todo app defines:

```js
export function saveTodos(json) {
  return {
    perform: () => localStorage.setItem(key, json),
    onSuccess: () => localStorageSavedTodos(),
    onFailure: () => localStorageFailed('Browser storage is unavailable.'),
  }
}
```

Gleam calls that constructor through a typed external declaration:

```gleam
@external(javascript, "./effects.mjs", "saveTodos")
fn save_todos(json: String) -> Effect(Msg)
```

An update branch can then return `#(next_model, [save_todos(json)])`. Model changes
and the effects they request stay together in that branch.

`perform` may return a plain value or a Promise. Logging needs only `perform`;
storage and fetch can provide success and failure callbacks. The runner schedules
work through Promises, including synchronous operations. Effects are started in
list order, but asynchronous work can finish in any order. Returning multiple
effects does not make one wait for another; use a returned message to request
work that depends on an earlier result.

The runner knows nothing about storage, HTTP, logging, or the app's messages.
Supply an `onFailure` when a failure should become a message. Unhandled failures
reject the runner's Promise; they do not automatically update the model.

## Subscriptions describe ongoing messages

A subscription has one operation: `start(emit)`, which returns a cleanup function.
Like an effect, its description is inert until used.

```js
export function every(milliseconds, onTick) {
  return {
    start: emit => {
      const timer = setInterval(() => emit(onTick(Date.now())), milliseconds)
      return () => clearInterval(timer)
    },
  }
}
```

Starting and stopping a subscription are ordinary effects:

```js
export function startClock() {
  return {
    perform: ({ subscriptions, dispatch }) =>
      subscriptions.start('clock', every(1000, clockTicked), dispatch),
    onSuccess: clockStarted,
    onFailure: () => clockSubscriptionFailed('Could not manage the clock.'),
  }
}

export function stopClock() {
  return {
    perform: ({ subscriptions }) => subscriptions.stop('clock'),
    onSuccess: clockStopped,
    onFailure: () => clockSubscriptionFailed('Could not manage the clock.'),
  }
}
```

The update function decides when to return these effects. A button can start a
subscription later; it does not have to start with the app. A success callback can
acknowledge setup through another message.

Each app has its own subscription manager, with independent string keys:

- Starting an active key does nothing; stopping a missing key is harmless.
- To change configuration, stop the key and start it again.
- Setup and cleanup are synchronous; emissions may happen during setup or later.
- A start acknowledgement means setup returned, not that a network connection opened.
- Stopping disables emissions before cleanup, so late callbacks are ignored.

The todo example includes both a clock and a window-resize listener. The resize
subscription emits the current size during setup and then listens for changes.
They start and stop independently using the same manager. Timers, browser events,
and other message sources use the same contract; their details belong in the app.

Stopping the app cleans up all subscriptions and ignores pending effect results
and stale view callbacks. It does not cancel an HTTP request already in progress.

## Project layout

```text
src/
  mvu_lit.gleam            Choose which example to start
  styles.css              Tailwind entry point
  counter/
    counter.gleam         Model, messages, init, update, and entry point
    counter_view.mjs      Counter template and button helper
  todos/
    todos.gleam           Model, messages, init, update, JSON, and helpers
    view.mjs         Todo templates
    effects.mjs           Storage, fetch, logging, and subscription effects
    subscriptions.mjs     Clock and window-resize descriptions
  runtime/
    mvu.gleam             Model storage, dispatch, and rendering loop
    browser.mjs           MutableRef implementation
    effect.gleam          Typed JavaScript effect boundary
    runner.mjs            Generic effect runner and app lifetime
    subscriptions.mjs     Generic subscription lifetime manager
```

Start reading with the counter. The todo example adds CRUD, localStorage,
fetching, and subscriptions. It starts with three todos when no saved data exists.
The fetch button logs a sample response without adding it to the list.

`index.html` mounts the app. `vite.config.mjs` connects Gleam, JavaScript source
views, and Tailwind. When adding app modules, follow its existing source aliases
so Vite serves editable JavaScript while resolving generated Gleam modules.
`gleam_javascript` supplies the official list-to-array conversion used by the todo
view.

The project keeps its internal Gleam package and entry module named `mvu_lit`.
The framework's working name is **Glimlet**: Gleam, lit, and a little runtime.
# glimlit
