# MVU structure, with the browser within reach

Glimlit provides a small Model–View–Update loop for people who want Gleam's
structure and HTML-like views. The aim is to make application decisions clear
without requiring a large framework API to work with the browser.

Small interactive islands—forms, editors, filters, and widgets within a larger
page—are its primary use case. The recipe box is a larger example: several
screens, an editor, and shared data use the same loop and runtime. Its routing
and storage choices remain application code.

## What the framework owns

- Store the latest application model and dispatch messages through update.
- Render the resulting model and run its requested effects.
- Manage subscription lifetimes and app cleanup.
- Provide a straightforward development connection between Gleam and JavaScript.

Routing, forms, dialogs, application composition, and data fetching strategies
can use browser APIs, application code, or other libraries. They do not all need
Glimlit abstractions. A framework feature should earn its place by making the
core loop easier to use and understand.

## Choose who owns each piece of state

The model holds state the application needs to reason about. The browser can
keep local interaction state until the application needs it.

| State or behavior | A useful starting point |
| --- | --- |
| Saved data, selected filters, shared values, loading and error states | Application model |
| A value that drives a live preview or cross-field calculation | Application model |
| An unsubmitted field value used only on submission | Input element; read it with FormData on submit |
| Focus, caret position, and text selection | Browser; explicitly coordinate them when the app needs to |
| Native required/min/max validation | Browser, alongside application validation at the data boundary |
| A simple confirmation | Browser confirmation; send the resulting decision to update |
| A multi-step dialog that coordinates other parts of the app | Model its meaningful state as needed |
| URL and history | Browser, with messages when the app needs to react |

These are choices, not restrictions. Keep a draft in the model when it needs
validation feedback, restoration, coordination, or a preview. Leave it in the
element when moving every keystroke through update adds no useful information.
Do not keep two competing sources of truth for the same value.

Browser-owned drafts survive only while their elements stay mounted. Deliberate
resets, switching records, and restoring data need an explicit policy. Repeatedly
writing a model value to `.value`, especially with lit-html's `live` directive,
can overwrite a draft the user is editing. Use controlled bindings when the
model is the intended owner, rather than treating them as a requirement.

## Work with actual elements

lit-html gives views direct access to element properties, DOM events, forms,
and native controls. That is part of the motivation, alongside the familiar
HTML-like syntax. Ordinary links can navigate. A form can collect values. An
event handler can ask for browser confirmation and dispatch only the decision.

Render functions should describe the UI; do not open dialogs or attach new
listeners as a side effect of rendering. Local UI behavior can happen in event
handlers. Work requested by update—saving, fetching, or coordinating focus—uses
effects. Ongoing message sources use subscriptions with cleanup.

The runtime accepts a view callback; the repository uses lit-html for rendering.
JSX or another renderer would need its own rendering and build integration.
There is no built-in JSX support, and the examples do not require it.

## How the examples make these choices

- The counter keeps its count in the model because the count is the application.
- Todos keep edits in the model to demonstrate an explicit editing workflow.
- Postcard Studio updates its model on input because the preview changes live.
- The recipe box uses an editor model for validation and restoration, but
  leaves removal confirmation to the browser. Cancelling it sends no message
  and performs no storage write.
- The homepage code tabs model selection while a focus effect coordinates the
  browser's keyboard focus. Selection and focus are different responsibilities.

These examples demonstrate alternatives, not rules to reproduce in every app.
The useful boundary is a small amount of framework to understand, with room to
use the platform directly.
