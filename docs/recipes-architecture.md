# Recipe box: composing a larger Glimlit app

Run `npm run dev` and choose **Recipe box** from the **Demos** page, or open
<http://127.0.0.1:3000/recipes/> directly. The app is included in the
production build. It is separate from the beginner Postcard Studio tutorial.

Glimlit primarily targets small interactive islands within larger pages. This
example explores what it can handle beyond that use case, rather than proposing
that every app should have this structure.

The [project philosophy](philosophy.md) describes the framework boundary and
choices about browser-owned state.

The recipe box exercises a parent model, a child editor, multiple screens,
shared state, browser navigation, JSON validation, local persistence, and HTTP
requests. It uses the existing runtime without new framework APIs.

## File map

| File | Responsibility |
| --- | --- |
| `src/recipes/recipes.gleam` | Parent model, messages, update, persistence decisions, and startup |
| `src/recipes/recipe.gleam` | Recipe data, collection operations, IDs, and starter data |
| `src/recipes/recipe_json.gleam` | Versioned JSON encoding, decoding, and schema checks |
| `src/recipes/route.gleam` | Parse and construct hash routes |
| `src/recipes/editor.gleam` | Child form model, field messages, and validation |
| `src/recipes/view.mjs` | Choose a screen and render shared save/import status |
| `src/recipes/collection.mjs` | Search, favourites, and collection cards |
| `src/recipes/detail.mjs` | Recipe details and deletion confirmation |
| `src/recipes/editor_view.mjs` | Form fields, errors, and child-message callbacks |
| `src/recipes/effects.mjs` | Storage, fetching, navigation, and focus |
| `src/recipes/subscriptions.mjs` | Browser hash changes and listener cleanup |
| `src/recipes/inputs.mjs` | Narrow DOM event targets before reading input values |
| `src/site/recipes/` | Website entry point and styling |
| `public/recipes/samples.json` | Same-origin sample response; no third-party API needed |
| `test/recipes.test.mjs` | Domain, update, effect, and subscription behavior checks |

The source bridge resolves these modules by location. Only the new HTML page
was added to Vite's production page list; no recipe-specific aliases were added.

## Parent state and child messages

The parent owns the collection, current route, search/filter settings, storage
state, save revision, import request ID, and editor model. Recipe changes stay
in one collection so details, favourites, and search use the same data.

The editor knows only its field values and validation errors. Its update
function returns an editor model; it does not save, navigate, or access the
parent collection. The parent wraps field changes in `EditorChanged(editor.Msg)`
and delegates them to `editor.update`. The editor view receives a child dispatch
callback, so it does not import the parent app's messages.

The parent update delegates submission, deletion, restoration, and imports to
named operations. Each operation builds its next model in local steps, then
requests persistence or navigation. Collection transformations live in
`recipe.gleam`; the parent does not repeat their list-processing logic.

Submission belongs to the parent. It validates the draft, preserves an existing
recipe's ID and favourite flag, replaces or appends the recipe, then requests
saving and navigation. Validation failures render an error summary before a
focus effect moves keyboard focus there.

This example keeps the collection and detail views as JavaScript functions,
rather than giving every UI component an independent MVU runtime. Create child
models where there is state to manage; simple rendering functions need no model.

## Browser-owned interaction

Removing a recipe uses `window.confirm` in the click handler. The browser owns
the confirmation UI; cancellation sends no message. Confirmation dispatches
`DeleteConfirmed(id)`, and update removes the recipe and requests saving. There
is no pending-confirmation flag or open/close message cycle in the model.

The editor uses native required/min/max/step validation before submitting.
Gleam validates the submitted recipe as well, including whitespace-only content
and the same duration bounds. It deliberately keeps a draft in the model to
demonstrate child state, validation feedback, and restoration. That is an app choice. A simpler submit-only form
could let inputs hold their values and read FormData on submission instead.
The framework does not require a message for every keystroke.

## Routes and app lifetime

Routes use hashes, such as `#/recipe/2/edit`. They support reloads and browser
Back/Forward without server rewrite rules. This is an app-specific routing
module, not a new framework router.

Links use ordinary `href` values. A subscription listens for `hashchange`, emits
the initial hash, and returns a listener cleanup. The runtime gives the app one
keyed subscription and removes it on shutdown. The browser entry registers the
returned app cleanup with Vite's disposal hook.

The parent initializes the editor when a route changes. Unsubmitted changes are
discarded when leaving the form; the form states this explicitly. There is no
unsaved-change confirmation. Unknown routes and missing recipe IDs show a
recovery link rather than creating an invalid editor.

## Persistence and failure recovery

The collection is stored as versioned JSON under `glimlit.recipes.v1`.
The codec in `recipe_json.gleam` uses the existing `gleam_json` Hex package and
standard-library decoders. Recipe encoding is a named function, and schema checks
are separate from app updates. A generator such as [Sara](https://sara.hexdocs.pm/)
could remove the field-by-field codec, but would add a generation step; this
small example keeps the schema explicit.

The Gleam decoder checks the schema, positive unique IDs, required content,
favourite flags, and a valid cooking time. It accepts an empty collection;
removing all recipes does not bring starter recipes back on reload.

At startup, editing is blocked until loading finishes. Missing storage uses the
starter recipes. Unreadable or invalid storage shows a recovery screen and is
not automatically overwritten. The user can retry or explicitly replace it
with starter recipes. If storage remains unavailable, the app works in memory
and reports that saving failed.

Submitting a recipe, toggling a favourite, removing a recipe, or importing samples
requests a save. A failed save keeps the changed model and offers **Retry saving**.
The app does not pretend that failed writes succeeded or reload stale storage
over edits. Reloading before a failed write is recovered can lose in-memory changes.

Each save carries a revision. Only the latest revision can change save status.
The actual storage writes are synchronous and scheduled in list order. Revision
checks alone would not make writes to an asynchronous server arrive in order;
a remote backend would need its own concurrency strategy.

## HTTP requests and stale results

**Import sample recipes** fetches the same-origin sample JSON. HTTP failures and
invalid payloads preserve the collection and provide a retry path. Successful
imports assign fresh IDs, skip matching titles, and merge into the current
collection, preserving changes made while the request was pending.

Each import carries a request ID. Starting another import increments the ID;
results from an older request are ignored. Cancelling also increments the ID
and hides the loading state. It ignores the result, but does not abort the HTTP
request. Stopping the app similarly suppresses messages without cancelling
already-running work. An AbortController integration would be a separate pattern.

The sample endpoint is deliberately a local static file. It exercises real HTTP
loading and failure behavior without needing credentials or an external service.
It is not a backend for saving recipes or sharing them across devices.

## What this demonstrates and what remains open

- A parent model and wrapped child messages provide useful composition without
  a new runtime API. The parent remains the place where cross-screen decisions meet.
- Plain view functions can share the parent's state without prop-drilling a
  framework context or starting separate app lifetimes.
- App-specific hash routing and a single subscription are enough for these
  screens; path routing, nested layouts, and route guards need further evaluation.
- Generated Gleam declarations and runtime JSDoc types check the JavaScript
  views/effects/subscription through `npm run check`. They do not prove that an
  external declaration matches its implementation.
- Request IDs and save revisions are explicit app state. They work here, but
  extracting helpers should wait until another example shows the same need.
- This small multi-screen app provides evidence for conventions. It does not
  establish large-application performance, accessibility completeness, backend
  integration, cross-tab synchronization, or a complete developer-tools story.

## Verification

Run `npm run check`, `npm test`, and `npm run build` for static checks, behavior
tests, and the production bundle. During development, try creating a recipe,
reloading its detail route, editing it, filtering favourites, and deleting it.
Browser network tools can block `/recipes/samples.json` to exercise retry, or
slow requests to exercise import restart/cancellation. Invalid stored JSON and
denied storage expose the explicit recovery paths.
