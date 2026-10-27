import gleam/dynamic/decode
import gleam/json
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

fn design_decoder() -> decode.Decoder(#(String, String, Theme)) {
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

fn next_theme(theme: Theme) -> Theme {
  case theme {
    Coral -> Ocean
    Ocean -> Meadow
    Meadow -> Coral
  }
}

pub type Model {
  Model(
    title: String,
    message: String,
    theme: Theme,
    notice: String,
    shortcuts: Bool,
  )
}

pub type Msg {
  UserChangedTitle(String)
  UserChangedMessage(String)
  UserSelectedTheme(Theme)
  UserClickedSave
  DesignSaved
  StorageFailed(String)
  UserClickedRestore
  StorageReturnedDesign(String)
  StorageWasEmpty
  UserToggledShortcuts
  ShortcutsChanged(Bool)
  ShortcutsFailed(String)
  UserPressedNextTheme
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      title: "Hello from somewhere nice",
      message: "Wish you were here. The days are slow and the coffee is good.",
      theme: Coral,
      notice: "Your design stays in this tab until you save it.",
      shortcuts: False,
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

    UserClickedRestore -> #(model, [load_design()])

    StorageWasEmpty -> #(
      Model(..model, notice: "No saved design yet. Save one first."),
      [],
    )

    StorageReturnedDesign(saved) -> {
      case json.parse(saved, design_decoder()) {
        Ok(#(title, message, theme)) -> #(
          Model(
            ..model,
            title: title,
            message: message,
            theme: theme,
            notice: "Restored your saved design.",
          ),
          [],
        )
        Error(_) -> #(
          Model(..model, notice: "The saved design could not be read."),
          [],
        )
      }
    }

    UserToggledShortcuts -> #(model, [set_shortcuts(!model.shortcuts)])

    ShortcutsChanged(enabled) -> #(Model(..model, shortcuts: enabled), [])

    ShortcutsFailed(reason) -> #(Model(..model, notice: reason), [])

    UserPressedNextTheme -> {
      case model.shortcuts {
        True -> #(Model(..model, theme: next_theme(model.theme)), [])
        False -> #(model, [])
      }
    }
  }
}

@external(javascript, "./effects.mjs", "saveDesign")
fn save_design(title: String, message: String, theme: String) -> Effect(Msg)

@external(javascript, "./effects.mjs", "loadDesign")
fn load_design() -> Effect(Msg)

@external(javascript, "./effects.mjs", "setShortcuts")
fn set_shortcuts(enabled: Bool) -> Effect(Msg)

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
