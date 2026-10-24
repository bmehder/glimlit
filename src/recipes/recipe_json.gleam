import gleam/dynamic/decode
import gleam/json
import gleam/list
import gleam/result
import recipes/recipe.{type Recipe, Recipe}

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
  case recipe.is_valid(decoded) {
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
