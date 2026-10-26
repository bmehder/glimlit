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

pub type ShortcutStatus {
  Starting
  Listening
  ShortcutFailed(reason: String)
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(
    todos: List(Todo),
    draft: String,
    next_id: TodoId,
    editing: Editing,
    storage: StorageState,
    shortcut_status: ShortcutStatus,
  )
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  UserPressedNewTodoShortcut
  KeyboardShortcutsStarted
  KeyboardShortcutsFailed(reason: String)
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
      shortcut_status: Starting,
    ),
    [load_todos(), watch_shortcuts()],
  )
}

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    UserPressedNewTodoShortcut -> #(model, [focus_new_todo()])

    KeyboardShortcutsStarted -> #(
      Model(..model, shortcut_status: Listening),
      [],
    )

    KeyboardShortcutsFailed(reason) -> #(
      Model(..model, shortcut_status: ShortcutFailed(reason)),
      [log("Todo shortcut failed: " <> reason)],
    )

    LocalStorageReturnedTodos(saved_todos) -> {
      case json.parse(saved_todos, todos_decoder()) {
        Ok(items) -> {
          let next_id =
            list.fold(items, 0, fn(next, item) {
              case item.id >= next {
                True -> item.id + 1
                False -> next
              }
            })
          #(Model(..model, todos: items, next_id: next_id, storage: Ready), [])
        }
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
            [items |> encode |> save_todos, log("Todo added.")],
          )
        }
      }
    }

    UserToggledTodoCompletion(id) -> {
      let todos =
        list.map(model.todos, fn(item) {
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
        })
      let effects = case todos == model.todos {
        True -> []
        False -> [
          todos |> encode |> save_todos,
          log("Todo completion toggled."),
        ]
      }
      #(Model(..model, todos: todos), effects)
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
      case model.editing {
        NotEditing -> #(model, [])
        Editing(id, text) -> {
          case string.trim(text) {
            "" -> #(model, [])
            title -> {
              let todos =
                list.map(model.todos, fn(item) {
                  case item.id == id {
                    True -> Todo(..item, title: title)
                    False -> item
                  }
                })
              let effects = case todos == model.todos {
                True -> []
                False -> [todos |> encode |> save_todos, log("Todo updated.")]
              }
              #(Model(..model, todos: todos, editing: NotEditing), effects)
            }
          }
        }
      }
    }

    UserClickedCancelTodoEdit -> #(Model(..model, editing: NotEditing), [])

    UserClickedDeleteTodo(id) -> {
      let todos = list.filter(model.todos, fn(item) { item.id != id })
      let editing = case model.editing {
        Editing(editing_id, _) if editing_id == id -> NotEditing
        other -> other
      }
      let effects = case todos == model.todos {
        True -> []
        False -> [save_todos(encode(todos)), log("Todo deleted.")]
      }
      #(Model(..model, todos: todos, editing: editing), effects)
    }
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

@external(javascript, "./effects.mjs", "watchShortcuts")
fn watch_shortcuts() -> Effect(Msg)

@external(javascript, "./effects.mjs", "focusNewTodo")
fn focus_new_todo() -> Effect(Msg)

// -- Entry point ---------------------------------------------------------

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
