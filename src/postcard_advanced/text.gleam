// Distinct names for editable postcard text. Drafts may be empty; validation
// checks whether a value is ready to save without changing its contents.
import gleam/string

// -- Types ---------------------------------------------------------------

pub opaque type Title {
  Title(value: String)
}

pub opaque type Message {
  Message(value: String)
}

// -- Construction and access ---------------------------------------------

pub fn new_title(value: String) -> Title {
  Title(value)
}

pub fn new_message(value: String) -> Message {
  Message(value)
}

pub fn title_text(title: Title) -> String {
  title.value
}

pub fn message_text(message: Message) -> String {
  message.value
}

// -- Save validation -----------------------------------------------------

pub fn validate_title(title: Title) -> Result(Title, Nil) {
  case string.trim(title.value) {
    "" -> Error(Nil)
    _ -> Ok(title)
  }
}

pub fn validate_message(message: Message) -> Result(Message, Nil) {
  case string.trim(message.value) {
    "" -> Error(Nil)
    _ -> Ok(message)
  }
}
