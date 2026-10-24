import gleam/list
import recipes/editor
import recipes/recipe.{type Recipe}
import recipes/recipe_json
import recipes/route.{type Route, Collection, Detail, Edit, New}
import runtime/effect.{type Effect}
import runtime/mvu

pub type Storage {
  Loading
  Ready
  LoadFailed(String)
}

pub type Saving {
  Saved
  Saving
  SaveFailed(String)
}

pub type Model {
  Model(
    recipes: List(Recipe),
    route: Route,
    editor: editor.Model,
    query: String,
    favorites: Bool,
    storage: Storage,
    saving: Saving,
    revision: Int,
    request: Int,
    importing: Bool,
    notice: String,
  )
}

pub type Msg {
  RouteChanged(String)
  QueryChanged(String)
  FavoritesToggled
  FavoriteToggled(Int)
  EditorChanged(editor.Msg)
  RecipeSubmitted
  DeleteConfirmed(Int)
  RetryLoad
  UseStarters
  RetrySave
  StorageReturned(String)
  StorageEmpty
  StorageLoadFailed(String)
  CollectionSaved(Int)
  CollectionSaveFailed(Int, String)
  ImportRequested
  ImportCancelled
  SamplesReturned(Int, String)
  SamplesFailed(Int, String)
}

pub fn init() -> #(Model, List(Effect(Msg))) {
  let model =
    Model(
      recipes: recipe.starters(),
      route: Collection,
      editor: editor.init(),
      query: "",
      favorites: False,
      storage: Loading,
      saving: Saved,
      revision: 0,
      request: 0,
      importing: False,
      notice: "",
    )
  #(model, [watch_route(), load()])
}

pub fn visible_recipes(model: Model) -> List(Recipe) {
  recipe.filter(model.recipes, model.query, model.favorites)
}

pub fn current_recipe(model: Model) -> Result(Recipe, Nil) {
  case model.route {
    Detail(id) | Edit(id) -> recipe.find(model.recipes, id)
    _ -> Error(Nil)
  }
}

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    RouteChanged(hash) -> {
      let next_route = route.parse(hash)
      #(on_route(model, next_route), [focus_content()])
    }
    StorageReturned(source) -> restore_collection(model, source)
    StorageEmpty -> #(Model(..model, storage: Ready), [])
    StorageLoadFailed(reason) -> #(
      Model(..model, storage: LoadFailed(reason)),
      [],
    )
    RetryLoad -> #(Model(..model, storage: Loading), [load()])
    UseStarters -> {
      let model = Model(..model, recipes: recipe.starters(), storage: Ready)
      persist_and_navigate(model, Collection)
    }
    _ ->
      case model.storage {
        Ready -> update_ready(model, msg)
        _ -> #(model, [])
      }
  }
}

fn update_ready(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  case msg {
    QueryChanged(query) -> #(Model(..model, query: query), [])
    FavoritesToggled -> #(Model(..model, favorites: !model.favorites), [])
    FavoriteToggled(id) -> {
      let recipes = recipe.toggle_favorite(model.recipes, id)
      persist(Model(..model, recipes: recipes))
    }
    EditorChanged(message) -> {
      let draft = editor.update(model.editor, message)
      #(Model(..model, editor: draft), [])
    }
    RecipeSubmitted -> submit_recipe(model)
    DeleteConfirmed(id) -> delete_recipe(model, id)
    RetrySave -> persist(model)
    CollectionSaved(revision) ->
      case revision == model.revision {
        True -> #(Model(..model, saving: Saved), [])
        False -> #(model, [])
      }
    CollectionSaveFailed(revision, reason) ->
      case revision == model.revision {
        True -> #(Model(..model, saving: SaveFailed(reason)), [])
        False -> #(model, [])
      }
    ImportRequested -> start_import(model)
    ImportCancelled -> #(
      Model(
        ..model,
        request: model.request + 1,
        importing: False,
        notice: "Import cancelled.",
      ),
      [],
    )
    SamplesReturned(request, source) ->
      case is_current_import(model, request) {
        True -> import_samples(model, source)
        False -> #(model, [])
      }
    SamplesFailed(request, reason) ->
      case is_current_import(model, request) {
        True -> #(Model(..model, importing: False, notice: reason), [])
        False -> #(model, [])
      }
    _ -> #(model, [])
  }
}

fn on_route(model: Model, next: Route) -> Model {
  let draft = case next {
    Edit(id) ->
      case recipe.find(model.recipes, id) {
        Ok(found) -> editor.from_recipe(found)
        Error(_) -> editor.init()
      }
    _ -> editor.init()
  }
  Model(..model, route: next, editor: draft)
}

fn restore_collection(
  model: Model,
  source: String,
) -> #(Model, List(Effect(Msg))) {
  case recipe_json.decode_collection(source) {
    Ok(recipes) -> {
      let restored = Model(..model, recipes: recipes, storage: Ready)
      #(on_route(restored, model.route), [])
    }
    Error(_) -> {
      let reason =
        "Saved recipes could not be read. They have not been overwritten."
      #(Model(..model, storage: LoadFailed(reason)), [])
    }
  }
}

fn persist(model: Model) -> #(Model, List(Effect(Msg))) {
  let revision = model.revision + 1
  let source = recipe_json.encode_collection(model.recipes)
  let model = Model(..model, revision: revision, saving: Saving)
  #(model, [save(source, revision)])
}

fn persist_and_navigate(
  model: Model,
  destination: Route,
) -> #(Model, List(Effect(Msg))) {
  let model = on_route(model, destination)
  let #(model, effects) = persist(model)
  let navigation = navigate(route.path(destination))
  #(model, list.append(effects, [navigation]))
}

fn editor_identity(model: Model) -> Result(#(Int, Bool), Nil) {
  case model.route {
    New -> Ok(#(recipe.next_id(model.recipes), False))
    Edit(_) ->
      case current_recipe(model) {
        Ok(found) -> Ok(#(found.id, found.favorite))
        Error(_) -> Error(Nil)
      }
    _ -> Error(Nil)
  }
}

fn submit_recipe(model: Model) -> #(Model, List(Effect(Msg))) {
  case editor_identity(model) {
    Error(_) -> #(model, [])
    Ok(#(id, favorite)) ->
      case editor.validate(model.editor, id, favorite) {
        Ok(saved) -> commit_recipe(model, saved)
        Error(errors) -> {
          let draft = editor.with_errors(model.editor, errors)
          #(Model(..model, editor: draft), [focus_errors()])
        }
      }
  }
}

fn commit_recipe(model: Model, saved: Recipe) -> #(Model, List(Effect(Msg))) {
  let recipes = recipe.put(model.recipes, saved)
  let notice = case model.route {
    New -> "Recipe added to your collection."
    _ -> "Recipe updated."
  }
  let model = Model(..model, recipes: recipes, notice: notice)
  persist_and_navigate(model, Detail(saved.id))
}

fn delete_recipe(model: Model, id: Int) -> #(Model, List(Effect(Msg))) {
  case recipe.find(model.recipes, id) {
    Error(_) -> #(model, [])
    Ok(_) -> {
      let recipes = recipe.remove(model.recipes, id)
      let model = Model(..model, recipes: recipes, notice: "Recipe removed.")
      persist_and_navigate(model, Collection)
    }
  }
}

fn start_import(model: Model) -> #(Model, List(Effect(Msg))) {
  let request = model.request + 1
  let model =
    Model(
      ..model,
      request: request,
      importing: True,
      notice: "Loading sample recipes…",
    )
  #(model, [fetch_samples(request)])
}

fn is_current_import(model: Model, request: Int) -> Bool {
  // Restarting or cancelling an import makes its earlier results irrelevant.
  request == model.request && model.importing
}

fn import_samples(model: Model, source: String) -> #(Model, List(Effect(Msg))) {
  case recipe_json.decode_collection(source) {
    Error(_) -> {
      let notice =
        "The sample file was invalid. Your collection is unchanged. Try again."
      #(Model(..model, importing: False, notice: notice), [])
    }
    Ok(samples) -> {
      let recipes = recipe.merge_samples(model.recipes, samples)
      let model =
        Model(
          ..model,
          recipes: recipes,
          importing: False,
          notice: "Sample recipes imported. Existing titles were kept.",
        )
      persist(model)
    }
  }
}

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

@external(javascript, "./effects.mjs", "load")
fn load() -> Effect(Msg)

@external(javascript, "./effects.mjs", "save")
fn save(source: String, revision: Int) -> Effect(Msg)

@external(javascript, "./effects.mjs", "fetchSamples")
fn fetch_samples(request: Int) -> Effect(Msg)

@external(javascript, "./effects.mjs", "watchRoute")
fn watch_route() -> Effect(Msg)

@external(javascript, "./effects.mjs", "navigate")
fn navigate(hash: String) -> Effect(Msg)

@external(javascript, "./effects.mjs", "focusErrors")
fn focus_errors() -> Effect(Msg)

@external(javascript, "./effects.mjs", "focusContent")
fn focus_content() -> Effect(Msg)

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
