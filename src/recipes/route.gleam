import gleam/int
import gleam/string

pub type Route {
  Collection
  Detail(Int)
  New
  Edit(Int)
  NotFound
}

pub fn parse(hash: String) -> Route {
  let hash = string.replace(hash, "#", "")
  case string.split(hash, "/") {
    [""] | ["", ""] -> Collection
    ["", "new"] -> New
    ["", "recipe", id] ->
      case int.parse(id) {
        Ok(id) if id > 0 -> Detail(id)
        _ -> NotFound
      }
    ["", "recipe", id, "edit"] ->
      case int.parse(id) {
        Ok(id) if id > 0 -> Edit(id)
        _ -> NotFound
      }
    _ -> NotFound
  }
}

pub fn path(route: Route) -> String {
  case route {
    Collection -> "#/"
    Detail(id) -> "#/recipe/" <> int.to_string(id)
    New -> "#/new"
    Edit(id) -> "#/recipe/" <> int.to_string(id) <> "/edit"
    NotFound -> "#/not-found"
  }
}
