# Framework objections and improvement priorities

These are reasonable concerns someone might raise before adopting Glimlit.
Keep them here so we can revisit them as the framework develops. They are
questions to investigate, not a commitment to add every possible feature.

Status: **Open** means the concern has not yet been adequately addressed.
When making progress, add evidence, decisions, and relevant commit or issue links.
A documented tradeoff can be an acceptable resolution; not every concern needs code.

## First priority: module setup

**Status: Addressed for this repository's app module setup.** Previously, adding
an app module could require editing Vite's source-resolution rules and aliases.
The build now connects source JavaScript and generated Gleam modules by file
location, without a per-app list. Browser entry points use `gleam:folder/module`.

Evidence:

- `scripts/gleam-source.mjs` reads the package name from `gleam.toml` and resolves
  local JavaScript implementations and relative generated-module imports.
- `test/module-resolution.test.mjs` builds two unfamiliar nested modules with
  repeated filenames under a different package name, loads them in development,
  verifies live helper/view/effect edits, and executes their production bundle.
- The README's “Add your own app” instructions use the existing demos page so
  a fresh clone needs no Vite configuration change to run a new app.

Scope: new standalone HTML pages still need a production page entry. Packaging
and distribution remain separate concerns below.

Why first: it affects the first attempt to use Glimlit, is concrete enough to
verify, and makes later examples and experiments easier to build.

Implemented approach: replace per-app resolution entries with a convention-based
connection between source JavaScript and generated Gleam modules.

Success criteria:

- A new app with adjacent Gleam and JavaScript files works without adding
  module-specific entries to the build configuration.
- Both development and production builds resolve the correct files.
- Nested modules and repeated filenames such as `view.mjs` work independently.
- Changes to source views and effects are reflected during development.
- Setup documentation gives one clear path from a fresh clone to a running app.

## Language boundary and type checking

**Status: Addressed as a documented FFI tradeoff with optional checks.** Gleam
trusts external declarations; Glimlit cannot make the compiler verify the
JavaScript implementation. This limitation remains, rather than being solved
by annotations.

Evidence:

- `npm run check` refreshes generated Gleam declarations, checks selected source
  JavaScript, and verifies positive and expected-error examples in `test/types/`.
- The examples demonstrate checks for model access, message arguments, dispatch,
  effect result/message types, and subscription messages and cleanup functions.
- The Docs page's “Optional type checking” section shows annotated view/effect
  examples and explains opt-in/out behavior and the limitations.
- No annotations were added to tutorial files. Their no-check directives remain.

Not guaranteed: agreement between a Gleam external declaration and an independently
written JavaScript annotation, complete lit-html binding validation, or validity
of runtime data. These still require review, runtime validation, and behavior tests.

## Two languages and debugging

**Status: Open.** A feature can involve Gleam messages, JavaScript constructors,
external declarations, and generated imports. Developers need to understand the
connection and identify where a failure originates.

Look for ways to reduce repetitive integration work and provide clear debugging
examples. Check the experience with someone unfamiliar with the implementation.

## Value compared with existing alternatives

**Status: Open.** Someone could reasonably choose Lustre for Gleam throughout,
or Lit with JavaScript/TypeScript throughout. The preference for lit-html views
needs to justify the integration cost for the intended audience.

The positioning now emphasizes MVU structure with direct access to elements,
properties, DOM events, native controls, and deliberate browser/model state ownership.
See [the project philosophy](philosophy.md). This clarifies the intended benefit;
it does not establish superiority. Gather feedback from developers building the
same small interaction in each approach.

## Application structure and supporting features

**Status: Scoped by the project philosophy; composition evidence available.**
Glimlit owns the update loop, effect execution, subscription lifetimes, and cleanup.
Forms, dialogs, routing, and other application behavior can use browser APIs,
application code, or libraries chosen by the developer. Their absence from the
core is not automatically a missing framework feature.

See [the project philosophy](philosophy.md) for state ownership. Small interactive
islands are the primary use case; the important benefit is a small amount of
framework to understand while retaining access to real elements and native behavior.

The recipe box linked from Demos demonstrates multiple screens, editor state,
routing, validation, persistence, and sample imports through one model, message
type, and update function, without new runtime APIs. Its removal confirmation uses the browser and sends only the confirmed
decision to update. See [the architecture notes](recipes-architecture.md).

Larger-app conventions can still improve, but new abstractions should be justified
by actual use. The example is not a commitment to add a full router, form system,
or component framework. Performance at scale and a complete developer-tools story
remain unevaluated.

## Effect concurrency, failures, and cancellation

**Status: Open.** Stopping an app suppresses later results but does not cancel
running work. Requests can finish out of order, and work failures without a
failure callback can produce unhandled Promise rejections.

Document and demonstrate failure handling, ignoring stale responses, and
cancelling a request. Use the examples to decide whether runtime changes are needed.

## Distribution and adoption

**Status: Deferred.** For now, Glimlit is shared through this GitHub repository.
Revisit conventional package distribution and upgrade guidance when the framework
is ready for wider publication. No starter generator or release workflow is needed
yet.

## Maintenance and continuity

**Status: Open.** Adopters need confidence that compiler, dependency, and browser
changes will be handled, and that they can maintain an app if development stops.

Define supported versions, release practices, and upgrade guidance. Keep the
runtime understandable and its behavior covered by tests. State maintenance
expectations candidly rather than promising support that cannot be sustained.

## Suggested order

1. Simplify module setup.
2. Establish practical checks at the Gleam–JavaScript boundary.
3. Build a moderately sized app to assess composition and effect patterns.
4. Keep the framework boundary small; assess remaining concerns against the
   [project philosophy](philosophy.md), rather than treating every concern as a
   feature request.
