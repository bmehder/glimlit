<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/glimlit-wordmark-dark.svg">
    <img src="public/brand/glimlit-wordmark-light.svg" alt="Glimlit" width="240" height="64">
  </picture>
</h1>

**A small MVU framework for Gleam and lit-html.**

Glimlit gives developers who enjoy the Model–View–Update approach of Elm and
Gleam frameworks such as Lustre another option for writing the view: JavaScript
tagged template literals with lit-html, alongside models and updates in Gleam.

Gleam owns your model, messages, and pure update function. JavaScript views
dispatch Gleam messages. Effects are values that describe work; subscriptions
are values that describe ongoing sources of messages.

The aim is to keep the whole loop understandable. There is one `start` function,
a small effect runner, and a subscription manager.

This repository contains the framework and three working examples. It is currently
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
| `npm run test:tutorial-checkpoints` | Compile and check all six tutorial checkpoints |
| `gleam format --check` | Check Gleam formatting |

To run the counter instead, switch the call in `src/glimlit.gleam` from
`todos.main()` to `counter.main()`.

## Build your first app

Open **[/tutorial/](http://127.0.0.1:3000/tutorial/)** on the development server
for a guided introduction to Glimlit. You’ll build **Postcard Studio**, an editor
with a live preview, colour themes, browser storage, and optional keyboard
shortcuts. It assumes basic web development and JavaScript knowledge, and
introduces Gleam, lit-html, and Model–View–Update as you go.

Six complete checkpoints in `docs/tutorial/` start with a static view, add
editing and themes without effects, then introduce saving, restoring, and
subscriptions. The finished app lives in `src/tutorial/`. The tutorial page is
also included in production builds and linked from the main demo.

## The loop

![The MVU loop: Update produces a Model, the Model is rendered by the View, and user events produce Messages that return to Update with the current Model. Update can also request effects, whose result messages return to Update.](docs/mvu-loop.svg)

Both `init` and `update` return a model and a list of effects. An empty list means
there is no work to perform. The runtime stores the new model, renders it, and then
runs the effects. View events and effect callbacks send messages back to `update`,
along with the current model, completing the loop.

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

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
```

The returned function stops the app and cleans up its subscriptions.

## Views with lit-html

Elm and Lustre express elements, attributes, and event handlers as function calls
in Elm and Gleam respectively. With lit-html, views use JavaScript tagged template
literals: the `html` tag processes HTML-like markup with `${...}` expressions
for dynamic content and bindings such as `@click` for event handlers. These are
JavaScript expressions, rather than standalone HTML documents. See
[Lit's template syntax](https://lit.dev/docs/templates/overview/).

For example, here is a counter view in Lustre, following its
[view and event conventions](https://lustre.hexdocs.pm/guide/01-quickstart.html):

```gleam
import gleam/int
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

pub type Model {
  Model(count: Int)
}

pub type Msg {
  UserClickedIncrement
}

pub fn view(model: Model) -> Element(Msg) {
  html.div([], [
    html.p([], [html.text(int.to_string(model.count))]),
    html.button([event.on_click(UserClickedIncrement)], [
      html.text("Increment"),
    ]),
  ])
}
```

The equivalent Glimlit view imports the message constructor and model accessor
from Gleam's compiled `counter.mjs` module:

```js
import { html, render } from 'lit-html'
import {
  UserClickedIncrement,
  Model$Model$count as count,
} from './counter.mjs'

export function view(model, dispatch) {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app mount element')

  render(html`
    <div>
      <p>${count(model)}</p>
      <button @click=${() => dispatch(new UserClickedIncrement())}>
        Increment
      </button>
    </div>
  `, app)
}
```

Both display the count and send a message when the button is clicked. In the
Glimlit example, the click handler constructs a Gleam message and dispatches it
to `update`. Gleam still owns the model and update logic.

The difference is how you express the interface. The HTML-like syntax can feel
familiar to developers coming from web design or JavaScript, and existing HTML
markup can be adapted by adding lit-html bindings rather than translating each
tag into a function call.

There is a tradeoff: Lustre keeps the view in Gleam, where the compiler checks
element and message types together. Glimlit's JavaScript view crosses that
language boundary, so the Gleam compiler does not check the template or its
event handlers. The view can still be typed using TypeScript, or JSDoc annotations
with JavaScript type checking enabled. Those checks can cover model access,
message construction, and dispatch calls using the generated Gleam declarations;
they do not automatically validate all markup or lit-html bindings. See
[TypeScript's JavaScript type checking documentation](https://www.typescriptlang.org/docs/handbook/checking-javascript-files.html).

The choice is about which authoring style and tradeoffs suit your project;
neither syntax is inherently better.

## Effects describe work

An effect is an object with a deferred `perform` function and optional callbacks
that turn its result or failure into a message. Constructing an effect does
nothing.

The todo demo defines its own storage effects. These are application code, not
built-in framework operations. For example:

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

The demo's **Run effect ordering example** button returns these two effects
together:

```gleam
#(model, [
  delayed_log("First effect", 1000),
  delayed_log("Second effect", 100),
])
```

Each effect logs when it starts, waits for its delay, and logs when it finishes.
Open the browser console to see the first effect start before the second, but
the second finish first. The effect-ordering test controls completion explicitly
to check this behavior without relying on real timer delays.

Supply an `onFailure` when a failure should become a message. Unhandled failures
reject the runner's Promise; they do not automatically update the model.

## Subscriptions describe ongoing messages

A subscription has one operation: `start(emit)`, which returns a cleanup function.
Like an effect, its description is inert until used.

The following timer description comes from the todo demo’s `subscriptions.mjs`:

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

Starting and stopping a subscription are ordinary effects. The demo defines
these clock effects in its own `effects.mjs`:

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
- A start acknowledgement means the subscription's setup function has returned.
- Stopping disables emissions before cleanup, so late callbacks are ignored.

The todo example includes both a clock and a window-resize listener. The resize
subscription emits the current size during setup and then listens for changes.
They start and stop independently using the same manager. Timers, browser events,
and other message sources use the same contract; their details belong in the app.

Stopping the app cleans up all subscriptions and ignores pending effect results
and stale view callbacks. It does not cancel an HTTP request already in progress.

## Project layout

The reusable framework lives in `src/runtime/`. The `counter/`, `todos/`, and
`tutorial/` directories are demos; their browser behavior belongs to those apps.
Vite and Tailwind provide the demo build and styling.

```text
src/
  glimlit.gleam           Choose which example to start
  styles.css             Tailwind entry point
  counter/
    counter.gleam         Model, messages, init, update, and entry point
    view.mjs              Counter template and button helper
  todos/
    todos.gleam           Model, messages, update, and saved-todo JSON encoding/decoding
    view.mjs              Todo templates
    effects.mjs           Storage, fetch, logging, and subscription effects
    subscriptions.mjs     Clock and window-resize descriptions
  tutorial/
    tutorial.gleam        Postcard model, messages, update, and entry point
    view.mjs              Postcard editor and preview
    effects.mjs           Saving, restoring, and managing shortcuts
    subscriptions.mjs     Keyboard shortcut listener
    guide.mjs             Tutorial chapters and checkpoint source display
    tutorial.css          Tutorial page and postcard styles
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
