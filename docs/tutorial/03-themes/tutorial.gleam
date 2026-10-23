import runtime/effect.{type Effect}
import runtime/mvu

pub type Theme {
  Coral
  Ocean
  Meadow
}

pub fn theme_name(theme: Theme) -> String {
  case theme {
    Coral -> "coral"
    Ocean -> "ocean"
    Meadow -> "meadow"
  }
}

pub type Model {
  Model(title: String, message: String, theme: Theme)
}

pub type Msg {
  UserChangedTitle(String)
  UserChangedMessage(String)
  UserSelectedTheme(Theme)
}

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

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserChangedTitle(title) -> #(Model(..model, title: title), [])

    UserChangedMessage(message) -> #(Model(..model, message: message), [])

    UserSelectedTheme(theme) -> #(Model(..model, theme: theme), [])
  }
}

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
