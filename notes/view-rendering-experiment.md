# Template-returning views — 28 October 2026

The current implementation grew out of the separate Astro experiment and its
`GLIMLIT-FOLLOWUPS.md`. Glimlit now uses one template-returning view contract and
root-based startup. The Astro project has migrated to the same runtime. This
record separates current behavior from earlier experiments and remaining work.

For an explanation of the current code and a reading order, see
[the runtime walkthrough](runtime-walkthrough.md). This file retains the
experiment history, verification, and open questions.

## Current view and startup contract

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

`runtime/mvu.gleam` now contains startup and the internal loop together. The loop
stores each new model, obtains its view with the real dispatcher, commits it
synchronously, then schedules effects. Its internal renderer callback keeps loop
tests independent of the DOM; app startup binds that callback to the root using
`render.mjs`. Mutable-reference operations have moved into `runner.mjs`.
The previous `loop.gleam` and `browser.mjs` files were consolidated without
changing app startup, view contracts, or application imports.

The returned cleanup is synchronous. It stops subscriptions and ignores messages from old
dispatch callbacks; the host still owns when to call it and whether to remove the DOM.
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
  Postcard initial textarea text is supplied by the explicit compatibility adapter
  described below, then the same element hydrates and updates.
- Type checks, app/runtime tests, tutorial checkpoint compilation/behavior checks,
  and production builds accompany the experiment.

## What this does not settle

- Lit Labs SSR and SSR client remain experimental dependencies. The browser
  renderer now imports the hydration client internally for all apps. That small
  extra browser cost keeps startup synchronous with no preparation API. Server
  rendering remains a separate server-only entry. Installation/distribution
  policy and possible internal delivery optimizations are undecided.
- Lit SSR does not serialize a textarea's `.value` into its initial contents.
  The isolated server-only compatibility adapter fills explicitly marked textarea
  defaults. The website still keeps its Postcard preview browser-rendered.
  See the initial-form-values findings below for other tested bindings.
- Edits, focus, and interaction before delayed hydration need a policy and more
  testing. The current implementation does not guarantee that controlled inputs preserve edits
  made before hydration.
- Matching initial state and template structure are the host/app's responsibility.
  Initialization must be deterministic. Host input validation, safe transport,
  snapshots for nondeterministic initialization, and later prop updates are not
  implemented. Supplying the same input is insufficient if `init` uses random
  numbers, current time, or other changing data.
- Server markup is visible immediately, but interaction still needs JavaScript.
  These apps have no general non-JavaScript form submission behavior. Preventing
  every source of layout shift (fonts, CSS, responsive changes) is not guaranteed.

Instance context now reaches views and effects through the shared runtime. The
next design questions concern native form values and edits before hydration,
initialization data transfer, and the delivery cost of hydration support.


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
Postcard textarea compatibility now uses the same isolated server adapter in both projects.


### Initial form values with SSR

A property binding can work in the browser without producing equivalent initial
server HTML. With the currently installed Lit SSR packages:

| Binding | Initial server HTML |
| --- | --- |
| Input `.value=${text}` | Serializes a `value` attribute. |
| Textarea `.value=${text}`, including `live(text)` | Leaves the textarea empty. `.defaultValue` does not solve this. |
| Select `.value=${choice}` | Does not select the matching option. Use `?selected=${matches}` on each option. |
| Checkbox/radio `?checked=${checked}` | Correctly includes or omits the boolean attribute. |
| Option `?selected=${selected}` | Correctly includes or omits the boolean attribute. |

Use boolean attribute bindings for checked/selected state in shared server/browser
views. The tested renderer serializes `.checked=${false}` and `.selected=${false}`
as `checked="false"` and `selected="false"`; HTML treats either attribute's presence
as true. These findings cover these bindings, not every native control or property.
Browser-only property binding behavior is unchanged.

Lit recommends textarea `.value`; dynamic child expressions inside textarea are
unsuitable for editable views. Server-only templates can emit textarea text but
cannot hydrate as the same interactive template. Custom element renderers do not
provide a native-element hook to resolve this automatically. See
[Lit expression guidance](https://lit.dev/docs/templates/expressions/#invalid-locations)
and [server-only templates](https://github.com/lit/lit/blob/main/packages/labs/ssr/README.md#server-only-templates).

Both hosts use the temporary `lit-ssr-compat.mjs` server adapter for explicitly
marked textarea defaults. It is separate from the MVU loop and browser renderer,
and is not a general form solution. Preserving edits made before
hydration is a separate unresolved question. Keep these limits explicit rather
than adding control-specific HTML rewriting to the runtime.


## Temporary textarea compatibility adapter

`lit-ssr-compat.mjs` is a server-only, removable workaround for a Lit SSR limitation.
`renderInitial` uses it automatically; Astro's server adapter calls the same
`renderWithSsrCompatibility(template)` entry point. No browser rendering API changes.

Keep the ordinary property binding and explicitly supply the same initial value:

```javascript
html`<textarea
  data-ssr-value=${message}
  .value=${live(message)}
  @input=${handleMessageInput}
></textarea>`
```

The adapter parses Lit's output with parse5, locates marked empty textareas, and
inserts escaped text at their source offsets. It preserves all other output,
including hydration markers, and accounts for HTML's removal of the first leading
newline. Keep the textarea's literal contents empty and include its closing tag;
conflicting contents fail explicitly. The marker stays present in both templates.
Unmarked textareas retain Lit's normal behavior. This requires a server-only parse5
dependency and buffers/parses the rendered HTML; it is not a streaming solution.

It handles initial textarea text only. Keep native `?checked` and `?selected`
bindings for other form defaults. It does not preserve edits made before hydration
or turn forms into a separate state system. Revisit or remove this adapter if Lit
adds compatible native textarea serialization; no upstream delivery date is assumed.
