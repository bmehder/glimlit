// @ts-check

import { html } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import { repeat } from 'lit-html/directives/repeat.js'
import { from_list as toArray } from '#gleam/array'
import {
	QueryChanged,
	FavoritesToggled,
	FavoriteToggled,
	visible_recipes,
} from './recipes.mjs'
import { inputValue } from './inputs.mjs'

/** @typedef {import('./recipe.mjs').Recipe$} Recipe */
/** @typedef {(msg: import('./recipes.mjs').Msg$) => void} Dispatch */

/** @param {import('./recipes.mjs').Model$} model @param {Dispatch} dispatch */
export function collection(model, dispatch) {
	const recipes = /** @type {Recipe[]} */ (toArray(visible_recipes(model)))
	const filtered = Boolean(model.query || model.favorites)
	return html`
		<section aria-labelledby="collection-title">
			<div class="recipe-section-heading">
				<div>
					<p class="recipe-eyebrow">Good food, kept close</p>
					<h2 id="collection-title">Your collection</h2>
				</div>
				<a class="recipe-button" href="#/new">＋ Add a recipe</a>
			</div>
			<div class="recipe-filters">
				<label class="recipe-search"
					>Search recipes
					<input
						type="search"
						placeholder="Try lemon, pasta, or an ingredient…"
						.value=${live(model.query)}
						@input=${
							/** @param {Event} event */ event =>
								dispatch(new QueryChanged(inputValue(event)))
						}
					/>
				</label>
				<button
					class="recipe-filter"
					type="button"
					aria-pressed=${String(model.favorites)}
					@click=${() => dispatch(new FavoritesToggled())}
				>
					${model.favorites ? '★' : '☆'} Favourites
				</button>
			</div>
			<p class="recipe-count" role="status">
				${recipes.length}
				${recipes.length === 1 ? 'recipe' : 'recipes'}${model.favorites
					? ' in favourites'
					: ''}
			</p>
			${recipes.length
				? html`
						<div class="recipe-grid">
							${repeat(
								recipes,
								recipe => recipe.id,
								recipe => recipeCard(recipe, dispatch),
							)}
						</div>
					`
				: emptyCollection(filtered)}
		</section>
	`
}

/** @param {Recipe} recipe @param {Dispatch} dispatch */
function recipeCard(recipe, dispatch) {
	const address = `#/recipe/${recipe.id}`
	const favoriteLabel = recipe.favorite
		? `Remove ${recipe.title} from favourites`
		: `Add ${recipe.title} to favourites`
	return html`
		<article class="recipe-card">
			<div class="recipe-card-top">
				<span>${recipe.minutes} min</span>
				<button
					type="button"
					class="recipe-star"
					aria-label=${favoriteLabel}
					aria-pressed=${String(recipe.favorite)}
					@click=${() => dispatch(new FavoriteToggled(recipe.id))}
				>
					${recipe.favorite ? '★' : '☆'}
				</button>
			</div>
			<h3><a href=${address}>${recipe.title}</a></h3>
			<p>${recipe.description}</p>
			<a class="recipe-open" href=${address}>
				Open recipe <span aria-hidden="true">↗</span>
				<span class="sr-only">: ${recipe.title}</span>
			</a>
		</article>
	`
}

/** @param {boolean} filtered */
function emptyCollection(filtered) {
	const heading = filtered ? 'No recipes match yet.' : 'A fresh page for good food.'
	const message = filtered
		? 'Try another search or turn off the favourites filter.'
		: 'Add your first recipe, or import the samples below.'
	return html`<div class="recipe-empty">
		<h3>${heading}</h3>
		<p>${message}</p>
	</div>`
}
