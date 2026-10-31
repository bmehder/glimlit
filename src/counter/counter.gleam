import runtime/effect.{type Effect}
import runtime/mvu
import runtime/view.{type Context, type Root, type View}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(count: Int)
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  UserClickedIncrement
  UserClickedDecrement
  UserClickedReset
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(Model(count: 0), [])
}

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserClickedIncrement -> #(Model(count: model.count + 1), [])
    UserClickedDecrement -> #(Model(count: model.count - 1), [])
    UserClickedReset -> #(Model(count: 0), [])
  }
}

// -- View ----------------------------------------------------------------

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil, context: Context) -> View

// -- Entry point ---------------------------------------------------------

pub fn main(root: Root) -> fn() -> Nil {
  mvu.start(init(), update, view, root)
}
