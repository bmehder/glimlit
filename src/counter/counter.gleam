import runtime/effect.{type Effect}
import runtime/mvu

pub type Model {
  Model(count: Int)
}

pub type Msg {
  UserClickedIncrement
  UserClickedIncrementBy10
  UserClickedDecrement
  UserClickedReset
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(Model(count: 0), [])
}

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserClickedIncrement -> #(Model(count: model.count + 1), [])
    UserClickedIncrementBy10 -> #(Model(count: model.count + 10), [])
    UserClickedDecrement -> #(Model(count: model.count - 1), [])
    UserClickedReset -> #(Model(count: 0), [])
  }
}

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
