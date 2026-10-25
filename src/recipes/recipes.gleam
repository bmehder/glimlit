import gleam/dynamic/decode
import gleam/int
import gleam/json
import gleam/list
import gleam/result
import gleam/string
import runtime/effect.{type Effect}
import runtime/mvu

// -- Types ---------------------------------------------------------------

pub type Recipe {
  Recipe(
    id: Int,
    title: String,
    description: String,
    minutes: Int,
    ingredients: String,
    instructions: String,
    favorite: Bool,
  )
}

pub type Route {
  Collection
  Detail(Int)
  New
  Edit(Int)
  NotFound
}

pub type Editor {
  Editor(
    title: String,
    description: String,
    minutes: String,
    ingredients: String,
    instructions: String,
    errors: List(String),
  )
}

pub type EditorMsg {
  TitleChanged(String)
  DescriptionChanged(String)
  MinutesChanged(String)
  IngredientsChanged(String)
  InstructionsChanged(String)
}

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

// Derived from the model rather than stored as another source of state.
pub type Screen {
  ScreenLoading
  ScreenRecovery(String)
  ScreenCollection
  ScreenNew(Editor)
  ScreenDetail(Recipe)
  ScreenEdit(Editor, String)
  ScreenNotFound
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(
    recipes: List(Recipe),
    route: Route,
    editor: Editor,
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

// -- Messages ------------------------------------------------------------

pub type Msg {
  RouteChanged(String)
  QueryChanged(String)
  FavoritesToggled
  FavoriteToggled(Int)
  EditorChanged(EditorMsg)
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

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  let model =
    Model(
      recipes: starter_recipes(),
      route: Collection,
      editor: init_editor(),
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

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  let storage_ready = model.storage == Ready
  case msg {
    RouteChanged(hash) -> {
      let next_route = parse_route(hash)
      #(on_route(model, next_route), [focus_content()])
    }
    StorageReturned(source) -> {
      case decode_collection(source) {
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
    StorageEmpty -> #(Model(..model, storage: Ready), [])
    StorageLoadFailed(reason) -> #(
      Model(..model, storage: LoadFailed(reason)),
      [],
    )
    RetryLoad -> #(Model(..model, storage: Loading), [load()])
    UseStarters -> {
      let model = Model(..model, recipes: starter_recipes(), storage: Ready)
      persist_and_navigate(model, Collection)
    }
    // Only loading, recovery, and routing messages above can run before readiness.
    _ if !storage_ready -> #(model, [])
    QueryChanged(query) -> #(Model(..model, query: query), [])
    FavoritesToggled -> #(Model(..model, favorites: !model.favorites), [])
    FavoriteToggled(id) -> {
      let recipes = toggle_favorite(model.recipes, id)
      persist(Model(..model, recipes: recipes))
    }
    EditorChanged(message) -> {
      let draft = update_editor(model.editor, message)
      #(Model(..model, editor: draft), [])
    }
    RecipeSubmitted -> {
      let identity = case model.route {
        New -> Ok(#(next_recipe_id(model.recipes), False))
        Edit(_) ->
          case current_recipe(model) {
            Ok(found) -> Ok(#(found.id, found.favorite))
            Error(_) -> Error(Nil)
          }
        _ -> Error(Nil)
      }
      case identity {
        Error(_) -> #(model, [])
        Ok(#(id, favorite)) ->
          case validate_editor(model.editor, id, favorite) {
            Error(errors) -> {
              let draft = editor_with_errors(model.editor, errors)
              #(Model(..model, editor: draft), [focus_errors()])
            }
            Ok(saved) -> {
              let recipes = put_recipe(model.recipes, saved)
              let notice = case model.route {
                New -> "Recipe added to your collection."
                _ -> "Recipe updated."
              }
              let model = Model(..model, recipes: recipes, notice: notice)
              persist_and_navigate(model, Detail(saved.id))
            }
          }
      }
    }
    DeleteConfirmed(id) -> {
      case find_recipe(model.recipes, id) {
        Error(_) -> #(model, [])
        Ok(_) -> {
          let recipes = remove_recipe(model.recipes, id)
          let model =
            Model(..model, recipes: recipes, notice: "Recipe removed.")
          persist_and_navigate(model, Collection)
        }
      }
    }
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
    ImportRequested -> {
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
        False -> #(model, [])
        True -> {
          case decode_collection(source) {
            Error(_) -> {
              let notice =
                "The sample file was invalid. Your collection is unchanged. Try again."
              #(Model(..model, importing: False, notice: notice), [])
            }
            Ok(samples) -> {
              let recipes = merge_samples(model.recipes, samples)
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
      }
    SamplesFailed(request, reason) ->
      case is_current_import(model, request) {
        True -> #(Model(..model, importing: False, notice: reason), [])
        False -> #(model, [])
      }
  }
}

// -- Model helpers -------------------------------------------------------

fn on_route(model: Model, next: Route) -> Model {
  let draft = case next {
    Edit(id) ->
      case find_recipe(model.recipes, id) {
        Ok(found) -> editor_from_recipe(found)
        Error(_) -> init_editor()
      }
    _ -> init_editor()
  }
  Model(..model, route: next, editor: draft)
}

fn persist(model: Model) -> #(Model, List(Effect(Msg))) {
  let revision = model.revision + 1
  let source = encode_collection(model.recipes)
  let model = Model(..model, revision: revision, saving: Saving)
  #(model, [save(source, revision)])
}

fn persist_and_navigate(
  model: Model,
  destination: Route,
) -> #(Model, List(Effect(Msg))) {
  let model = on_route(model, destination)
  let #(model, effects) = persist(model)
  let navigation = navigate(route_path(destination))
  #(model, list.append(effects, [navigation]))
}

fn is_current_import(model: Model, request: Int) -> Bool {
  // Restarting or cancelling an import makes its earlier results irrelevant.
  request == model.request && model.importing
}

// -- Recipe operations ---------------------------------------------------

pub fn find_recipe(recipes: List(Recipe), id: Int) -> Result(Recipe, Nil) {
  list.find(recipes, fn(recipe) { recipe.id == id })
}

pub fn next_recipe_id(recipes: List(Recipe)) -> Int {
  list.fold(recipes, 1, fn(next, recipe) { int.max(next, recipe.id + 1) })
}

pub fn filter_recipes(
  recipes: List(Recipe),
  query: String,
  favorites: Bool,
) -> List(Recipe) {
  let query = query |> string.trim |> string.lowercase
  list.filter(recipes, fn(recipe) {
    let text =
      recipe.title <> " " <> recipe.description <> " " <> recipe.ingredients
    let matches_search = text |> string.lowercase |> string.contains(query)
    let matches_favorites = !favorites || recipe.favorite
    matches_search && matches_favorites
  })
}

pub fn valid_minutes(minutes: Int) -> Bool {
  minutes > 0 && minutes <= 1440
}

pub fn is_valid_recipe(recipe: Recipe) -> Bool {
  recipe.id > 0
  && valid_minutes(recipe.minutes)
  && string.trim(recipe.title) != ""
  && string.trim(recipe.ingredients) != ""
  && string.trim(recipe.instructions) != ""
}

pub fn toggle_favorite(recipes: List(Recipe), id: Int) -> List(Recipe) {
  list.map(recipes, fn(recipe) {
    case recipe.id == id {
      True -> Recipe(..recipe, favorite: !recipe.favorite)
      False -> recipe
    }
  })
}

pub fn put_recipe(recipes: List(Recipe), saved: Recipe) -> List(Recipe) {
  case find_recipe(recipes, saved.id) {
    Error(_) -> list.append(recipes, [saved])
    Ok(_) ->
      list.map(recipes, fn(recipe) {
        case recipe.id == saved.id {
          True -> saved
          False -> recipe
        }
      })
  }
}

pub fn remove_recipe(recipes: List(Recipe), id: Int) -> List(Recipe) {
  list.filter(recipes, fn(recipe) { recipe.id != id })
}

pub fn merge_samples(
  recipes: List(Recipe),
  samples: List(Recipe),
) -> List(Recipe) {
  let initial = #(recipes, next_recipe_id(recipes))
  let #(merged, _) = list.fold(samples, initial, add_sample)
  merged
}

fn add_sample(
  state: #(List(Recipe), Int),
  sample: Recipe,
) -> #(List(Recipe), Int) {
  let #(recipes, id) = state
  let already_present =
    list.any(recipes, fn(recipe) { recipe.title == sample.title })
  case already_present {
    True -> state
    False -> {
      // Sample IDs belong to the source file, not to this collection.
      let imported = Recipe(..sample, id: id)
      let recipes = list.append(recipes, [imported])
      #(recipes, id + 1)
    }
  }
}

pub fn starter_recipes() -> List(Recipe) {
  [
    Recipe(
      1,
      "Lemon & white bean toast",
      "Bright, creamy, and ready before the kettle boils.",
      10,
      "1 tin white beans, drained\n1 lemon\n2 slices sourdough\n2 tbsp olive oil\nA handful of parsley",
      "Warm the beans in olive oil.\nMash half the beans with lemon zest and a squeeze of juice.\nSpoon onto toasted sourdough and finish with parsley.",
      True,
    ),
    Recipe(
      2,
      "Roasted tomato pasta",
      "A tray of tomatoes does most of the work.",
      35,
      "400g cherry tomatoes\n2 cloves garlic\n200g pasta\n2 tbsp olive oil\nFresh basil",
      "Heat the oven to 200°C. Toss tomatoes and garlic with oil and roast for 25 minutes.\nCook the pasta, reserving a little cooking water.\nToss everything together and finish with basil.",
      False,
    ),
    Recipe(
      3,
      "Apple overnight oats",
      "Tomorrow’s breakfast, sorted tonight.",
      5,
      "80g rolled oats\n150ml milk of your choice\n1 apple, grated\n2 tbsp yoghurt\nA pinch of cinnamon",
      "Stir all the ingredients together in a jar.\nCover and refrigerate overnight.\nAdd more milk to loosen before serving.",
      False,
    ),
  ]
}

// -- Editor validation ---------------------------------------------------

pub fn init_editor() -> Editor {
  Editor(
    title: "",
    description: "",
    minutes: "20",
    ingredients: "",
    instructions: "",
    errors: [],
  )
}

pub fn editor_from_recipe(recipe: Recipe) -> Editor {
  Editor(
    recipe.title,
    recipe.description,
    int.to_string(recipe.minutes),
    recipe.ingredients,
    recipe.instructions,
    [],
  )
}

pub fn update_editor(model: Editor, msg: EditorMsg) -> Editor {
  let model = Editor(..model, errors: [])
  case msg {
    TitleChanged(value) -> Editor(..model, title: value)
    DescriptionChanged(value) -> Editor(..model, description: value)
    MinutesChanged(value) -> Editor(..model, minutes: value)
    IngredientsChanged(value) -> Editor(..model, ingredients: value)
    InstructionsChanged(value) -> Editor(..model, instructions: value)
  }
}

pub fn validate_editor(
  model: Editor,
  id: Int,
  favorite: Bool,
) -> Result(Recipe, List(String)) {
  let minutes = model.minutes |> int.parse |> result.unwrap(0)
  let title = string.trim(model.title)
  let description = string.trim(model.description)
  let ingredients = string.trim(model.ingredients)
  let instructions = string.trim(model.instructions)
  let errors =
    [
      #(title == "", "Give your recipe a title."),
      #(
        !valid_minutes(minutes),
        "Use a whole number of minutes between 1 and 1440.",
      ),
      #(ingredients == "", "Add at least one ingredient."),
      #(instructions == "", "Add the cooking instructions."),
    ]
    |> list.filter_map(fn(item) {
      case item {
        #(True, message) -> Ok(message)
        _ -> Error(Nil)
      }
    })
  case errors {
    [] ->
      Ok(Recipe(
        id,
        title,
        description,
        minutes,
        ingredients,
        instructions,
        favorite,
      ))
    _ -> Error(errors)
  }
}

pub fn editor_with_errors(model: Editor, errors: List(String)) -> Editor {
  Editor(..model, errors: errors)
}

// -- Routes --------------------------------------------------------------

pub fn parse_route(hash: String) -> Route {
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

pub fn route_path(route: Route) -> String {
  case route {
    Collection -> "#/"
    Detail(id) -> "#/recipe/" <> int.to_string(id)
    New -> "#/new"
    Edit(id) -> "#/recipe/" <> int.to_string(id) <> "/edit"
    NotFound -> "#/not-found"
  }
}

// -- JSON encoding and decoding ------------------------------------------

pub fn decode_collection(source: String) -> Result(List(Recipe), Nil) {
  json.parse(source, collection_decoder())
  |> result.replace_error(Nil)
}

pub fn encode_collection(recipes: List(Recipe)) -> String {
  let entries = json.array(recipes, encode_recipe)
  json.object([
    #("version", json.int(1)),
    #("recipes", entries),
  ])
  |> json.to_string
}

fn recipe_decoder() -> decode.Decoder(Recipe) {
  use id <- decode.field("id", decode.int)
  use title <- decode.field("title", decode.string)
  use description <- decode.field("description", decode.string)
  use minutes <- decode.field("minutes", decode.int)
  use ingredients <- decode.field("ingredients", decode.string)
  use instructions <- decode.field("instructions", decode.string)
  use favorite <- decode.field("favorite", decode.bool)
  let decoded =
    Recipe(
      id:,
      title:,
      description:,
      minutes:,
      ingredients:,
      instructions:,
      favorite:,
    )
  case is_valid_recipe(decoded) {
    True -> decode.success(decoded)
    False -> decode.failure(decoded, "a valid recipe")
  }
}

fn collection_decoder() -> decode.Decoder(List(Recipe)) {
  use version <- decode.field("version", decode.int)
  use recipes <- decode.field("recipes", decode.list(recipe_decoder()))
  let ids = list.map(recipes, fn(recipe) { recipe.id })
  let unique_ids = list.unique(ids)
  let valid_collection =
    version == 1 && list.length(ids) == list.length(unique_ids)
  case valid_collection {
    True -> decode.success(recipes)
    False -> decode.failure([], "version 1 with unique recipe IDs")
  }
}

fn encode_recipe(recipe: Recipe) -> json.Json {
  json.object([
    #("id", json.int(recipe.id)),
    #("title", json.string(recipe.title)),
    #("description", json.string(recipe.description)),
    #("minutes", json.int(recipe.minutes)),
    #("ingredients", json.string(recipe.ingredients)),
    #("instructions", json.string(recipe.instructions)),
    #("favorite", json.bool(recipe.favorite)),
  ])
}

// -- View helpers --------------------------------------------------------

pub fn screen(model: Model) -> Screen {
  case model.storage {
    Loading -> ScreenLoading
    LoadFailed(reason) -> ScreenRecovery(reason)
    Ready -> {
      case model.route {
        Collection -> ScreenCollection
        New -> ScreenNew(model.editor)
        Detail(_) ->
          case current_recipe(model) {
            Ok(recipe) -> ScreenDetail(recipe)
            Error(_) -> ScreenNotFound
          }
        Edit(id) ->
          case current_recipe(model) {
            Ok(_) -> ScreenEdit(model.editor, route_path(Detail(id)))
            Error(_) -> ScreenNotFound
          }
        NotFound -> ScreenNotFound
      }
    }
  }
}

pub fn visible_recipes(model: Model) -> List(Recipe) {
  filter_recipes(model.recipes, model.query, model.favorites)
}

pub fn current_recipe(model: Model) -> Result(Recipe, Nil) {
  case model.route {
    Detail(id) | Edit(id) -> find_recipe(model.recipes, id)
    _ -> Error(Nil)
  }
}

pub fn can_import(model: Model) -> Bool {
  model.storage == Ready
}

pub fn saving_message(model: Model) -> String {
  case model.saving {
    Saved -> "Kept in this browser · No account needed"
    Saving -> "Saving in this browser…"
    SaveFailed(reason) -> reason
  }
}

pub fn can_retry_save(model: Model) -> Bool {
  case model.saving {
    SaveFailed(_) -> True
    Saved | Saving -> False
  }
}

// -- View ----------------------------------------------------------------

@external(javascript, "./view.mjs", "view")
fn view(model: Model, dispatch: fn(Msg) -> Nil) -> Nil

// -- Effects -------------------------------------------------------------

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

// -- Entry point ---------------------------------------------------------

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
