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

pub type Shortcuts {
  Enabled
  Disabled
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
    shortcuts: Shortcuts,
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
  KeyboardShortcutsChanged(Shortcuts)
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
      shortcuts: Disabled,
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

    UserToggledShortcuts -> {
      let shortcuts = case model.shortcuts {
        Enabled -> Disabled
        Disabled -> Enabled
      }
      #(model, [set_shortcuts(shortcuts)])
    }

    KeyboardShortcutsChanged(shortcuts) -> #(
      Model(..model, shortcuts: shortcuts),
      [],
    )

    KeyboardShortcutsFailed -> #(
      Model(..model, notice: ShortcutSetupFailed),
      [],
    )

    UserPressedNextTheme -> {
      case model.shortcuts {
        Enabled -> {
          let theme = case model.theme {
            Coral -> Ocean
            Ocean -> Meadow
            Meadow -> Coral
          }
          #(Model(..model, theme: theme), [])
        }
        Disabled -> #(model, [])
      }
    }
  }
}

// -- Effects -------------------------------------------------------------

@external(javascript, "./effects.mjs", "saveDesign")
fn save_design(title: String, message: String, theme: String) -> Effect(Msg)

@external(javascript, "./effects.mjs", "loadDesign")
fn load_design() -> Effect(Msg)

@external(javascript, "./effects.mjs", "setShortcuts")
fn set_shortcuts(shortcuts: Shortcuts) -> Effect(Msg)

// -- View ----------------------------------------------------------------

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil, context: Context) -> View

// -- Entry point ---------------------------------------------------------

pub fn main(root: Root) -> fn() -> Nil {
  mvu.start(init(), update, view, root)
}
