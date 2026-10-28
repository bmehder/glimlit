import runtime/effect.{type Effect}
import runtime/mvu
import runtime/view.{type Root, type View}

pub type Model {
  Model(count: Int)
}

pub type Msg {
  UserClickedIncrement
  UserClickedDecrement
  UserClickedReset
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(Model(count: 0), [])
}

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserClickedIncrement -> #(Model(count: model.count + 1), [])
    UserClickedDecrement -> #(Model(count: model.count - 1), [])
    UserClickedReset -> #(Model(count: 0), [])
  }
}

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> View

pub fn main(root: Root) -> fn() -> Nil {
  mvu.start(init(), update, view, root)
}
