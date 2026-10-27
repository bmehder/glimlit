import runtime/effect.{type Effect}
import runtime/mvu

pub type Model {
  Model(title: String, message: String)
}

pub type Msg {
  UserChangedTitle(String)
  UserChangedMessage(String)
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      title: "Hello from somewhere nice",
      message: "Wish you were here. The days are slow and the coffee is good.",
    ),
    [],
  )
}

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserChangedTitle(title) -> #(Model(..model, title: title), [])

    UserChangedMessage(message) -> #(Model(..model, message: message), [])
  }
}

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
