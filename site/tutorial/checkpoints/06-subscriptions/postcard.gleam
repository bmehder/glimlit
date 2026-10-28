import gleam/dynamic/decode
import gleam/json
import runtime/effect.{type Effect}
import runtime/mvu
import runtime/view.{type Context, type Root, type View}

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
  RestoreFailed
  NoSavedDesign
  Restored
  InvalidSavedDesign
  ShortcutSetupFailed
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(
    title: String,
    message: String,
    theme: Theme,
    notice: Notice,
    shortcuts: Bool,
  )
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  UserChangedTitle(String)
  UserChangedMessage(String)
  UserSelectedTheme(Theme)
  UserClickedSave
  LocalStorageSavedDesign
  LocalStorageSaveFailed
  LocalStorageRestoreFailed
  UserClickedRestore
  LocalStorageReturnedDesign(String)
  LocalStorageWasEmpty
  UserToggledShortcuts
  KeyboardShortcutsChanged(Bool)
  KeyboardShortcutsFailed
  UserPressedNextTheme
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      title: "Hello from somewhere nice",
      message: "Wish you were here. The days are slow and the coffee is good.",
      theme: Coral,
      notice: Unsaved,
      shortcuts: False,
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

    LocalStorageRestoreFailed -> #(Model(..model, notice: RestoreFailed), [])

    UserClickedRestore -> #(model, [load_design()])

    LocalStorageWasEmpty -> #(Model(..model, notice: NoSavedDesign), [])

    LocalStorageReturnedDesign(saved) -> {
      let decoder = {
        use title <- decode.field("title", decode.string)
        use message <- decode.field("message", decode.string)
        use name <- decode.field("theme", decode.string)
        case name {
          "coral" -> decode.success(#(title, message, Coral))
          "ocean" -> decode.success(#(title, message, Ocean))
          "meadow" -> decode.success(#(title, message, Meadow))
          _ -> decode.failure(#("", "", Coral), "a postcard theme")
        }
      }
      case json.parse(saved, decoder) {
        Ok(#(title, message, theme)) -> #(
          Model(
            ..model,
            title: title,
            message: message,
            theme: theme,
            notice: Restored,
          ),
          [],
        )
        Error(_) -> #(Model(..model, notice: InvalidSavedDesign), [])
      }
    }

    UserToggledShortcuts -> #(model, [set_shortcuts(!model.shortcuts)])

    KeyboardShortcutsChanged(enabled) -> #(
      Model(..model, shortcuts: enabled),
      [],
    )

    KeyboardShortcutsFailed -> #(
      Model(..model, notice: ShortcutSetupFailed),
      [],
    )

    UserPressedNextTheme -> {
      case model.shortcuts {
        True -> {
          let theme = case model.theme {
            Coral -> Ocean
            Ocean -> Meadow
            Meadow -> Coral
          }
          #(Model(..model, theme: theme), [])
        }
        False -> #(model, [])
      }
    }
  }
}

// -- Browser boundaries --------------------------------------------------

@external(javascript, "./effects.mjs", "saveDesign")
fn save_design(title: String, message: String, theme: String) -> Effect(Msg)

@external(javascript, "./effects.mjs", "loadDesign")
fn load_design() -> Effect(Msg)

@external(javascript, "./effects.mjs", "setShortcuts")
fn set_shortcuts(enabled: Bool) -> Effect(Msg)

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil, context: Context) -> View

// -- Start ---------------------------------------------------------------

pub fn main(root: Root) -> fn() -> Nil {
  mvu.start(init(), update, view, root)
}
