import gleam/dynamic/decode
import gleam/int
import gleam/json
import gleam/list
import gleam/result
import gleam/string
import runtime/effect.{type Effect}
import runtime/mvu

// -- Types ---------------------------------------------------------------

pub type RecipeId =
  Int

pub type SaveId =
  Int

pub type ImportRequestId =
  Int

pub type CookingMinutes =
  Int

pub type RouteHash =
  String

pub type RecipeFilter {
  AllRecipes
  FavoritesOnly
}

pub type SampleImportState {
  ImportIdle
  ImportInProgress
}

pub type Recipe {
  Recipe(
    id: RecipeId,
    title: String,
    description: String,
    minutes: CookingMinutes,
    ingredients: String,
    instructions: String,
    favorite: Bool,
  )
}

pub type Route {
  Collection
  Detail(id: RecipeId)
  New
  Edit(id: RecipeId)
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

pub type Storage {
  Loading
  Ready
  LoadFailed(reason: String)
}

pub type SaveStatus {
  Saved
  Saving
  SaveFailed(reason: String)
}

// Derived from the model rather than stored as another source of state.
pub type Screen {
  ScreenLoading
  ScreenRecovery(reason: String)
  ScreenCollection
  ScreenNew(editor: Editor)
  ScreenDetail(recipe: Recipe)
  ScreenEdit(editor: Editor, cancel_path: RouteHash)
  ScreenNotFound
}

// -- Model ---------------------------------------------------------------

pub type Model {
  Model(
    recipes: List(Recipe),
    route: Route,
    editor: Editor,
    query: String,
    filter: RecipeFilter,
    storage: Storage,
    save_status: SaveStatus,
    save_id: SaveId,
    import_request_id: ImportRequestId,
    sample_import: SampleImportState,
    notice: String,
  )
}

// -- Messages ------------------------------------------------------------

pub type Msg {
  BrowserHashChanged(hash: RouteHash)
  UserChangedQuery(query: String)
  UserToggledFavorites
  UserToggledFavorite(id: RecipeId)
  UserChangedTitle(title: String)
  UserChangedDescription(description: String)
  UserChangedMinutes(minutes: String)
  UserChangedIngredients(ingredients: String)
  UserChangedInstructions(instructions: String)
  UserSubmittedRecipe
  UserConfirmedDelete(id: RecipeId)
  UserClickedRetryLoad
  UserClickedUseStarters
  UserClickedRetrySave
  LocalStorageReturnedRecipes(json: String)
  LocalStorageHadNoRecipes
  LocalStorageLoadFailed(reason: String)
  LocalStorageSavedRecipes(save_id: SaveId)
  LocalStorageSaveFailed(save_id: SaveId, reason: String)
  UserClickedImportSamples
  UserCancelledImport
  HttpReturnedSamples(request: ImportRequestId, json: String)
  HttpSamplesRequestFailed(request: ImportRequestId, reason: String)
}

// -- Initial state -------------------------------------------------------

pub fn init() -> #(Model, List(Effect(Msg))) {
  let model =
    Model(
      recipes: starter_recipes(),
      route: Collection,
      editor: init_editor(),
      query: "",
      filter: AllRecipes,
      storage: Loading,
      save_status: Saved,
      save_id: 0,
      import_request_id: 0,
      sample_import: ImportIdle,
      notice: "",
    )
  #(model, [watch_route(), load()])
}

// -- Update --------------------------------------------------------------

pub fn update(model: Model, msg: Msg) -> #(Model, List(Effect(Msg))) {
  let storage_ready = model.storage == Ready
  case msg {
    BrowserHashChanged(hash) -> {
      let next_route = parse_route(hash)
      #(handle_route(model, route: next_route), [focus_content()])
    }
    LocalStorageReturnedRecipes(source) -> {
      case decode_collection(source) {
        Ok(recipes) -> {
          let restored = Model(..model, recipes: recipes, storage: Ready)
          #(handle_route(restored, route: model.route), [])
        }
        Error(_) -> {
          let reason =
            "Saved recipes could not be read. They have not been overwritten."
          #(Model(..model, storage: LoadFailed(reason)), [])
        }
      }
    }
    LocalStorageHadNoRecipes -> #(Model(..model, storage: Ready), [])
    LocalStorageLoadFailed(reason) -> #(
      Model(..model, storage: LoadFailed(reason)),
      [],
    )
    UserClickedRetryLoad -> #(Model(..model, storage: Loading), [load()])
    UserClickedUseStarters -> {
      let model = Model(..model, recipes: starter_recipes(), storage: Ready)
      persist_and_navigate(model, destination: Collection)
    }
    // Only loading, recovery, and routing messages above can run before readiness.
    _ if !storage_ready -> #(model, [])
    UserChangedQuery(query) -> #(Model(..model, query: query), [])
    UserToggledFavorites -> {
      let filter = case model.filter {
        AllRecipes -> FavoritesOnly
        FavoritesOnly -> AllRecipes
      }
      #(Model(..model, filter: filter), [])
    }
    UserToggledFavorite(id) -> {
      let recipes = toggle_favorite(model.recipes, id: id)
      persist(Model(..model, recipes: recipes))
    }
    UserChangedTitle(value) -> {
      let draft = Editor(..model.editor, title: value, errors: [])
      #(Model(..model, editor: draft), [])
    }
    UserChangedDescription(value) -> {
      let draft = Editor(..model.editor, description: value, errors: [])
      #(Model(..model, editor: draft), [])
    }
    UserChangedMinutes(value) -> {
      let draft = Editor(..model.editor, minutes: value, errors: [])
      #(Model(..model, editor: draft), [])
    }
    UserChangedIngredients(value) -> {
      let draft = Editor(..model.editor, ingredients: value, errors: [])
      #(Model(..model, editor: draft), [])
    }
    UserChangedInstructions(value) -> {
      let draft = Editor(..model.editor, instructions: value, errors: [])
      #(Model(..model, editor: draft), [])
    }
    UserSubmittedRecipe -> {
      let validation = case model.route {
        New ->
          Ok(validate_editor(
            model.editor,
            id: next_recipe_id(model.recipes),
            favorite: False,
          ))
        Edit(_) ->
          case current_recipe(model) {
            Ok(found) ->
              Ok(validate_editor(
                model.editor,
                id: found.id,
                favorite: found.favorite,
              ))
            Error(_) -> Error(Nil)
          }
        _ -> Error(Nil)
      }
      case validation {
        Error(_) -> #(model, [])
        Ok(result) ->
          case result {
            Error(errors) -> {
              let draft = editor_with_errors(model.editor, errors: errors)
              #(Model(..model, editor: draft), [focus_errors()])
            }
            Ok(saved) -> {
              let recipes = put_recipe(model.recipes, recipe: saved)
              let notice = case model.route {
                New -> "Recipe added to your collection."
                _ -> "Recipe updated."
              }
              let model = Model(..model, recipes: recipes, notice: notice)
              persist_and_navigate(model, destination: Detail(id: saved.id))
            }
          }
      }
    }
    UserConfirmedDelete(id) -> {
      case find_recipe(model.recipes, id: id) {
        Error(_) -> #(model, [])
        Ok(_) -> {
          let recipes = remove_recipe(model.recipes, id: id)
          let model =
            Model(..model, recipes: recipes, notice: "Recipe removed.")
          persist_and_navigate(model, destination: Collection)
        }
      }
    }
    UserClickedRetrySave -> persist(model)
    LocalStorageSavedRecipes(save_id) ->
      case save_id == model.save_id {
        True -> #(Model(..model, save_status: Saved), [])
        False -> #(model, [])
      }
    LocalStorageSaveFailed(save_id, reason) ->
      case save_id == model.save_id {
        True -> #(Model(..model, save_status: SaveFailed(reason)), [])
        False -> #(model, [])
      }
    UserClickedImportSamples -> {
      let request = model.import_request_id + 1
      let model =
        Model(
          ..model,
          import_request_id: request,
          sample_import: ImportInProgress,
          notice: "Loading sample recipes…",
        )
      #(model, [fetch_samples(request)])
    }
    UserCancelledImport -> #(
      Model(
        ..model,
        import_request_id: model.import_request_id + 1,
        sample_import: ImportIdle,
        notice: "Import cancelled.",
      ),
      [],
    )
    HttpReturnedSamples(request, source) ->
      case is_current_import(model, request_id: request) {
        False -> #(model, [])
        True -> {
          case decode_collection(source) {
            Error(_) -> {
              let notice =
                "The sample file was invalid. Your collection is unchanged. Try again."
              #(Model(..model, sample_import: ImportIdle, notice: notice), [])
            }
            Ok(samples) -> {
              let recipes = merge_samples(model.recipes, samples: samples)
              let model =
                Model(
                  ..model,
                  recipes: recipes,
                  sample_import: ImportIdle,
                  notice: "Sample recipes imported. Existing titles were kept.",
                )
              persist(model)
            }
          }
        }
      }
    HttpSamplesRequestFailed(request, reason) ->
      case is_current_import(model, request_id: request) {
        True -> #(Model(..model, sample_import: ImportIdle, notice: reason), [])
        False -> #(model, [])
      }
  }
}

// -- Model helpers -------------------------------------------------------

fn handle_route(model: Model, route next: Route) -> Model {
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
  let save_id = model.save_id + 1
  let source = encode_collection(model.recipes)
  let model = Model(..model, save_id: save_id, save_status: Saving)
  #(model, [save(source, save_id: save_id)])
}

fn persist_and_navigate(
  model: Model,
  destination destination: Route,
) -> #(Model, List(Effect(Msg))) {
  let model = handle_route(model, route: destination)
  let #(model, effects) = persist(model)
  let navigation = destination |> route_path |> navigate
  #(model, list.append(effects, [navigation]))
}

fn is_current_import(
  model: Model,
  request_id request_id: ImportRequestId,
) -> Bool {
  // Restarting or cancelling an import makes its earlier results irrelevant.
  request_id == model.import_request_id
  && model.sample_import == ImportInProgress
}

// -- Recipe operations ---------------------------------------------------

pub fn find_recipe(
  recipes: List(Recipe),
  id id: RecipeId,
) -> Result(Recipe, Nil) {
  list.find(recipes, fn(recipe) { recipe.id == id })
}

pub fn next_recipe_id(recipes: List(Recipe)) -> RecipeId {
  list.fold(recipes, 1, fn(next, recipe) { int.max(next, recipe.id + 1) })
}

pub fn filter_recipes(
  recipes: List(Recipe),
  query query: String,
  filter filter: RecipeFilter,
) -> List(Recipe) {
  let query = query |> string.trim |> string.lowercase
  list.filter(recipes, fn(recipe) {
    let text =
      recipe.title <> " " <> recipe.description <> " " <> recipe.ingredients
    let matches_search = text |> string.lowercase |> string.contains(query)
    let matches_filter = filter == AllRecipes || recipe.favorite
    matches_search && matches_filter
  })
}

pub fn valid_minutes(minutes: CookingMinutes) -> Bool {
  minutes > 0 && minutes <= 1440
}

pub fn is_valid_recipe(recipe: Recipe) -> Bool {
  recipe.id > 0
  && valid_minutes(recipe.minutes)
  && string.trim(recipe.title) != ""
  && string.trim(recipe.ingredients) != ""
  && string.trim(recipe.instructions) != ""
}

pub fn toggle_favorite(recipes: List(Recipe), id id: RecipeId) -> List(Recipe) {
  list.map(recipes, fn(recipe) {
    case recipe.id == id {
      True -> {
        Recipe(..recipe, favorite: !recipe.favorite)
      }
      False -> recipe
    }
  })
}

pub fn put_recipe(recipes: List(Recipe), recipe saved: Recipe) -> List(Recipe) {
  case find_recipe(recipes, id: saved.id) {
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

pub fn remove_recipe(recipes: List(Recipe), id id: RecipeId) -> List(Recipe) {
  list.filter(recipes, fn(recipe) { recipe.id != id })
}

pub fn merge_samples(
  recipes: List(Recipe),
  samples samples: List(Recipe),
) -> List(Recipe) {
  let initial = #(recipes, next_recipe_id(recipes))
  let #(merged, _) = list.fold(samples, initial, add_sample)
  merged
}

fn add_sample(
  state: #(List(Recipe), RecipeId),
  sample: Recipe,
) -> #(List(Recipe), RecipeId) {
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
      id: 1,
      title: "Lemon & white bean toast",
      description: "Bright, creamy, and ready before the kettle boils.",
      minutes: 10,
      ingredients: "1 tin white beans, drained\n1 lemon\n2 slices sourdough\n2 tbsp olive oil\nA handful of parsley",
      instructions: "Warm the beans in olive oil.\nMash half the beans with lemon zest and a squeeze of juice.\nSpoon onto toasted sourdough and finish with parsley.",
      favorite: True,
    ),
    Recipe(
      id: 2,
      title: "Roasted tomato pasta",
      description: "A tray of tomatoes does most of the work.",
      minutes: 35,
      ingredients: "400g cherry tomatoes\n2 cloves garlic\n200g pasta\n2 tbsp olive oil\nFresh basil",
      instructions: "Heat the oven to 200°C. Toss tomatoes and garlic with oil and roast for 25 minutes.\nCook the pasta, reserving a little cooking water.\nToss everything together and finish with basil.",
      favorite: False,
    ),
    Recipe(
      id: 3,
      title: "Apple overnight oats",
      description: "Tomorrow’s breakfast, sorted tonight.",
      minutes: 5,
      ingredients: "80g rolled oats\n150ml milk of your choice\n1 apple, grated\n2 tbsp yoghurt\nA pinch of cinnamon",
      instructions: "Stir all the ingredients together in a jar.\nCover and refrigerate overnight.\nAdd more milk to loosen before serving.",
      favorite: False,
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
    title: recipe.title,
    description: recipe.description,
    minutes: int.to_string(recipe.minutes),
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    errors: [],
  )
}

pub fn validate_editor(
  editor: Editor,
  id id: RecipeId,
  favorite favorite: Bool,
) -> Result(Recipe, List(String)) {
  let minutes = editor.minutes |> int.parse |> result.unwrap(0)
  let title = string.trim(editor.title)
  let description = string.trim(editor.description)
  let ingredients = string.trim(editor.ingredients)
  let instructions = string.trim(editor.instructions)
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
        id: id,
        title: title,
        description: description,
        minutes: minutes,
        ingredients: ingredients,
        instructions: instructions,
        favorite: favorite,
      ))
    _ -> Error(errors)
  }
}

pub fn editor_with_errors(
  editor: Editor,
  errors errors: List(String),
) -> Editor {
  Editor(..editor, errors: errors)
}

// -- Routes --------------------------------------------------------------

pub fn parse_route(hash: RouteHash) -> Route {
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

pub fn route_path(route: Route) -> RouteHash {
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
            Ok(_) ->
              ScreenEdit(
                editor: model.editor,
                cancel_path: route_path(Detail(id)),
              )
            Error(_) -> ScreenNotFound
          }
        NotFound -> ScreenNotFound
      }
    }
  }
}

pub fn visible_recipes(model: Model) -> List(Recipe) {
  filter_recipes(model.recipes, query: model.query, filter: model.filter)
}

pub fn current_recipe(model: Model) -> Result(Recipe, Nil) {
  case model.route {
    Detail(id) | Edit(id) -> find_recipe(model.recipes, id: id)
    _ -> Error(Nil)
  }
}

pub fn can_import(model: Model) -> Bool {
  model.storage == Ready
}

pub fn saving_message(model: Model) -> String {
  case model.save_status {
    Saved -> "Kept in this browser · No account needed"
    Saving -> "Saving in this browser…"
    SaveFailed(reason) -> reason
  }
}

pub fn can_retry_save(model: Model) -> Bool {
  case model.save_status {
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
fn save(source: String, save_id save_id: SaveId) -> Effect(Msg)

@external(javascript, "./effects.mjs", "fetchSamples")
fn fetch_samples(request: ImportRequestId) -> Effect(Msg)

@external(javascript, "./effects.mjs", "watchRoute")
fn watch_route() -> Effect(Msg)

@external(javascript, "./effects.mjs", "navigate")
fn navigate(hash: RouteHash) -> Effect(Msg)

@external(javascript, "./effects.mjs", "focusErrors")
fn focus_errors() -> Effect(Msg)

@external(javascript, "./effects.mjs", "focusContent")
fn focus_content() -> Effect(Msg)

// -- Entry point ---------------------------------------------------------

pub fn main() -> fn() -> Nil {
  mvu.start(init(), update, view)
}
