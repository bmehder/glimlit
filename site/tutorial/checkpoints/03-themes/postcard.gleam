import runtime/effect.{type Effect}
import runtime/mvu

// -- Types ---------------------------------------------------------------

pub type Theme {
  Coral
  Ocean
  Meadow
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(title: String, message: String, theme: Theme)
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  UserChangedTitle(String)
  UserChangedMessage(String)
  UserSelectedTheme(Theme)
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      title: "Hello from somewhere nice",
      message: "Wish you were here. The days are slow and the coffee is good.",
      theme: Coral,
    ),
    [],
  )
}

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserChangedTitle(title) -> #(Model(..model, title: title), [])

    UserChangedMessage(message) -> #(Model(..model, message: message), [])

    UserSelectedTheme(theme) -> #(Model(..model, theme: theme), [])
  }
}

// -- Browser boundaries --------------------------------------------------

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

// -- Start ---------------------------------------------------------------

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
