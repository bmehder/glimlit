// @ts-check

import { html, render, nothing } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import { repeat } from 'lit-html/directives/repeat.js'
import { from_list as toArray } from '#gleam/array'
import {
	screen as currentScreen,
	can_import as canImport,
	saving_message as savingMessage,
	can_retry_save as canRetrySave,
	Screen$isScreenLoading as isLoading,
	Screen$isScreenRecovery as isRecovery,
	Screen$isScreenCollection as isCollection,
	Screen$isScreenNew as isNew,
	Screen$isScreenDetail as isDetail,
	Screen$isScreenEdit as isEdit,
	Screen$isScreenNotFound as isNotFound,
	Screen$ScreenRecovery$0 as recoveryReason,
	Screen$ScreenNew$0 as newEditor,
	Screen$ScreenDetail$0 as screenRecipe,
	Screen$ScreenEdit$0 as editEditor,
	Screen$ScreenEdit$1 as editCancelPath,
	Model$Model$importing as modelImporting,
	Model$Model$notice as modelNotice,
	Msg$RetryLoad as RetryLoad,
	Msg$UseStarters as UseStarters,
	Msg$RetrySave as RetrySave,
	Msg$ImportRequested as ImportRequested,
	Msg$ImportCancelled as ImportCancelled,
	Msg$EditorChanged as EditorChanged,
	Msg$RecipeSubmitted as RecipeSubmitted,
	Model$Model$query as modelQuery,
	Model$Model$favorites as modelFavorites,
	Msg$QueryChanged as QueryChanged,
	Msg$FavoritesToggled as FavoritesToggled,
	Msg$FavoriteToggled as FavoriteToggled,
	visible_recipes,
	Msg$DeleteConfirmed as DeleteConfirmed,
	Recipe$Recipe$id as recipeId,
	Recipe$Recipe$title as recipeTitle,
	Recipe$Recipe$description as recipeDescription,
	Recipe$Recipe$minutes as recipeMinutes,
	Recipe$Recipe$favorite as recipeFavorite,
	Recipe$Recipe$ingredients as recipeIngredients,
	Recipe$Recipe$instructions as recipeInstructions,
	Editor$Editor$title as editorTitle,
	Editor$Editor$description as editorDescription,
	Editor$Editor$minutes as editorMinutes,
	Editor$Editor$ingredients as editorIngredients,
	Editor$Editor$instructions as editorInstructions,
	Editor$Editor$errors as editorErrors,
	EditorMsg$TitleChanged as TitleChanged,
	EditorMsg$DescriptionChanged as DescriptionChanged,
	EditorMsg$MinutesChanged as MinutesChanged,
	EditorMsg$IngredientsChanged as IngredientsChanged,
	EditorMsg$InstructionsChanged as InstructionsChanged,
} from './recipes.mjs'

/** @typedef {import('./recipes.mjs').Model$} Model */
/** @typedef {import('./recipes.mjs').Recipe$} Recipe */
/** @typedef {(msg: import('./recipes.mjs').Msg$) => void} Dispatch */

// -- Page and screen selection ----------------------------------------

/** @param {Model} model @param {Dispatch} dispatch */
export function view(model, dispatch) {
	const mount = document.getElementById('recipe-app')
	if (!mount) throw new Error('Missing #recipe-app mount element')

	render(
		html`
			${saveStatus(model, dispatch)}
			${renderScreen(currentScreen(model), model, dispatch)}
			${canImport(model) ? sampleImport(model, dispatch) : nothing}
		`,
		mount,
	)
}

/** @param {import('./recipes.mjs').Screen$} screen @param {Model} model @param {Dispatch} dispatch */
function renderScreen(screen, model, dispatch) {
	if (isLoading(screen)) {
		return html`<p class="recipe-empty" role="status">Opening your recipe box…</p>`
	}
	if (isRecovery(screen)) return storageRecovery(recoveryReason(screen), dispatch)
	if (isCollection(screen)) return collection(model, dispatch)
	if (isNew(screen)) return editorScreen(newEditor(screen), dispatch, false, '#/')
	if (isDetail(screen)) return detail(screenRecipe(screen), dispatch)
	if (isEdit(screen)) {
		return editorScreen(editEditor(screen), dispatch, true, editCancelPath(screen))
	}
	if (isNotFound(screen)) {
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

/** @param {import('./recipes.mjs').Editor$} draft @param {Dispatch} dispatch @param {boolean} editing @param {string} cancelPath */
function editorScreen(draft, dispatch, editing, cancelPath) {
	return editorView(
		draft,
		message => dispatch(EditorChanged(message)),
		() => dispatch(RecipeSubmitted()),
		editing,
		cancelPath,
	)
}

/** @param {string} reason @param {Dispatch} dispatch */
function storageRecovery(reason, dispatch) {
	return html`
		<section class="recipe-empty">
			<h2>Your saved collection needs attention.</h2>
			<p role="alert">${reason}</p>
			<div class="recipe-actions">
				<button class="recipe-button" @click=${() => dispatch(RetryLoad())}>
					Try loading again
				</button>
				<button class="recipe-filter" @click=${() => dispatch(UseStarters())}>
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
	return html`
		<div class="recipe-save-status" role="status">
			${savingMessage(model)}
			${canRetrySave(model)
				? html`<button @click=${() => dispatch(RetrySave())}>Retry saving</button>`
				: nothing}
		</div>
	`
}

/** @param {Model} model @param {Dispatch} dispatch */
function sampleImport(model, dispatch) {
	const label = modelImporting(model)
		? 'Restart sample import'
		: 'Import sample recipes'
	return html`
		<aside class="recipe-samples" aria-labelledby="samples-title">
			<div>
				<p class="recipe-eyebrow">A little inspiration</p>
				<h2 id="samples-title">Make room for something new.</h2>
				<p>
					Import two more recipes into your collection. Recipes with matching titles
					are kept.
				</p>
				<p class="recipe-notice" role="status">${modelNotice(model)}</p>
			</div>
			<div class="recipe-sample-actions">
				<button
					type="button"
					class="recipe-filter"
					aria-busy=${String(modelImporting(model))}
					@click=${() => dispatch(ImportRequested())}
				>
					${label}
				</button>
				${modelImporting(model)
					? html`
							<button
								type="button"
								class="recipe-back"
								@click=${() => dispatch(ImportCancelled())}
							>
								Cancel import
							</button>
						`
					: nothing}
			</div>
		</aside>
	`
}

// -- Collection -------------------------------------------------------

/** @param {import('./recipes.mjs').Model$} model @param {Dispatch} dispatch */
function collection(model, dispatch) {
	const recipes = /** @type {Recipe[]} */ (toArray(visible_recipes(model)))
	const filtered = Boolean(modelQuery(model) || modelFavorites(model))
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
						.value=${live(modelQuery(model))}
						@input=${
							/** @param {Event} event */ event =>
								dispatch(QueryChanged(inputValue(event)))
						}
					/>
				</label>
				<button
					class="recipe-filter"
					type="button"
					aria-pressed=${String(modelFavorites(model))}
					@click=${() => dispatch(FavoritesToggled())}
				>
					${modelFavorites(model) ? '★' : '☆'} Favourites
				</button>
			</div>
			<p class="recipe-count" role="status">
				${recipes.length}
				${recipes.length === 1 ? 'recipe' : 'recipes'}${modelFavorites(model)
					? ' in favourites'
					: ''}
			</p>
			${recipes.length
				? html`
						<div class="recipe-grid">
							${repeat(
								recipes,
								recipe => recipeId(recipe),
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
	const address = `#/recipe/${recipeId(recipe)}`
	const favoriteLabel = recipeFavorite(recipe)
		? `Remove ${recipeTitle(recipe)} from favourites`
		: `Add ${recipeTitle(recipe)} to favourites`
	return html`
		<article class="recipe-card">
			<div class="recipe-card-top">
				<span>${recipeMinutes(recipe)} min</span>
				<button
					type="button"
					class="recipe-star"
					aria-label=${favoriteLabel}
					aria-pressed=${String(recipeFavorite(recipe))}
					@click=${() => dispatch(FavoriteToggled(recipeId(recipe)))}
				>
					${recipeFavorite(recipe) ? '★' : '☆'}
				</button>
			</div>
			<h3><a href=${address}>${recipeTitle(recipe)}</a></h3>
			<p>${recipeDescription(recipe)}</p>
			<a class="recipe-open" href=${address}>
				Open recipe <span aria-hidden="true">↗</span>
				<span class="sr-only">: ${recipeTitle(recipe)}</span>
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

// -- Recipe details ---------------------------------------------------

/** @param {import('./recipes.mjs').Recipe$} recipe @param {Dispatch} dispatch */
function detail(recipe, dispatch) {
  const ingredients = nonEmptyLines(recipeIngredients(recipe))
  const instructions = nonEmptyLines(recipeInstructions(recipe))
  return html`
    <article class="recipe-detail">
      <a class="recipe-back" href="#/">← Back to collection</a>
      <p class="recipe-eyebrow">${recipeMinutes(recipe)} minutes · From your recipe box</p>
      <h2>${recipeTitle(recipe)}</h2>
      <p class="recipe-description">${recipeDescription(recipe)}</p>
      <div class="recipe-actions">
        <a class="recipe-button" href=${`#/recipe/${recipeId(recipe)}/edit`}>Edit recipe</a>
        <button class="recipe-filter" type="button" aria-pressed=${String(recipeFavorite(recipe))}
          @click=${() => dispatch(FavoriteToggled(recipeId(recipe)))}>
          ${recipeFavorite(recipe) ? '★ In favourites' : '☆ Add to favourites'}
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

/** @param {import('./recipes.mjs').Recipe$} recipe @param {Dispatch} dispatch */
function confirmRemoval(recipe, dispatch) {
  if (window.confirm(`Remove “${recipeTitle(recipe)}” from your collection?`)) {
    dispatch(DeleteConfirmed(recipeId(recipe)))
  }
}

// -- Editor -----------------------------------------------------------

/**
 * @param {import('./recipes.mjs').Editor$} model
 * @param {(msg: import('./recipes.mjs').EditorMsg$) => void} dispatch
 * @param {() => void} submit
 * @param {boolean} editing
 * @param {string} cancelPath
 */
function editorView(model, dispatch, submit, editing, cancelPath) {
  const errors = /** @type {string[]} */ (toArray(editorErrors(model)))
  return html`
    <section class="recipe-editor" aria-labelledby="editor-title">
      <a class="recipe-back" href=${cancelPath}>← Discard changes and go back</a>
      <p class="recipe-eyebrow">Something worth making again</p>
      <h2 id="editor-title">${editing ? 'Edit your recipe' : 'A new favourite'}</h2>
      <p class="recipe-description">A few ingredients. A little know-how. Keep it all here.</p>
      <form @submit=${/** @param {SubmitEvent} event */ event => {
        event.preventDefault()
        submit()
      }}>
        ${errors.length ? errorSummary(errors) : nothing}
        <label>Recipe title
          <input required name="title" autocomplete="off" .value=${live(editorTitle(model))}
            @input=${/** @param {Event} event */ event => dispatch(TitleChanged(inputValue(event)))}>
        </label>
        <label>A short description
          <textarea name="description" rows="2" .value=${live(editorDescription(model))}
            @input=${/** @param {Event} event */ event => dispatch(DescriptionChanged(inputValue(event)))}></textarea>
        </label>
        <label class="recipe-minutes">Time in minutes
          <input required name="minutes" type="number" min="1" max="1440" step="1"
            .value=${live(editorMinutes(model))}
            @input=${/** @param {Event} event */ event => dispatch(MinutesChanged(inputValue(event)))}>
        </label>
        <div class="recipe-form-columns">
          <label>Ingredients
            <span class="recipe-hint">One ingredient per line.</span>
            <textarea required name="ingredients" rows="7" .value=${live(editorIngredients(model))}
              @input=${/** @param {Event} event */ event => dispatch(IngredientsChanged(inputValue(event)))}></textarea>
          </label>
          <label>Instructions
            <span class="recipe-hint">One step per line.</span>
            <textarea required name="instructions" rows="7" .value=${live(editorInstructions(model))}
              @input=${/** @param {Event} event */ event => dispatch(InstructionsChanged(inputValue(event)))}></textarea>
          </label>
        </div>
        <div class="recipe-actions">
          <button class="recipe-button" type="submit">${editing ? 'Save changes' : 'Add to collection'}</button>
          <a class="recipe-back" href=${cancelPath}>Cancel</a>
        </div>
        <p class="recipe-hint">
          Submitting keeps this recipe in your collection and saves it in this browser.
          Leaving this form discards unsubmitted edits.
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
      <ul>${errors.map(error => html`<li>${error}</li>`)}</ul>
    </div>
  `
}

// -- Input helpers ----------------------------------------------------

/** @param {Event} event */
function inputValue(event) {
  const target = event.currentTarget
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : ''
}
