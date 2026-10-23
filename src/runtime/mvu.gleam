import gleam/list
import runtime/effect.{type Effect, type Runtime}

// Mutation is isolated in a tiny JavaScript mutable reference.
type MutableRef(value)

@external(javascript, "./browser.mjs", "mutableRef")
fn mutable_ref(value: value) -> MutableRef(value)

@external(javascript, "./browser.mjs", "read")
fn read(ref: MutableRef(value)) -> value

@external(javascript, "./browser.mjs", "write")
fn write(ref: MutableRef(value), value: value) -> Nil

pub fn start(
  initial: #(model, List(Effect(msg))),
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil) -> Nil,
) -> fn() -> Nil {
  let runtime = effect.runtime()
  let #(initial_model, _) = initial
  let model = mutable_ref(initial_model)
  render_and_run(initial, model, update, view, runtime)
  fn() { effect.stop(runtime) }
}

fn dispatch(
  model: MutableRef(model),
  msg: msg,
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil) -> Nil,
  runtime: Runtime(msg),
) -> Nil {
  let next = update(read(model), msg)
  render_and_run(next, model, update, view, runtime)
}

fn render_and_run(
  next: #(model, List(Effect(msg))),
  model: MutableRef(model),
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil) -> Nil,
  runtime: Runtime(msg),
) -> Nil {
  let #(next_model, effects) = next
  write(model, next_model)
  let send = fn(msg) {
    case effect.is_active(runtime) {
      True -> dispatch(model, msg, update, view, runtime)
      False -> Nil
    }
  }
  view(next_model, send)
  list.each(effects, fn(effect) {
    let _ = effect.run(effect, send, runtime)
    Nil
  })
}
