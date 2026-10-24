// @ts-check

import { html } from 'lit-html'
import { FavoriteToggled, DeleteConfirmed } from './recipes.mjs'

/** @typedef {(msg: import('./recipes.mjs').Msg$) => void} Dispatch */

/** @param {import('./recipe.mjs').Recipe$} recipe @param {Dispatch} dispatch */
export function detail(recipe, dispatch) {
  const ingredients = nonEmptyLines(recipe.ingredients)
  const instructions = nonEmptyLines(recipe.instructions)
  return html`
    <article class="recipe-detail">
      <a class="recipe-back" href="#/">← Back to collection</a>
      <p class="recipe-eyebrow">${recipe.minutes} minutes · From your recipe box</p>
      <h2>${recipe.title}</h2>
      <p class="recipe-description">${recipe.description}</p>
      <div class="recipe-actions">
        <a class="recipe-button" href=${`#/recipe/${recipe.id}/edit`}>Edit recipe</a>
        <button class="recipe-filter" type="button" aria-pressed=${String(recipe.favorite)}
          @click=${() => dispatch(new FavoriteToggled(recipe.id))}>
          ${recipe.favorite ? '★ In favourites' : '☆ Add to favourites'}
        </button>
      </div>
      <div class="recipe-method">
        <section>
          <h3>Ingredients</h3>
          <ul>${ingredients.map(line => html`<li>${line}</li>`)}</ul>
        </section>
        <section>
          <h3>Make it</h3>
          <ol>${instructions.map(line => html`<li>${line}</li>`)}</ol>
        </section>
      </div>
      <div class="recipe-danger">
        <button class="recipe-delete" type="button"
          @click=${() => confirmRemoval(recipe, dispatch)}>Remove recipe</button>
      </div>
    </article>
  `
}

/** @param {string} text */
function nonEmptyLines(text) {
  return text.split('\n').filter(line => line.trim())
}

/** @param {import('./recipe.mjs').Recipe$} recipe @param {Dispatch} dispatch */
function confirmRemoval(recipe, dispatch) {
  if (window.confirm(`Remove “${recipe.title}” from your collection?`)) {
    dispatch(new DeleteConfirmed(recipe.id))
  }
}
