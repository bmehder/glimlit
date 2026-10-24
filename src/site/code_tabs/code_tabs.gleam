import runtime/effect.{type Effect}
import runtime/mvu

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

pub type Model {
  Model(selected: Tab)
}

pub type Msg {
  UserSelectedTab(Tab)
  UserNavigatedTab(Tab, Navigation)
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(Model(selected: View), [])
}

pub fn update(_model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserSelectedTab(tab) -> #(Model(selected: tab), [])
    UserNavigatedTab(from, direction) -> {
      let tab = navigate(from, direction)
      #(Model(selected: tab), [focus_tab(tab_id(tab))])
    }
  }
}

fn navigate(from: Tab, direction: Navigation) -> Tab {
  case direction {
    First -> View
    Last -> Effects
    Next ->
      case from {
        View -> ModelAndUpdate
        ModelAndUpdate -> Effects
        Effects -> View
      }
    Previous ->
      case from {
        View -> Effects
        ModelAndUpdate -> View
        Effects -> ModelAndUpdate
      }
  }
}

pub fn tab_id(tab: Tab) -> String {
  case tab {
    View -> "view-tab"
    ModelAndUpdate -> "model-tab"
    Effects -> "effects-tab"
  }
}

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

@external(javascript, "./effects.mjs", "focusTab")
fn focus_tab(id: String) -> Effect(Msg)

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
