import runtime/effect.{type Effect}
import runtime/mvu
import runtime/view.{type Root, type View}

// -- Types ---------------------------------------------------------------

pub type Theme {
  Coral
  Ocean
  Meadow
}

pub type Notice {
  Unsaved
  Saving
  Saved
  SaveFailed
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(title: String, message: String, theme: Theme, notice: Notice)
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  UserChangedTitle(String)
  UserChangedMessage(String)
  UserSelectedTheme(Theme)
  UserClickedSave
  LocalStorageSavedDesign
  LocalStorageSaveFailed
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      title: "Hello from somewhere nice",
      message: "Wish you were here. The days are slow and the coffee is good.",
      theme: Coral,
      notice: Unsaved,
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

    UserClickedSave -> {
      let theme = case model.theme {
        Coral -> "coral"
        Ocean -> "ocean"
        Meadow -> "meadow"
      }
      #(Model(..model, notice: Saving), [
        save_design(model.title, model.message, theme),
      ])
    }

    LocalStorageSavedDesign -> #(Model(..model, notice: Saved), [])

    LocalStorageSaveFailed -> #(Model(..model, notice: SaveFailed), [])
  }
}

// -- Browser boundaries --------------------------------------------------

@external(javascript, "./effects.mjs", "saveDesign")
fn save_design(title: String, message: String, theme: String) -> Effect(Msg)

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> View

// -- Start ---------------------------------------------------------------

pub fn main(root: Root) -> fn() -> Nil {
  mvu.start(init(), update, view, root)
}
