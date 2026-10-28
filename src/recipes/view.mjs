// @ts-check

import { html, nothing } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import { repeat } from 'lit-html/directives/repeat.js'
import { from_list } from '#gleam/array'
import {
	// Model queries
	screen,
	can_import,
	saving_message,
	can_retry_save,
	visible_recipes,

	// Screen selection
	Screen$isScreenLoading,
	Screen$isScreenRecovery,
	Screen$isScreenCollection,
	Screen$isScreenNew,
	Screen$isScreenDetail,
	Screen$isScreenEdit,
	Screen$isScreenNotFound,
	Screen$ScreenRecovery$0,
	Screen$ScreenNew$0,
	Screen$ScreenDetail$0,
	Screen$ScreenEdit$0,
	Screen$ScreenEdit$1,

	// Application state
	RecipeFilter$isFavoritesOnly,
	SampleImportState$isImportInProgress,
	Model$Model$sample_import,
	Model$Model$notice,
	Model$Model$query,
	Model$Model$filter,

	// Recipe data
	Recipe$Recipe$id,
	Recipe$Recipe$title,
	Recipe$Recipe$description,
	Recipe$Recipe$minutes,
	Recipe$Recipe$favorite,
	Recipe$Recipe$ingredients,
	Recipe$Recipe$instructions,

	// Editor fields
	Editor$Editor$title,
	Editor$Editor$description,
	Editor$Editor$minutes,
	Editor$Editor$ingredients,
	Editor$Editor$instructions,
	Editor$Editor$errors,

	// Messages
	Msg$UserClickedRetryLoad,
	Msg$UserClickedUseStarters,
	Msg$UserClickedRetrySave,
	Msg$UserClickedImportSamples,
	Msg$UserCancelledImport,
	Msg$UserSubmittedRecipe,
	Msg$UserChangedQuery,
	Msg$UserToggledFavorites,
	Msg$UserToggledFavorite,
	Msg$UserConfirmedDelete,
	Msg$UserChangedTitle,
	Msg$UserChangedDescription,
	Msg$UserChangedMinutes,
	Msg$UserChangedIngredients,
	Msg$UserChangedInstructions,
} from './recipes.mjs'

/** @typedef {import('./recipes.mjs').Model$} Model */
/** @typedef {import('./recipes.mjs').Recipe$} Recipe */
/** @typedef {import('./recipes.mjs').Editor$} Editor */
/** @typedef {import('./recipes.mjs').Screen$} Screen */
/** @typedef {(msg: import('./recipes.mjs').Msg$) => void} Dispatch */

// -- Page and screen selection -------------------------------------------

/** @param {Model} model @param {Dispatch} dispatch */
export function view(model, dispatch) {
	return html`
			${saveStatus(model, dispatch)} ${renderScreen(screen(model), model, dispatch)}
			${can_import(model) ? sampleImport(model, dispatch) : nothing}
		`
}

/** @param {Screen} screen @param {Model} model @param {Dispatch} dispatch */
function renderScreen(screen, model, dispatch) {
	if (Screen$isScreenLoading(screen)) {
		return html`<p class="recipe-empty" role="status">Opening your recipe box…</p>`
	}
	if (Screen$isScreenRecovery(screen))
		return storageRecovery(Screen$ScreenRecovery$0(screen), dispatch)
	if (Screen$isScreenCollection(screen)) return collection(model, dispatch)
	if (Screen$isScreenNew(screen))
		return editorView(Screen$ScreenNew$0(screen), dispatch, false, '#/')
	if (Screen$isScreenDetail(screen))
		return detail(Screen$ScreenDetail$0(screen), dispatch)
	if (Screen$isScreenEdit(screen)) {
		return editorView(
			Screen$ScreenEdit$0(screen),
			dispatch,
			true,
			Screen$ScreenEdit$1(screen),
		)
	}
	if (Screen$isScreenNotFound(screen)) {
		return html`
			<section class="recipe-empty">
				<h2>That recipe isn’t here.</h2>
				<p>It may have been removed, or the address may be incomplete.</p>
				<a class="recipe-button" href="#/">Back to collection</a>
			</section>
		`
	}
	throw new Error('Unknown recipe screen')
}

// -- Collection ----------------------------------------------------------

/** @param {Model} model @param {Dispatch} dispatch */
function collection(model, dispatch) {
	/** @param {Event} event */
	const handleQueryInput = event => dispatch(Msg$UserChangedQuery(inputValue(event)))
	const handleToggleFavorites = () => dispatch(Msg$UserToggledFavorites())
	const query = Model$Model$query(model)
	const favoritesOnly = RecipeFilter$isFavoritesOnly(Model$Model$filter(model))
	const recipes = /** @type {Recipe[]} */ (from_list(visible_recipes(model)))
	const filtered = Boolean(query || favoritesOnly)
	const cards = repeat(
		recipes,
		recipe => Recipe$Recipe$id(recipe),
		recipe => recipeCard(recipe, dispatch),
	)

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
						.value=${live(query)}
						@input=${handleQueryInput}
					/>
				</label>
				<button
					class="recipe-filter"
					type="button"
					aria-pressed=${String(favoritesOnly)}
					@click=${handleToggleFavorites}
				>
					${favoritesOnly ? '★' : '☆'} Favourites
				</button>
			</div>
			<p class="recipe-count" role="status">
				${recipes.length}
				${recipes.length === 1 ? 'recipe' : 'recipes'}${favoritesOnly
					? ' in favourites'
					: ''}
			</p>
			${recipes.length
				? html` <div class="recipe-grid">${cards}</div> `
				: emptyCollection(filtered)}
		</section>
	`
}

/** @param {Recipe} recipe @param {Dispatch} dispatch */
function recipeCard(recipe, dispatch) {
	const handleToggleFavorite = () =>
		dispatch(Msg$UserToggledFavorite(Recipe$Recipe$id(recipe)))
	const title = Recipe$Recipe$title(recipe)
	const isFavorite = Recipe$Recipe$favorite(recipe)
	const address = `#/recipe/${Recipe$Recipe$id(recipe)}`
	const favoriteLabel = isFavorite
		? `Remove ${title} from favourites`
		: `Add ${title} to favourites`

	return html`
		<article class="recipe-card">
			<div class="recipe-card-top">
				<span>${Recipe$Recipe$minutes(recipe)} min</span>
				<button
					type="button"
					class="recipe-star"
					aria-label=${favoriteLabel}
					aria-pressed=${String(isFavorite)}
					@click=${handleToggleFavorite}
				>
					${isFavorite ? '★' : '☆'}
				</button>
			</div>
			<h3><a href=${address}>${title}</a></h3>
			<p>${Recipe$Recipe$description(recipe)}</p>
			<a class="recipe-open" href=${address}>
				Open recipe <span aria-hidden="true">↗</span>
				<span class="sr-only">: ${title}</span>
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

// -- Recipe details ------------------------------------------------------

/** @param {Recipe} recipe @param {Dispatch} dispatch */
function detail(recipe, dispatch) {
	const title = Recipe$Recipe$title(recipe)
	const isFavorite = Recipe$Recipe$favorite(recipe)
	const editPath = `#/recipe/${Recipe$Recipe$id(recipe)}/edit`
	const handleToggleFavorite = () =>
		dispatch(Msg$UserToggledFavorite(Recipe$Recipe$id(recipe)))
	const handleRemoveRecipe = () => {
		if (window.confirm(`Remove “${title}” from your collection?`)) {
			dispatch(Msg$UserConfirmedDelete(Recipe$Recipe$id(recipe)))
		}
	}
	const ingredients = nonEmptyLines(Recipe$Recipe$ingredients(recipe)).map(
		line => html`<li>${line}</li>`,
	)
	const instructions = nonEmptyLines(Recipe$Recipe$instructions(recipe)).map(
		line => html`<li>${line}</li>`,
	)

	return html`
		<article class="recipe-detail">
			<a class="recipe-back" href="#/">← Back to collection</a>
			<p class="recipe-eyebrow">
				${Recipe$Recipe$minutes(recipe)} minutes · From your recipe box
			</p>
			<h2>${title}</h2>
			<p class="recipe-description">${Recipe$Recipe$description(recipe)}</p>
			<div class="recipe-actions">
				<a class="recipe-button" href=${editPath}>Edit recipe</a>
				<button
					class="recipe-filter"
					type="button"
					aria-pressed=${String(isFavorite)}
					@click=${handleToggleFavorite}
				>
					${isFavorite ? '★ In favourites' : '☆ Add to favourites'}
				</button>
			</div>
			<div class="recipe-method">
				<section>
					<h3>Ingredients</h3>
					<ul>
						${ingredients}
					</ul>
				</section>
				<section>
					<h3>Make it</h3>
					<ol>
						${instructions}
					</ol>
				</section>
			</div>
			<div class="recipe-danger">
				<button class="recipe-delete" type="button" @click=${handleRemoveRecipe}>
					Remove recipe
				</button>
			</div>
		</article>
	`
}

// -- Editor --------------------------------------------------------------

/**
 * @param {Editor} model
 * @param {Dispatch} dispatch
 * @param {boolean} editing
 * @param {string} cancelPath
 */
function editorView(model, dispatch, editing, cancelPath) {
	/** @param {SubmitEvent} event */
	const handleSubmit = event => {
		event.preventDefault()
		dispatch(Msg$UserSubmittedRecipe())
	}
	/** @param {Event} event */
	const handleTitleInput = event => dispatch(Msg$UserChangedTitle(inputValue(event)))
	/** @param {Event} event */
	const handleDescriptionInput = event =>
		dispatch(Msg$UserChangedDescription(inputValue(event)))
	/** @param {Event} event */
	const handleMinutesInput = event =>
		dispatch(Msg$UserChangedMinutes(inputValue(event)))
	/** @param {Event} event */
	const handleIngredientsInput = event =>
		dispatch(Msg$UserChangedIngredients(inputValue(event)))
	/** @param {Event} event */
	const handleInstructionsInput = event =>
		dispatch(Msg$UserChangedInstructions(inputValue(event)))
	const errors = /** @type {string[]} */ (from_list(Editor$Editor$errors(model)))

	return html`
		<section class="recipe-editor" aria-labelledby="editor-title">
			<a class="recipe-back" href=${cancelPath}>← Discard changes and go back</a>
			<p class="recipe-eyebrow">Something worth making again</p>
			<h2 id="editor-title">${editing ? 'Edit your recipe' : 'A new favourite'}</h2>
			<p class="recipe-description">
				A few ingredients. A little know-how. Keep it all here.
			</p>
			<form @submit=${handleSubmit}>
				${errors.length ? errorSummary(errors) : nothing}
				<label
					>Recipe title
					<input
						required
						name="title"
						autocomplete="off"
						.value=${live(Editor$Editor$title(model))}
						@input=${handleTitleInput}
					/>
				</label>
				<label
					>A short description
					<textarea
						name="description"
						rows="2"
						.value=${live(Editor$Editor$description(model))}
						@input=${handleDescriptionInput}
					></textarea>
				</label>
				<label class="recipe-minutes"
					>Time in minutes
					<input
						required
						name="minutes"
						type="number"
						min="1"
						max="1440"
						step="1"
						.value=${live(Editor$Editor$minutes(model))}
						@input=${handleMinutesInput}
					/>
				</label>
				<div class="recipe-form-columns">
					<label
						>Ingredients
						<span class="recipe-hint">One ingredient per line.</span>
						<textarea
							required
							name="ingredients"
							rows="7"
							.value=${live(Editor$Editor$ingredients(model))}
							@input=${handleIngredientsInput}
						></textarea>
					</label>
					<label
						>Instructions
						<span class="recipe-hint">One step per line.</span>
						<textarea
							required
							name="instructions"
							rows="7"
							.value=${live(Editor$Editor$instructions(model))}
							@input=${handleInstructionsInput}
						></textarea>
					</label>
				</div>
				<div class="recipe-actions">
					<button class="recipe-button" type="submit">
						${editing ? 'Save changes' : 'Add to collection'}
					</button>
					<a class="recipe-back" href=${cancelPath}>Cancel</a>
				</div>
				<p class="recipe-hint">
					Submitting keeps this recipe in your collection and saves it in this
					browser. Leaving this form discards unsubmitted edits.
				</p>
			</form>
		</section>
	`
}

/** @param {string[]} errors */
function errorSummary(errors) {
	return html`
		<div class="recipe-errors" id="recipe-errors" role="alert" tabindex="-1">
			<h3>Check your recipe</h3>
			<ul>
				${errors.map(error => html`<li>${error}</li>`)}
			</ul>
		</div>
	`
}

// -- Storage and sample imports ------------------------------------------

/** @param {string} reason @param {Dispatch} dispatch */
function storageRecovery(reason, dispatch) {
	const handleRetryLoad = () => dispatch(Msg$UserClickedRetryLoad())
	const handleUseStarters = () => dispatch(Msg$UserClickedUseStarters())

	return html`
		<section class="recipe-empty">
			<h2>Your saved collection needs attention.</h2>
			<p role="alert">${reason}</p>
			<div class="recipe-actions">
				<button class="recipe-button" @click=${handleRetryLoad}>
					Try loading again
				</button>
				<button class="recipe-filter" @click=${handleUseStarters}>
					Replace with starter recipes
				</button>
			</div>
			<p class="recipe-hint">
				Replacing starts a new collection and attempts to save it over the old data.
				Nothing is replaced until you choose this.
			</p>
		</section>
	`
}

/** @param {Model} model @param {Dispatch} dispatch */
function saveStatus(model, dispatch) {
	const handleRetrySave = () => dispatch(Msg$UserClickedRetrySave())

	return html`
		<div class="recipe-save-status" role="status">
			${saving_message(model)}
			${can_retry_save(model)
				? html`<button @click=${handleRetrySave}>Retry saving</button>`
				: nothing}
		</div>
	`
}

/** @param {Model} model @param {Dispatch} dispatch */
function sampleImport(model, dispatch) {
	const handleImport = () => dispatch(Msg$UserClickedImportSamples())
	const handleCancelImport = () => dispatch(Msg$UserCancelledImport())
	const isImporting = SampleImportState$isImportInProgress(Model$Model$sample_import(model))
	const label = isImporting ? 'Restart sample import' : 'Import sample recipes'

	return html`
		<aside class="recipe-samples" aria-labelledby="samples-title">
			<div>
				<p class="recipe-eyebrow">A little inspiration</p>
				<h2 id="samples-title">Make room for something new.</h2>
				<p>
					Import two more recipes into your collection. Recipes with matching titles
					are kept.
				</p>
				<p class="recipe-notice" role="status">${Model$Model$notice(model)}</p>
			</div>
			<div class="recipe-sample-actions">
				<button
					type="button"
					class="recipe-filter"
					aria-busy=${String(isImporting)}
					@click=${handleImport}
				>
					${label}
				</button>
				${isImporting
					? html`
							<button type="button" class="recipe-back" @click=${handleCancelImport}>
								Cancel import
							</button>
						`
					: nothing}
			</div>
		</aside>
	`
}

// -- DOM helpers ---------------------------------------------------------

/** @param {Event} event */
function inputValue(event) {
	const target = event.currentTarget

	return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
		? target.value
		: ''
}

/** @param {string} text */
function nonEmptyLines(text) {
	return text.split('\n').filter(line => line.trim())
}
