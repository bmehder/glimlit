import gleam/list
import runtime/effect.{type Effect, type Runtime}
import runtime/view.{type Context, type Root, type View}

// -- JavaScript boundaries -----------------------------------------------

// Mutation is isolated in a tiny JavaScript mutable reference.
type MutableRef(value)

@external(javascript, "./runner.mjs", "mutableRef")
fn mutable_ref(value: value) -> MutableRef(value)

@external(javascript, "./runner.mjs", "read")
fn read(ref: MutableRef(value)) -> value

@external(javascript, "./runner.mjs", "write")
fn write(ref: MutableRef(value), value: value) -> Nil

@external(javascript, "./render.mjs", "createRenderer")
fn create_renderer(root: Root) -> fn(View) -> Nil

@external(javascript, "./instance.mjs", "createContext")
fn create_context(root: Root) -> Context

// -- App startup ---------------------------------------------------------

/// Start an app in its root. Glimlit hydrates marked server HTML on the first
/// view and renders normally otherwise. All later updates render normally.
/// The first view is committed before effects run. Keep the returned cleanup
/// function and call it when the host removes the app.
pub fn start(
  initial: #(model, List(Effect(msg))),
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil, Context) -> View,
  root: Root,
) -> fn() -> Nil {
  let context = create_context(root)
  start_loop(
    initial,
    update,
    fn(model, dispatch) { view(model, dispatch, context) },
    create_renderer(root),
    effect.runtime_at(root),
  )
}

// -- Internal loop -------------------------------------------------------

// Internal entry used by start and DOM-independent ordering/lifetime tests.
pub fn start_loop(
  initial: #(model, List(Effect(msg))),
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil) -> view,
  render: fn(view) -> Nil,
  runtime: Runtime(msg),
) -> fn() -> Nil {
  let #(initial_model, _) = initial
  let model = mutable_ref(initial_model)
  render_and_run(initial, model, update, view, render, runtime)
  fn() { effect.stop(runtime) }
}

fn dispatch(
  model: MutableRef(model),
  msg: msg,
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil) -> view,
  render: fn(view) -> Nil,
  runtime: Runtime(msg),
) -> Nil {
  let next = update(read(model), msg)
  render_and_run(next, model, update, view, render, runtime)
}

fn render_and_run(
  next: #(model, List(Effect(msg))),
  model: MutableRef(model),
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil) -> view,
  render: fn(view) -> Nil,
  runtime: Runtime(msg),
) -> Nil {
  let #(next_model, effects) = next
  write(model, next_model)
  let send = fn(msg) {
    case effect.is_active(runtime) {
      True -> dispatch(model, msg, update, view, render, runtime)
      False -> Nil
    }
  }
  render(view(next_model, send))
  list.each(effects, fn(effect) {
    let _ = effect.run(effect, send, runtime)
    Nil
  })
}
