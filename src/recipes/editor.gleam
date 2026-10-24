import gleam/int
import gleam/list
import gleam/result
import gleam/string
import recipes/recipe.{type Recipe, Recipe}

pub type Model {
  Model(
    title: String,
    description: String,
    minutes: String,
    ingredients: String,
    instructions: String,
    errors: List(String),
  )
}

pub type Msg {
  TitleChanged(String)
  DescriptionChanged(String)
  MinutesChanged(String)
  IngredientsChanged(String)
  InstructionsChanged(String)
}

pub fn init() -> Model {
  Model(
    title: "",
    description: "",
    minutes: "20",
    ingredients: "",
    instructions: "",
    errors: [],
  )
}

pub fn from_recipe(recipe: Recipe) -> Model {
  Model(
    recipe.title,
    recipe.description,
    int.to_string(recipe.minutes),
    recipe.ingredients,
    recipe.instructions,
    [],
  )
}

pub fn update(model: Model, msg: Msg) -> Model {
  let model = Model(..model, errors: [])
  case msg {
    TitleChanged(value) -> Model(..model, title: value)
    DescriptionChanged(value) -> Model(..model, description: value)
    MinutesChanged(value) -> Model(..model, minutes: value)
    IngredientsChanged(value) -> Model(..model, ingredients: value)
    InstructionsChanged(value) -> Model(..model, instructions: value)
  }
}

pub fn validate(
  model: Model,
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
        !recipe.valid_minutes(minutes),
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

pub fn with_errors(model: Model, errors: List(String)) -> Model {
  Model(..model, errors: errors)
}
