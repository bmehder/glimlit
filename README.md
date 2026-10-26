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
Its primary use case is small interactive islands—forms, editors, filters, and
widgets embedded in a larger page.

Gleam describes your application model, messages, and pure update function. JavaScript views
dispatch Gleam messages. Effects are values that describe work; subscriptions
are values that describe ongoing sources of messages.

The aim is MVU structure with the browser within reach. Glimlit owns the update
loop, effect execution, subscription lifetimes, and cleanup. Your app can use
element properties, DOM events, native forms, and confirmation dialogs directly.
A draft used only on submission can stay in its input; a value driving a live
preview belongs in the model. You choose that boundary.

There is one `start` function, a small effect runner, and a subscription manager.
Routing, forms, dialogs, and application architecture can stay with the browser,
your app, or libraries you choose. See [the project philosophy](docs/philosophy.md)
for state ownership, examples, and the framework's scope.

This repository contains the framework, working examples, and a beginner tutorial. It is currently
a browser application, rather than a separately published package. Server-side
rendering is not implemented.

## Run it

You need Gleam on your PATH, plus Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

The development server uses port 3000. If that port is occupied, stop the other
server before running `npm run dev`.

Open <http://127.0.0.1:3000> for the homepage, or
<http://127.0.0.1:3000/demos/> to choose an example. Counter, Todos, and Recipe box have their
own pages; there is no launcher to edit. Vite compiles Gleam
and refreshes generated JavaScript declarations when Gleam files change. Views
and Tailwind styles also update during development.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Compile Gleam and bundle the app into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Refresh Gleam declarations and check annotated JavaScript and type examples |
| `npm test` | Compile Gleam and run the tests |
| `npm run test:tutorial-checkpoints` | Compile and check all six tutorial checkpoints |
| `gleam format --check` | Check Gleam formatting |

## Examples

The [Demos page](http://127.0.0.1:3000/demos/) introduces three runnable examples:

- [Counter](http://127.0.0.1:3000/demos/counter/): the smallest working loop.
- [Todos](http://127.0.0.1:3000/demos/todos/): effects, persistence, network requests,
  and subscriptions, plus a styled delete-confirmation dialog.
- [Recipe box](http://127.0.0.1:3000/recipes/): a larger app with browsing, search,
  editing, routing, local storage, and sample imports. It uses the same runtime
  and model–message–update structure as the smaller examples.

Each page starts its own Gleam module directly. The tutorial has its own
page for building Postcard Studio.
[How the recipe box is built](docs/recipes-architecture.md) explains its module
structure, state and messages, persistence, and failure recovery.

## Add your own app

New app modules need no per-app Vite aliases. Keep the Gleam module and its
JavaScript implementations together, for example:

```text
src/app/
  app.gleam
  view.mjs
  effects.mjs           Optional
  subscriptions.mjs    Optional
```

1. Create `src/app/app.gleam` and `src/app/view.mjs` using the
   [starting example in the docs](http://127.0.0.1:3000/docs/#start).
2. In `demos/counter/index.html`, change the script's import from `gleam:counter/counter` to
   `gleam:app/app`. Keep its `main()` call and cleanup registration. The page
   already contains the `#app` mount element used by the example.
3. Run `npm run dev` and open <http://127.0.0.1:3000/demos/counter/>. Use `npm run build`
   to build the same app for production.

In Gleam, declare implementations with relative paths such as
`@external(javascript, "./view.mjs", "view")`. In `view.mjs`, import generated
constructors and accessors from `./app.mjs`; do not create that generated file
in `src/`. The build connects these paths automatically, including nested
modules and repeated filenames in different folders. Ordinary JavaScript
helpers use their normal relative imports. Avoid giving a handwritten `.mjs`
file the same path as a Gleam module's generated `.mjs` file.

Browser entry points can use `gleam:folder/module` to import Gleam exports
without spelling out a generated build path. A new standalone HTML page still
needs an entry in Vite's production page list if you want it included in the
website build; using the existing demos page requires no configuration changes.

## Build your first app

Open **[/tutorial/](http://127.0.0.1:3000/tutorial/)** on the development server
for a guided introduction to Glimlit. You’ll build **Postcard Studio**, an editor
with a live preview, colour themes, browser storage, and optional keyboard
shortcuts. It assumes basic web development and JavaScript knowledge, and
introduces Gleam, lit-html, and Model–View–Update as you go.

Six complete checkpoints in `docs/tutorial/` start with a static view, add
editing and themes without effects, then introduce saving, restoring, and
subscriptions. The finished app lives in `src/tutorial/`. The tutorial page is
also included in production builds and linked from the Demos page.

Each chapter explains the ideas first, then provides complete replacement files
under **Complete checkpoint**, followed by a **Try it** exercise. The short
snippets illustrate the explanation; readers do not need to paste them in one
by one. Each checkpoint can also be copied from the checkout or downloaded from
the tutorial page.

## Documentation

Open **[/docs/](http://127.0.0.1:3000/docs/)** for the app API, models and updates,
views, effects, subscriptions, and lifecycle behavior. The JavaScript runtime
reference is generated at build time from public JSDoc in `src/runtime/`.
Tutorial files are excluded from reference generation and need no JSDoc comments.
Gleam's `mvu.start` API and usage examples are documented separately on the page.

## The loop

![The MVU loop: Update produces a Model, the Model is rendered by the View, and user events produce Messages that return to Update with the current Model. Update can also request effects, whose result messages return to Update.](docs/mvu-loop.svg)

Both `init` and `update` return a model and a list of effects. An empty list means
there is no work to perform. The runtime stores the new model, renders it, and then
runs the effects. View events and effect callbacks send messages back to `update`,
along with the current model, completing the loop.

Inside `src/runtime/mvu.gleam`, initialisation and message updates share the
private `render_and_run` function. It stores the model, creates the guarded
dispatch callback, renders the view, and runs the effects in that order.
`start` handles setup and returns cleanup; `dispatch` calls `update` with the
current model. Apps still use the same `mvu.start(init(), update, view)` API.

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
  Msg$UserClickedIncrement,
  Model$Model$count,
} from './counter.mjs'

export function view(model, dispatch) {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app mount element')

  render(html`
    <div>
      <p>${Model$Model$count(model)}</p>
      <button @click=${() => dispatch(Msg$UserClickedIncrement())}>
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

### Reading Gleam’s JavaScript exports

Gleam generates ordinary JavaScript functions for public custom types. The names
identify the **type**, **constructor**, and, for accessors, **field**:

- `Type$Constructor(...)` creates a value.
- `Type$Constructor$field(value)` reads a field without changing it.
- `Type$isConstructor(value)` checks which variant a value has and returns a boolean.

For example, `pub type Model { Model(count: Int) }` has a type and a constructor
both named `Model`. That is why the accessor repeats the name: `Model$Model$count`.
The first `Model` is the type, the second is its constructor, and `count` is the
field. `Msg$UserChangedTitle` instead names the `UserChangedTitle` constructor
belonging to the `Msg` type.

| In Gleam | In JavaScript | Meaning |
| --- | --- | --- |
| `Model(count: 0)` | `Model$Model(0)` | Create a model |
| `model.count` | `Model$Model$count(model)` | Read its count |
| `UserChangedTitle("Hello")` | `Msg$UserChangedTitle("Hello")` | Create a message with a payload |
| `UserClickedIncrement` | `Msg$UserClickedIncrement()` | Create a message without a payload |
| `Ocean` | `Theme$Ocean()` | Create a theme value |
| Match the `Ocean` variant | `Theme$isOcean(theme)` | Check a theme variant |

The `$` characters are part of the function name, not JavaScript property access
or a Glimlit operation. Constructor arguments follow their Gleam declaration
order. Even constructors without payloads are called with `()` in JavaScript.
Calling a message constructor only creates a value; `dispatch(message)` sends it
to update.

Import these functions from the compiled module, such as `./counter.mjs` or
`./tutorial.mjs`. The build supplies that module from the adjacent Gleam source;
you do not create it or edit files under `build/`. The examples keep the exported
names without aliases and call constructor functions directly, without `new`.
Editor import completion can help you find them.

For editor highlighting inside tagged templates, VS Code users can install the
[lit-html extension](https://marketplace.visualstudio.com/items?itemName=bierner.lit-html).
It adds HTML highlighting and completions to templates tagged with `html`.

`jsconfig.json` enables strict JavaScript type checking using Gleam's generated
declarations. Files can opt out with `// @ts-nocheck` on the first line, as the
tutorial's view, effects, and subscription files do. This editor checking is
separate from compiling Gleam and building the app. Run `npm run check` to refresh
the declarations and check the selected JavaScript files and the examples in
`test/types/`. The examples verify that common type mistakes are rejected.

This does **not** automatically prove that JavaScript matches a Gleam external
declaration. An annotation can disagree with that declaration while both sides
pass their own checks. Runtime data still needs validation, and template markup
and event bindings are not fully checked. See
[Optional type checking](http://127.0.0.1:3000/docs/#type-checking) for annotated
view/effect examples, subscription types, and what remains unchecked. Tutorial
files keep their no-check directives and need no JSDoc.

## Effects describe work

An effect is an object with a deferred `perform` function and optional callbacks
that turn its result or failure into a message. Constructing an effect does
nothing.

The todo example defines its own storage effects. These are application code, not
built-in framework operations. For example:

```js
export function saveTodos(json) {
  return {
    perform: () => localStorage.setItem(key, json),
    onSuccess: () => Msg$LocalStorageSavedTodos(),
    onFailure: () => Msg$LocalStorageFailed('Browser storage is unavailable.'),
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

The Todos example's **Run effect ordering example** button returns these two effects
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

The following timer description comes from the todo example’s `subscriptions.mjs`:

```js
export function every(milliseconds, handleTick) {
  return {
    start: emit => {
      const timer = setInterval(() => emit(handleTick(Date.now())), milliseconds)
      return () => clearInterval(timer)
    },
  }
}
```

`handleTick` creates a message from the current time; `emit` sends that message back
into the app's update loop. It is an ordinary callback supplied by the manager,
which wraps the app's dispatcher with a check that this subscription is still
active. Subscriptions can therefore produce messages without knowing the model
or calling `update` themselves.

Starting and stopping a subscription are ordinary effects. The Todos example defines
these clock effects in its own `effects.mjs`:

```js
export function startClock() {
  return {
    perform: ({ subscriptions, dispatch }) =>
      subscriptions.start('clock', every(1000, Msg$ClockTicked), dispatch),
    onSuccess: Msg$ClockStarted,
    onFailure: () => Msg$ClockSubscriptionFailed('Could not manage the clock.'),
  }
}

export function stopClock() {
  return {
    perform: ({ subscriptions }) => subscriptions.stop('clock'),
    onSuccess: Msg$ClockStopped,
    onFailure: () => Msg$ClockSubscriptionFailed('Could not manage the clock.'),
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

Setup can emit immediately, and that message can stop the subscription before
setup returns its cleanup function. The manager still runs that cleanup once
it becomes available. When stopping all subscriptions, it attempts every cleanup
even if one fails, then reports the collected errors.

The todo example includes both a clock and a window-resize listener. The resize
subscription emits the current size during setup and then listens for changes.
They start and stop independently using the same manager. Timers, browser events,
and other message sources use the same contract; their details belong in the app.

Stopping the app cleans up all subscriptions and ignores pending effect results
and stale view callbacks. It does not cancel an HTTP request already in progress.

## Project layout

**The framework is `src/runtime/`.** Everything else is an example app, the
project website, documentation, or development tooling. The runtime has no
website navigation, styles, or dependency on the example apps.

```text
src/
  runtime/               Reusable Glimlit framework
    mvu.gleam            Model storage, dispatch, and rendering loop
    effect.gleam         Typed JavaScript effect boundary
    browser.mjs          Private mutable model reference
    runner.mjs           Generic effect runner and app lifetime
    subscriptions.mjs    Generic subscription lifetime manager
  counter/               Small example app: model, update, and view
  todos/                 Example app with storage, fetch, and subscriptions
  tutorial/              Finished Postcard Studio app that readers edit
  recipes/               Multi-screen recipe box with an editor
  site/                  Website code; not part of the framework
    code_tabs/           Homepage tabs: a small Glimlit app
    home.css             Homepage and demos layout
    styles.css           Website Tailwind entry point
    navigation.mjs       Header and shared page links
    navigation.css       Header styles
    menu.mjs             Small-screen header menu
    footer.mjs           Footer using the same page links
    footer.css           Footer styles
    chapters.mjs         Active-section tracking for docs and tutorial
    demos/               Example hub and runner page styles
    recipes/             Recipe box entry point and styles
    docs/                Docs page examples, styles, and navigation entry point
    tutorial/            Tutorial chapters, snippets, and page/postcard styles
```

Start reading with `src/counter/counter.gleam` and `src/counter/view.mjs`.
The todo example adds CRUD, localStorage, fetching, and subscriptions. It starts
with three todos when no saved data exists. The fetch button logs a sample
response without adding it to the list. Each app keeps its model and update in
Gleam and its view, effects, and subscription sources in adjacent JavaScript files.

Demos pages import `counter/counter` or `todos/todos` directly through the
`gleam:` browser import. There is no shared Gleam launcher. Apps import
`runtime/mvu` and `runtime/effect` directly. To build your own
app, use the examples as a guide and keep `src/runtime/`; the website and example
apps are not required by the runtime. You will still need a browser entry point,
a view renderer such as lit-html, and build tooling that connects your Gleam and
JavaScript modules. This repository is not currently a separately published package.

The website entry points are `index.html` (home), `demos/index.html` (example hub),
`demos/counter/index.html`, `demos/todos/index.html`, `docs/index.html`,
`tutorial/index.html`, and `recipes/index.html`. Their supporting code lives under
`src/site/`. `scripts/site-navigation.mjs` inserts the shared header and footer
in development and production, without requiring client-side JavaScript.
The homepage tabs in `src/site/code_tabs/` use Glimlit too: Gleam selects the active
tab, lit-html renders the tab buttons, and an effect moves keyboard focus. The
highlighted code panels stay in the initial HTML so the first example is readable
before JavaScript loads. Shared logos and favicons live in `public/`.

`docs/tutorial/` contains the six complete app checkpoints. They replace files
in `src/tutorial/`, leaving the tutorial reader in `src/site/tutorial/` intact.
`scripts/check-tutorial.mjs` checks them in a temporary project, and
`scripts/tutorial-highlighting.mjs` highlights their code with Shiki at build time.
`scripts/docs-page.mjs` highlights the docs examples and generates the runtime
reference from public JSDoc. `docs/mvu-loop.svg` is the README's loop diagram.

`test/` covers the runtime and example app behavior. `build/`, `dist/`, and
`node_modules/` are generated and should not be edited.
`vite.config.mjs` builds these website pages and connects Gleam, JavaScript,
and Tailwind. `scripts/gleam-source.mjs` connects source JavaScript with generated
Gleam modules based on their paths and the package name in `gleam.toml`; it needs
no app-specific aliases. The Gleam Vite loader compiles Gleam and handles its
development updates. The source bridge leaves dependency packages alone.
`gleam_javascript` supplies the official list-to-array conversion used by the views.

## Framework development

See [Framework objections and improvement priorities](docs/framework-objections.md)
for adoption concerns, proposed next steps, and criteria for assessing progress.
