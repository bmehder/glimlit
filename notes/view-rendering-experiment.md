# Template-returning views — 28 October 2026

This is a trial of one view contract, informed by the separate Astro experiment
and its `GLIMLIT-FOLLOWUPS.md`. It changes the original repository's app/startup
API; it does not preserve the old rendering view callback as another supported
path. The Astro project has now been migrated to the same runtime, as recorded below.

## The contract being tried

A JavaScript `view(model, dispatch, context)` returns a lit-html `TemplateResult`. It does
not look up a mount or call `render()`. Event handlers can still work with browser
elements when invoked; describing the initial view must be safe without a DOM.
Gleam declares the external return as `runtime/view.View`. As with other opaque
FFI types, that declaration does not validate a JavaScript template's contents.

`mvu.start(initial, update, view, root)` is the public startup API. The app
exports `main(root)` and forwards that root. It receives no renderer or mode:

```javascript
import { main } from 'gleam:counter/counter'

const stop = main(document.getElementById('app'))
if (import.meta.hot) import.meta.hot.dispose(stop)
```

The host's initial-HTML integration marks a prerendered root with
`data-glimlit-ssr`. Glimlit's internal `createRenderer` checks that marker once,
hydrates the first view if marked, then removes the marker on success. Empty
unmarked roots render normally. All subsequent updates use ordinary rendering.
A malformed marked root fails startup. A structural hydration mismatch fails rather than
silently replacing the existing DOM. App startup is identical for both cases;
app developers do not import a renderer or select a rendering mode.

The internal `runtime/loop` stores each new model, obtains its view with the real
dispatcher, commits the description synchronously, then schedules effects. Its
model, update, effects, dispatch guarding, and subscription cleanup retain their
existing responsibilities. The loop remains independent of Lit and the DOM;
`runtime/mvu` binds it to the root using the browser rendering layer. The loop's
renderer callback is an internal mechanism for isolation and unit tests, not a
second app startup contract.

The returned cleanup is synchronous. It stops subscriptions and ignores old
callbacks; the host still owns when to call it and whether to remove the DOM.
This revision supersedes the earlier trial that asked callers to choose
`renderInto` or `hydrateInto` and pass a renderer into `main`.

`renderInitial(init(), view, rootId)` in the server-only `runtime/server.mjs` renders the
initial model with Lit SSR and ignores its effect list. Browser effects and
subscriptions are never started by this helper. Templates are escaped by Lit;
the fixed homepage highlighted snippets deliberately use trusted `unsafeHTML`.
This helper is not a general HTML sanitizer.

## The website experiment

- All five apps and all six tutorial checkpoints use template-returning views.
- Counter and the homepage code tabs are prerendered from those views in both
  Vite development and production builds, then hydrated in the browser.
- The homepage's tab buttons and panels are no longer duplicated in page HTML.
  The page contains a build marker. Its fixed highlighted examples live in
  `src/code_tabs/examples.mjs`, with no highlighter in the browser bundle.
- `scripts/initial-views.mjs` owns website-specific prerendering. Development
  uses Vite's SSR module loader; production uses a fresh Node worker module graph.
  Changes to prerendered apps trigger a full development reload, avoiding a second
  hydration attempt on an already-live Lit root during HMR.
- Todos, Recipes, and the website's Postcard preview use ordinary browser
  rendering. Their templates no longer own mounting, but initial HTML generation
  has not been enabled for those pages.

## Verification

- Runtime tests separate description from rendering, verify real first-view
  handlers, rendering before effects, latest-model dispatch, stopped callbacks,
  and no effect execution after a renderer fails during startup.
- Server tests render Counter, Postcard, and code tabs without a DOM, verify
  escaped text, the initial selected/hidden panels, and no browser-effect work.
- Browser checks delay script requests: Counter and the homepage remain visible,
  retain their original DOM nodes through hydration, and keep the same measured
  container height. Counter clicks and tab clicks/keyboard focus work afterward.
- Counter instances mounted into two roots maintain separate state.
- Browser checks exercise Postcard with both ordinary rendering and hydration:
  editing, themes, save/restore, keyboard subscriptions, and stopping the app.
  Postcard hydration works once started, but its initial textarea is incomplete
  before hydration, as described below.
- Type checks, app/runtime tests, tutorial checkpoint compilation/behavior checks,
  and production builds accompany the experiment.

## What this does not settle

- Lit Labs SSR and SSR client remain experimental dependencies. The browser
  renderer now imports the hydration client internally for all apps. That small
  extra browser cost keeps startup synchronous with no preparation API. Server
  rendering remains a separate server-only entry. Installation/distribution
  policy and possible internal delivery optimizations are undecided.
- Lit SSR does not serialize a textarea's `.value` into its initial contents.
  The Postcard server test records this limitation, and the website keeps that
  preview browser-rendered. No `data-ssr-value` rewrite was added to the runtime.
  Other native form defaults also need deliberate verification.
- Edits, focus, and interaction before delayed hydration need a policy and more
  testing. This prototype does not promise that controlled inputs preserve edits
  made before hydration.
- Matching initial state and template structure are the host/app's responsibility.
  Initialization must be deterministic. Host input validation, safe transport,
  snapshots for nondeterministic initialization, and later prop updates are not
  implemented. Supplying the same input is insufficient if `init` uses random
  numbers, current time, or other changing data.
- Each view/effect now receives instance context: the browser root and an
  `id(name)` helper. Server context provides the matching ID helper without DOM
  access. Browser roots without IDs receive unique IDs; SSR roots must retain
  their host-assigned ID. Focus effects query within the root. Postcard/Todos
  keyboard subscriptions attach to that root. Storage and URL namespaces remain
  explicit app conventions; sharing those resources can still be intentional.
- Server markup is visible immediately, but interaction still needs JavaScript.
  These apps have no general non-JavaScript form submission behavior. Preventing
  every source of layout shift (fonts, CSS, responsive changes) is not guaranteed.

The next useful design review is how instance context should reach views/effects
without global DOM lookups, and
how native form values should survive server rendering and delayed hydration.


## Instance-context and Astro migration

Views now receive a third argument, `context`, with `id(name)` and a browser-only
`root`. Effects receive the same identity/root fields alongside subscriptions
and dispatch. Public startup remains `main(root)`; model/update/message types
are unchanged. SSR hosts call `renderInitial(init(), view, rootId)` and retain
that root ID in the browser. A view without IDs can ignore the extra argument.

Two Postcards have been exercised with browser-only, hydrated, mixed, and unnamed
mounts: IDs and label targets are unique; edits, root-scoped shortcuts, and cleanup
are independent. Saved designs can be isolated through Postcard's explicit
`data-storage-key` app option; the default remains the original shared key.

The Astro project uses copied runtime files identical except for the required
Gleam import namespace (`glimlit_apps/runtime`). All five apps use the new view
contract. App-local rendering/hydration wrappers have been removed. Astro's
local storage-key helper was moved out of the runtime into app support; its
existing per-instance storage and recipe routing policies are preserved. The
Postcard textarea serialization bridge remains an Astro-only prototype.
