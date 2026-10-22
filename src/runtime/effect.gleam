import gleam/javascript/promise.{type Promise}

pub type Effect(msg)

pub type Runtime(msg)

@external(javascript, "./runner.mjs", "createRuntime")
pub fn runtime() -> Runtime(msg)

@external(javascript, "./runner.mjs", "stop")
pub fn stop(runtime: Runtime(msg)) -> Nil

@external(javascript, "./runner.mjs", "run")
pub fn run(
  effect: Effect(msg),
  dispatch: fn(msg) -> Nil,
  runtime: Runtime(msg),
) -> Promise(Nil)

@external(javascript, "./runner.mjs", "isActive")
pub fn is_active(runtime: Runtime(msg)) -> Bool
