import runtime/effect.{type Effect}
import runtime/loop
import runtime/view.{type Root, type View}

@external(javascript, "./render.mjs", "createRenderer")
fn create_renderer(root: Root) -> fn(View) -> Nil

/// Start an app in its root. Glimlit hydrates marked server HTML on the first
/// view and renders normally otherwise. All later updates render normally.
/// The first view is committed before effects run. Keep the returned cleanup
/// function and call it when the host removes the app.
pub fn start(
  initial: #(model, List(Effect(msg))),
  update: fn(model, msg) -> #(model, List(Effect(msg))),
  view: fn(model, fn(msg) -> Nil) -> View,
  root: Root,
) -> fn() -> Nil {
  loop.start(initial, update, view, create_renderer(root))
}
