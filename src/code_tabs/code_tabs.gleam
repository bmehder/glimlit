import runtime/effect.{type Effect}
import runtime/mvu
import runtime/view.{type Context, type Root, type View}

// -- Types ---------------------------------------------------------------

pub type Tab {
  View
  ModelAndUpdate
  Effects
}

pub type Navigation {
  Next
  Previous
  First
  Last
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(selected: Tab)
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  UserSelectedTab(Tab)
  UserNavigatedTab(Navigation)
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(Model(selected: View), [])
}

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserSelectedTab(tab) -> #(Model(selected: tab), [])
    UserNavigatedTab(direction) -> {
      let tab = case direction {
        First -> View
        Last -> Effects
        Next ->
          case model.selected {
            View -> ModelAndUpdate
            ModelAndUpdate -> Effects
            Effects -> View
          }
        Previous ->
          case model.selected {
            View -> Effects
            ModelAndUpdate -> View
            Effects -> ModelAndUpdate
          }
      }
      #(Model(selected: tab), [focus_tab(tab)])
    }
  }
}

// -- View ----------------------------------------------------------------

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil, context: Context) -> View

// -- Effects -------------------------------------------------------------

@external(javascript, "./effects.mjs", "focusTab")
fn focus_tab(tab: Tab) -> Effect(Msg)

// -- Entry point ---------------------------------------------------------

pub fn main(root: Root) -> fn() -> Nil {
  mvu.start(init(), update, view, root)
}
