import gleam/int
import gleam/list
import gleam/string

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

pub fn find(recipes: List(Recipe), id: Int) -> Result(Recipe, Nil) {
  list.find(recipes, fn(recipe) { recipe.id == id })
}

pub fn next_id(recipes: List(Recipe)) -> Int {
  list.fold(recipes, 1, fn(next, recipe) { int.max(next, recipe.id + 1) })
}

pub fn filter(
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

pub fn is_valid(recipe: Recipe) -> Bool {
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

pub fn put(recipes: List(Recipe), saved: Recipe) -> List(Recipe) {
  case find(recipes, saved.id) {
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

pub fn remove(recipes: List(Recipe), id: Int) -> List(Recipe) {
  list.filter(recipes, fn(recipe) { recipe.id != id })
}

pub fn merge_samples(
  recipes: List(Recipe),
  samples: List(Recipe),
) -> List(Recipe) {
  let initial = #(recipes, next_id(recipes))
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

pub fn starters() -> List(Recipe) {
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
