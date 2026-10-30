# Philosophy

I find The Elm Architecture (TEA) an easy way to build, maintain, and expand web
applications. Messages are sent to an update function, update returns the next model and requested work, and the view reflects the current model. One model and a clear direction of flow make it easy to understand what changed and why, even as an application grows. As it grows, it stays flat.

I want that structure without having to build a single-page application or adopt an entire application stack.

## Why Gleam and lit-html?

Elm’s language is easy to learn. For me, the friction comes from working with
JavaScript and the browser through ports, and accessing the integrations I want.

Lustre brings TEA to Gleam, a language that feels a little Haskell-like and a
little JavaScript-like. I like its functional structure, explicit data, and
practical connection to JavaScript.

The view is where I want another option. Gleam’s pipes help remove nested
function calls from logic, while Elm and Lustre introduce nested calls to
describe elements, attributes, and events. They push the awkward nesting nesting to the view. HTML is naturally nested, but its opening and closing tags give that structure a symmetry I find easier to read and write than layers of brackets and parentheses.

lit-html provides HTML-like JavaScript tagged templates and direct access to
browser elements, properties, and events. Gleam and lit-html let me keep the
architecture I enjoy and write the view in a form that feels natural to me.

## Values do the work

Less is more. Gleam has few keywords and builds around expressions that produce
values, including `case`. I don't have to choose between several language
features for the same job. That makes it feel manageable without feeling
limiting: a small vocabulary gives me enough to express everything I need.

A pure function is itself a value representing a mapping from inputs to outputs,
like a lookup table. It can describe a decision before anyone needs its answer.
Passing that function around requires no special machinery beyond the language’s
support for functions as values. Branching and repetition can be expressed
through pattern matching, composition, and functions that operate on collections.
Functions and pattern matching are enough to express these ideas clearly.

TEA supplies the organizing discipline: a model, messages, and an update cycle.
Within that structure, values describe the rest. A message represents something
that happened. A model represents the application’s current understanding. An
effect can represent work to perform, and a subscription can represent an ongoing
source of messages. Everything is a value.

Describing work does not have to perform it. Update can decide what should happen
and return that decision as a value. A small runner can handle the low-level
details of carrying out effects, starting listeners, and cleaning them up. Their
results become messages that start another cycle.

This is the appeal: a small language, a clear architectural discipline, and
ordinary values that describe both decisions and work. The application can stay
explicit without needing a growing vocabulary of special mechanisms.

## Keep the browser within reach

I prefer one model and an explicit update cycle per app to coordinating
application state spread across many components. Alongside component state and
app state, the browser maintains state of its own: input values, focus,
selection, and more. Coordinating that behavior with application updates can
sometimes be awkward. I want it to be straightforward to work with the actual
elements when that is useful, and keep browser behavior outside the model when
there is no application decision to make.

Choosing how to build an individual interactive UI should not also choose the
framework for the whole site. Glimlit should fit into the surrounding page while
leaving its pages, routing, styling, and libraries independent.

The goal is a small language and a clear update cycle, with familiar markup,
the browser within reach, and fewer decisions between an idea and a working UI.
