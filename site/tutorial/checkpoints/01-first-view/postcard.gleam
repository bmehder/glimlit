import runtime/effect.{type Effect}
import runtime/mvu

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(title: String, message: String)
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  NoOp
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      title: "Hello from somewhere nice",
      message: "Wish you were here. The days are slow and the coffee is good.",
    ),
    [],
  )
}

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    NoOp -> #(model, [])
  }
}

// -- Browser boundaries --------------------------------------------------

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

// -- Start ---------------------------------------------------------------

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
