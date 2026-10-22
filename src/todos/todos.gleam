import gleam/dynamic/decode
import gleam/json
import gleam/list
import gleam/string
import runtime/effect.{type Effect}
import runtime/mvu

// -- Types ---------------------------------------------------------------

pub type TodoId =
  Int

pub type Status {
  Active
  Completed
}

pub type Editing {
  NotEditing
  Editing(id: TodoId, text: String)
}

pub type Todo {
  Todo(id: TodoId, title: String, status: Status)
}

pub type StorageState {
  Loading
  Ready
  Failed(reason: String)
}

pub type FetchState {
  NotRequested
  Fetching
  Fetched
  FetchFailed(reason: String)
}

pub type SubscriptionState {
  Stopped
  Starting
  Running
  Stopping
  SubscriptionFailed(reason: String)
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(
    todos: List(Todo),
    draft: String,
    next_id: TodoId,
    editing: Editing,
    storage: StorageState,
    fetch: FetchState,
    clock: SubscriptionState,
    clock_time: Int,
    resize: SubscriptionState,
    window_width: Int,
    window_height: Int,
  )
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  UserClickedStartResize
  UserClickedStopResize
  WindowResizeStarted
  WindowResized(width: Int, height: Int)
  WindowResizeStopped
  WindowResizeSubscriptionFailed(reason: String)
  UserClickedStartClock
  UserClickedStopClock
  ClockStarted
  ClockTicked(now: Int)
  ClockStopped
  ClockSubscriptionFailed(reason: String)
  UserClickedFetchTodo
  HttpReturnedTodo(json: String)
  HttpTodoRequestFailed(reason: String)
  LocalStorageReturnedTodos(json: String)
  LocalStorageHadNoTodos
  LocalStorageSavedTodos
  LocalStorageFailed(reason: String)
  UserTypedNewTodo(text: String)
  UserSubmittedNewTodo
  UserToggledTodoCompletion(id: TodoId)
  UserClickedEditTodo(id: TodoId)
  UserTypedTodoEdit(text: String)
  UserSubmittedTodoEdit
  UserClickedCancelTodoEdit
  UserClickedDeleteTodo(id: TodoId)
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  #(
    Model(
      todos: [
        Todo(0, "Buy groceries", Active),
        Todo(1, "Take a walk", Active),
        Todo(2, "Read a chapter", Active),
      ],
      draft: "",
      next_id: 3,
      editing: NotEditing,
      storage: Loading,
      fetch: NotRequested,
      clock: Stopped,
      clock_time: 0,
      resize: Stopped,
      window_width: 0,
      window_height: 0,
    ),
    [load_todos()],
  )
}

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserClickedStartResize -> {
      case model.resize {
        Stopped | SubscriptionFailed(_) -> #(Model(..model, resize: Starting), [
          start_resize(),
        ])
        _ -> #(model, [])
      }
    }

    WindowResizeStarted -> #(Model(..model, resize: Running), [])

    WindowResized(width, height) -> {
      case model.resize {
        Starting | Running -> #(
          Model(..model, window_width: width, window_height: height),
          [],
        )
        _ -> #(model, [])
      }
    }

    UserClickedStopResize -> {
      case model.resize {
        Running -> #(Model(..model, resize: Stopping), [stop_resize()])
        _ -> #(model, [])
      }
    }

    WindowResizeStopped -> #(Model(..model, resize: Stopped), [])

    WindowResizeSubscriptionFailed(reason) -> #(
      Model(..model, resize: SubscriptionFailed(reason)),
      [log("Window resize subscription failed: " <> reason)],
    )

    UserClickedStartClock -> {
      case model.clock {
        Stopped | SubscriptionFailed(_) -> #(Model(..model, clock: Starting), [
          start_clock(),
        ])
        _ -> #(model, [])
      }
    }

    ClockStarted -> #(Model(..model, clock: Running), [])

    ClockTicked(now) -> {
      case model.clock {
        Running -> #(Model(..model, clock_time: now), [])
        _ -> #(model, [])
      }
    }

    UserClickedStopClock -> {
      case model.clock {
        Running -> #(Model(..model, clock: Stopping), [stop_clock()])
        _ -> #(model, [])
      }
    }

    ClockStopped -> #(Model(..model, clock: Stopped), [])

    ClockSubscriptionFailed(reason) -> #(
      Model(..model, clock: SubscriptionFailed(reason)),
      [log("Clock subscription failed: " <> reason)],
    )

    UserClickedFetchTodo -> {
      case model.fetch {
        Fetching -> #(model, [])
        _ -> #(Model(..model, fetch: Fetching), [fetch_example()])
      }
    }

    HttpReturnedTodo(response) -> #(Model(..model, fetch: Fetched), [
      log("Fetched example todo: " <> response),
    ])

    HttpTodoRequestFailed(reason) -> #(
      Model(..model, fetch: FetchFailed(reason)),
      [
        log("Example fetch failed: " <> reason),
      ],
    )

    LocalStorageReturnedTodos(saved) -> {
      case json.parse(saved, todos_decoder()) {
        Ok(items) -> #(
          Model(..model, todos: items, next_id: next_id(items), storage: Ready),
          [],
        )
        Error(_) -> {
          let reason = "Saved todos could not be read."
          #(Model(..model, storage: Failed(reason)), [log(reason)])
        }
      }
    }

    LocalStorageHadNoTodos | LocalStorageSavedTodos -> #(
      Model(..model, storage: Ready),
      [],
    )

    LocalStorageFailed(reason) -> #(Model(..model, storage: Failed(reason)), [
      log("Todo storage failed: " <> reason),
    ])

    UserTypedNewTodo(text) -> #(Model(..model, draft: text), [])

    UserSubmittedNewTodo -> {
      case string.trim(model.draft) {
        "" -> #(model, [])
        title -> {
          let items =
            list.append(model.todos, [Todo(model.next_id, title, Active)])
          #(
            Model(..model, todos: items, draft: "", next_id: model.next_id + 1),
            [save_todos(encode(items)), log("Todo added.")],
          )
        }
      }
    }

    UserToggledTodoCompletion(id) -> {
      let items = list.map(model.todos, fn(item) { toggle_todo(item, id) })
      let effects = case items == model.todos {
        True -> []
        False -> [save_todos(encode(items)), log("Todo completion toggled.")]
      }
      #(Model(..model, todos: items), effects)
    }

    UserClickedEditTodo(id) -> {
      case list.find(model.todos, fn(item) { item.id == id }) {
        Ok(item) -> #(Model(..model, editing: Editing(id, item.title)), [])
        Error(_) -> #(model, [])
      }
    }

    UserTypedTodoEdit(text) -> {
      case model.editing {
        NotEditing -> #(model, [])
        Editing(id, _) -> #(Model(..model, editing: Editing(id, text)), [])
      }
    }

    UserSubmittedTodoEdit -> {
      case edit_details(model.editing) {
        Error(_) -> #(model, [])
        Ok(#(id, title)) -> {
          let items =
            list.map(model.todos, fn(item) {
              case item.id == id {
                True -> Todo(..item, title: title)
                False -> item
              }
            })
          let effects = case items == model.todos {
            True -> []
            False -> [save_todos(encode(items)), log("Todo updated.")]
          }
          #(Model(..model, todos: items, editing: NotEditing), effects)
        }
      }
    }

    UserClickedCancelTodoEdit -> #(Model(..model, editing: NotEditing), [])

    UserClickedDeleteTodo(id) -> {
      let items = list.filter(model.todos, fn(item) { item.id != id })
      let editing = case model.editing {
        Editing(editing_id, _) if editing_id == id -> NotEditing
        other -> other
      }
      let effects = case items == model.todos {
        True -> []
        False -> [save_todos(encode(items)), log("Todo deleted.")]
      }
      #(Model(..model, todos: items, editing: editing), effects)
    }
  }
}

// -- Model helpers -------------------------------------------------------

fn next_id(items: List(Todo)) -> TodoId {
  list.fold(items, 0, fn(next, item) {
    case item.id >= next {
      True -> item.id + 1
      False -> next
    }
  })
}

fn toggle_todo(item: Todo, id: TodoId) -> Todo {
  case item.id == id {
    False -> item
    True -> {
      let status = case item.status {
        Active -> Completed
        Completed -> Active
      }
      Todo(..item, status: status)
    }
  }
}

fn edit_details(editing: Editing) -> Result(#(TodoId, String), Nil) {
  case editing {
    NotEditing -> Error(Nil)
    Editing(id, text) -> {
      case string.trim(text) {
        "" -> Error(Nil)
        title -> Ok(#(id, title))
      }
    }
  }
}

// -- View helpers --------------------------------------------------------

pub fn resize_can_start(model: Model) -> Bool {
  case model.resize {
    Stopped | SubscriptionFailed(_) -> True
    _ -> False
  }
}

pub fn resize_can_stop(model: Model) -> Bool {
  model.resize == Running
}

pub fn resize_message(model: Model) -> String {
  case model.resize {
    Stopped -> "Stopped · start to watch the window size"
    Starting -> "Starting…"
    Running -> "Watching window size"
    Stopping -> "Stopping…"
    SubscriptionFailed(reason) -> "Resize error: " <> reason
  }
}

pub fn clock_can_start(model: Model) -> Bool {
  case model.clock {
    Stopped | SubscriptionFailed(_) -> True
    _ -> False
  }
}

pub fn clock_can_stop(model: Model) -> Bool {
  model.clock == Running
}

pub fn clock_message(model: Model) -> String {
  case model.clock {
    Stopped -> "Stopped"
    Starting -> "Starting…"
    Running -> "Running · ticks every second"
    Stopping -> "Stopping…"
    SubscriptionFailed(reason) -> "Clock error: " <> reason
  }
}

pub fn is_fetching(model: Model) -> Bool {
  model.fetch == Fetching
}

pub fn fetch_message(model: Model) -> String {
  case model.fetch {
    NotRequested -> "Fetch a sample todo without adding it to your list."
    Fetching -> "Fetching…"
    Fetched -> "Response logged to the console."
    FetchFailed(reason) -> "Could not fetch: " <> reason
  }
}

pub fn storage_message(model: Model) -> String {
  case model.storage {
    Loading -> "Loading saved todos…"
    Ready -> "Todos are saved in this browser."
    Failed(reason) -> reason <> " Changes are only in memory."
  }
}

// -- JSON encoding and decoding ------------------------------------------

fn encode(items: List(Todo)) -> String {
  items
  |> json.array(fn(item) {
    json.object([
      #("id", json.int(item.id)),
      #("title", json.string(item.title)),
      #(
        "status",
        json.string(case item.status {
          Active -> "active"
          Completed -> "completed"
        }),
      ),
    ])
  })
  |> json.to_string
}

fn todos_decoder() -> decode.Decoder(List(Todo)) {
  use items <- decode.then(decode.list(todo_decoder()))
  let ids = list.map(items, fn(item) { item.id })
  case list.length(list.unique(ids)) == list.length(ids) {
    True -> decode.success(items)
    False -> decode.failure([], "unique todo IDs")
  }
}

fn todo_decoder() -> decode.Decoder(Todo) {
  use id <- decode.field("id", decode.int)
  use title <- decode.field("title", decode.string)
  use status <- decode.field("status", status_decoder())
  case id >= 0 && id < 9_007_199_254_740_991 && string.trim(title) != "" {
    True -> decode.success(Todo(id, title, status))
    False -> decode.failure(Todo(0, "", Active), "valid todo")
  }
}

fn status_decoder() -> decode.Decoder(Status) {
  use status <- decode.then(decode.string)
  case status {
    "active" -> decode.success(Active)
    "completed" -> decode.success(Completed)
    _ -> decode.failure(Active, "active or completed")
  }
}

// -- View ----------------------------------------------------------------

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

// -- Effects -------------------------------------------------------------

@external(javascript, "./effects.mjs", "loadTodos")
fn load_todos() -> Effect(Msg)

@external(javascript, "./effects.mjs", "saveTodos")
fn save_todos(json: String) -> Effect(Msg)

@external(javascript, "./effects.mjs", "log")
fn log(message: String) -> Effect(Msg)

@external(javascript, "./effects.mjs", "fetchExample")
fn fetch_example() -> Effect(Msg)

@external(javascript, "./effects.mjs", "startClock")
fn start_clock() -> Effect(Msg)

@external(javascript, "./effects.mjs", "stopClock")
fn stop_clock() -> Effect(Msg)

@external(javascript, "./effects.mjs", "startResize")
fn start_resize() -> Effect(Msg)

@external(javascript, "./effects.mjs", "stopResize")
fn stop_resize() -> Effect(Msg)

// -- Entry point ---------------------------------------------------------

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
