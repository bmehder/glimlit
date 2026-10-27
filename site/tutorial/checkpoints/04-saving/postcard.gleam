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
  Model(title: String, message: String, theme: Theme, notice: String)
}

pub type Msg {
  UserChangedTitle(String)
  UserChangedMessage(String)
  UserSelectedTheme(Theme)
  UserClickedSave
  DesignSaved
  StorageFailed(String)
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      title: "Hello from somewhere nice",
      message: "Wish you were here. The days are slow and the coffee is good.",
      theme: Coral,
      notice: "Your design stays in this tab until you save it.",
    ),
    [],
  )
}

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserChangedTitle(title) -> #(Model(..model, title: title), [])

    UserChangedMessage(message) -> #(Model(..model, message: message), [])

    UserSelectedTheme(theme) -> #(Model(..model, theme: theme), [])

    UserClickedSave -> #(Model(..model, notice: "Saving…"), [
      save_design(model.title, model.message, theme_name(model.theme)),
    ])

    DesignSaved -> #(Model(..model, notice: "Saved in this browser."), [])

    StorageFailed(reason) -> #(Model(..model, notice: reason), [])
  }
}

@external(javascript, "./effects.mjs", "saveDesign")
fn save_design(title: String, message: String, theme: String) -> Effect(Msg)

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
