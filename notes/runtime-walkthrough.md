# Understanding the current Glimlit runtime

The current design has one app startup call, `main(root)`, and one view contract:
return a lit-html template. Glimlit decides how to put that template into the
root. Astro or another host decides when to start the app and when to stop it.

This guide describes the implementation in the repository. For the API reference,
see the website's [Docs](https://github.com/bmehder/glimlit/blob/main/site/docs/index.html).
For experiment history, verification, and remaining design questions, see
[the rendering experiment](view-rendering-experiment.md).

## What changed

| Previously | Now |
| --- | --- |
| `main()` relied on a mount looked up inside the view. | The host passes the element to `main(root)`. |
| Views called lit-html's `render()` and returned nothing. | Views return `html` templates; Glimlit owns DOM rendering. |
| Static fallback markup could duplicate the interactive view. | Initial HTML can be generated from the same view used in the browser. |
| Astro's Postcard and code tabs carried their own hydration wrappers. | Glimlit checks a host-provided server-rendering marker internally. |
| Views and effects could find elements through global IDs. | Views and effects receive instance context for scoped IDs and DOM access. |
| Keyboard subscriptions listened to the whole window. | The app examples pass their root to keyboard sources. |

The model, message types, `init`, `update`, and effect-description pattern did not
need a new architecture. Their browser boundary and startup wiring changed.
The intermediate experiment that exposed `renderInto` and `hydrateInto` is no
longer the public API.

## Runtime directory

The runtime has eight core files plus a temporary server-only compatibility adapter. Startup and the loop are together; rendering,
identity, effects, and subscription lifetimes keep their own boundaries.

| File | Responsibility |
| --- | --- |
| [mvu.gleam](../src/runtime/mvu.gleam) | Browser startup and the complete model–view–update loop |
| [effect.gleam](../src/runtime/effect.gleam) | Gleam effect/runtime types and JavaScript declarations |
| [view.gleam](../src/runtime/view.gleam) | Gleam View, Root, and Context declarations |
| [instance.mjs](../src/runtime/instance.mjs) | Shared server/browser identity and scoped IDs |
| [render.mjs](../src/runtime/render.mjs) | Browser rendering and first-view hydration |
| [runner.mjs](../src/runtime/runner.mjs) | Effect execution, app lifetime, and the loop's mutable-reference operations |
| [subscriptions.mjs](../src/runtime/subscriptions.mjs) | Keyed subscription setup, stopping, and cleanup |
| [server.mjs](../src/runtime/server.mjs) | Initial HTML generation without running effects |
| [lit-ssr-compat.mjs](../src/runtime/lit-ssr-compat.mjs) | Temporary, server-only initial textarea serialization |

## Start with Counter

These files show the smallest complete app:

1. [The browser entry](../site/demos/counter/index.html) finds the mount, calls
   `main(root)`, and keeps the returned stop function.
2. [counter.gleam](../src/counter/counter.gleam) defines the model and messages,
   initializes state, handles updates, declares the JavaScript view, and forwards
   startup to `mvu.start(init(), update, view, root)`.
3. [view.mjs](../src/counter/view.mjs) returns a template. Event handlers construct
   messages and send them through `dispatch`. It no longer finds a mount or calls
   `render()`.

Counter doesn't need element IDs or DOM queries, so its JavaScript view ignores
the third argument Glimlit supplies. That does not make it a different view API.
A JavaScript function can ignore an argument it does not use.

## Follow the first browser view

[main(root)](../src/counter/counter.gleam) first calls `init()`. That returns the
initial model and effect descriptions. Constructing an effect description does
not perform its work.

[runtime/mvu.gleam](../src/runtime/mvu.gleam) is the browser-facing coordinator:

- It creates instance context from the root.
- It binds the internal renderer to that root.
- It creates an effect runtime carrying that root's context.
- It starts the internal MVU loop, binding context into every view call.

The internal loop in that same [mvu.gleam](../src/runtime/mvu.gleam) file owns
the state transition sequence:

```text
store the model
    → describe the view with a real dispatch callback
    → commit the template to the DOM
    → schedule the returned effects
```

The app's `start` function binds the root and calls `start_loop`. Below it,
`dispatch` and `render_and_run` handle state transitions. `start_loop` is exported
for the DOM-independent ordering and lifetime tests; application code uses
`mvu.start`. The loop's mutable-reference operations live in `runner.mjs` beside
the effect runtime state.

## Where rendering becomes hydration

[runtime/render.mjs](../src/runtime/render.mjs) makes this decision once for each
startup. There is no mode argument in `main(root)`:

| Root at startup | First view |
| --- | --- |
| Empty, without `data-glimlit-ssr` | Render the template normally. |
| Marked `data-glimlit-ssr`, containing matching Lit SSR HTML | Hydrate the existing DOM. |

Hydration connects the browser template's bindings and event handlers to the
nodes already present. Lit's server renderer includes the markers needed to do
this; arbitrary handwritten HTML is not sufficient.

After successful hydration, Glimlit removes `data-glimlit-ssr`. Subsequent model
updates use ordinary lit-html rendering. Invalid marked HTML or a structural
hydration mismatch stops startup rather than silently replacing the interface.
Matching initial values are also required; structural checks do not prove that
server and browser data match.

The browser renderer currently imports the small experimental Lit hydration
client for all apps. This keeps startup synchronous and avoids a separate
preparation step. It is a delivery tradeoff, not an extra app API.

## Follow one Counter click

The Increment button's handler calls `dispatch` with its Gleam message.

The loop checks whether the app is still active, reads the latest model, and
calls `update(model, message)`. It stores the returned model, obtains the next
template, renders it, and schedules any returned effects. Counter returns an
empty effect list, so this transition only changes the displayed count.

Dispatch reads the latest model even when a handler was created by an earlier
view call. The template can contain closures without capturing the model used
by the update function indefinitely.

## Read Postcard for instance context and effects

Next read [Postcard's view](../src/postcard/view.mjs),
[effects](../src/postcard/effects.mjs), and
[keyboard source](../src/postcard/subscriptions.mjs).

The view receives `view(model, dispatch, context)`. Instance context is created by
[runtime/instance.mjs](../src/runtime/instance.mjs):

- `context.id('postcard-title')` returns an ID prefixed with the root's ID. The
  input and its label use the same result. Another root gets a different prefix.
- `context.root` is available in the browser. Query inside that root when DOM
  access is needed. Server views get an ID helper without a browser element.
- Browser mounts without IDs receive generated IDs. Prerendered mounts must keep
  the stable root IDs chosen by their host. Explicit root IDs must be unique
  within the document.

This context is not application state and is not stored in the model. It gives
UI code a stable place and identity. Browser interaction can still happen in
local event handlers; describing server HTML must not access browser elements.

Clicking Save design follows the same loop as Counter. This time update returns
a `saveDesign` effect description. [runner.mjs](../src/runtime/runner.mjs) calls
its `perform` function after the view has been committed. The effect receives
`root` and `id` along with `dispatch` and the app's subscription manager. Its
success or failure callback produces another message, which repeats the loop.

The keyboard effect passes its root to `nextThemeKey`. That source listens for
key events bubbling through this app's root. The manager sends emitted messages
to this app's dispatcher. Stopping one instance removes its own listener without
stopping another instance's source with the same subscription key.

Root scoping does not automatically separate persistence or URLs. Postcard keeps
its established storage key by default; `data-storage-key` is an explicit app
option for separate saved designs. Astro's storage and recipe-route conventions
are also app policy, not automatic runtime namespaces.

## Where the initial HTML comes from

[runtime/server.mjs](../src/runtime/server.mjs) provides
`renderInitial(init(), view, rootId)`. It uses the initial model and the same view
to produce HTML through Lit SSR. It ignores the returned effects; browser storage,
network requests, and subscriptions do not run through this helper.

The helper delegates serialization to the temporary, server-only
[lit-ssr-compat.mjs](../src/runtime/lit-ssr-compat.mjs) adapter. Empty textareas
marked with `data-ssr-value` receive escaped initial text while retaining the
ordinary `.value` binding for browser updates. This adapter is shared with the
Astro experiment and does not change the MVU loop. See the
[usage and limits](view-rendering-experiment.md#temporary-textarea-compatibility-adapter).

For this website, [initial-views.mjs](../scripts/initial-views.mjs) fills build
markers in page HTML and marks the containing root with `data-glimlit-ssr`.
The homepage code tabs and Counter use this in development and production.
The remaining example pages currently begin with empty mounts.

The browser initializes the app again. It must get the same initial model,
view structure, and root ID. Hydration is not model deserialization: server HTML
does not automatically reconstruct a Gleam model in the browser. Host-supplied
initialization data and snapshots for nondeterministic initialization remain
unimplemented.

The initial HTML establishes the interface's space before JavaScript loads,
reducing loading-related layout shift. Its controls become functional when the
app starts. Fonts, CSS changes, and differences in initial state can still affect
layout.

## What Astro adds

Astro registers a renderer, generates page HTML, schedules island startup using
its client directives, and supplies an unmount event. Its client adapter calls
`main(root)` and retains cleanup. Its server adapter calls the shared view with
server ID context and marks the mount. Neither app views nor browser entries
choose rendering or hydration.

The separate Astro project's runtime files match this repository except for
Gleam import prefixes. Its app views keep their Tailwind styling and local
storage/routing conventions. Its integration page traces those host-specific
files. This repository does not require Astro.

## Follow cleanup

The function returned by `main(root)` stops the runtime, cleans up subscriptions,
and ignores messages sent through old dispatch callbacks or late effect results.
The host calls it when removing the app. Vite's disposal hook and Astro's unmount
event are examples of that lifecycle wiring.

Stopping does not remove the DOM or cancel an HTTP request already in progress.
Event-handler bodies can still perform their own browser work if that DOM is
left in place; the runtime guards message dispatch, not arbitrary JavaScript.

## Current limits to keep in mind

- Lit SSR and its hydration client remain experimental dependencies.
- Postcard's textarea `.value` is not serialized into initial text by Lit SSR.
  Both hosts use the isolated server-only compatibility adapter for marked
  defaults; this website still keeps its Postcard preview browser-rendered.
- Preservation of edits made before delayed hydration is not guaranteed.
- Initial state transfer and later host prop updates are not implemented.
- IDs and root-scoped helpers support isolation; applications still need to
  choose policies for shared storage, global browser state, and routing.

The [experiment notes](view-rendering-experiment.md) record the tests and remaining
questions separately from this explanation of the current code.
