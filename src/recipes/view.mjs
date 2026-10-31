// @ts-check

import { inputValue, preventDefault } from '#browser/events'
import { html, nothing } from 'lit-html'
import {
	allPass,
	always,
	applySpec,
	cond,
	equals,
	filter,
	find,
	flow,
	ifElse,
	includes,
	isNotEmpty,
	join,
	juxt,
	map,
	pipe,
	split,
	T,
	thunkify,
	toLower,
	trim,
	when,
} from 'ramda'
import { live } from 'lit-html/directives/live.js'
import { repeat } from 'lit-html/directives/repeat.js'
import { from_list } from '#gleam/array'
import {
	Editor$Editor$description,
	Editor$Editor$errors,
	Editor$Editor$ingredients,
	Editor$Editor$instructions,
	Editor$Editor$minutes,
	Editor$Editor$title,
	Model$Model$editor,
	Model$Model$filter,
	Model$Model$notice,
	Model$Model$query,
	Model$Model$recipes,
	Model$Model$route,
	Model$Model$sample_import,
	Model$Model$save_status,
	Model$Model$storage,
	Msg$UserCancelledImport,
	Msg$UserChangedDescription,
	Msg$UserChangedIngredients,
	Msg$UserChangedInstructions,
	Msg$UserChangedMinutes,
	Msg$UserChangedQuery,
	Msg$UserChangedTitle,
	Msg$UserClickedImportSamples,
	Msg$UserClickedRetryLoad,
	Msg$UserClickedRetrySave,
	Msg$UserClickedUseStarters,
	Msg$UserConfirmedDelete,
	Msg$UserSubmittedRecipe,
	Msg$UserToggledFavorite,
	Msg$UserToggledFavorites,
	Recipe$Recipe$description,
	Recipe$Recipe$favorite,
	Recipe$Recipe$id,
	Recipe$Recipe$ingredients,
	Recipe$Recipe$instructions,
	Recipe$Recipe$minutes,
	Recipe$Recipe$title,
	RecipeFilter$isFavoritesOnly,
	Route$Detail$id,
	Route$Edit$id,
	Route$isCollection,
	Route$isDetail,
	Route$isEdit,
	Route$isNew,
	Route$isNotFound,
	SampleImportState$isImportInProgress,
	SaveStatus$SaveFailed$reason,
	SaveStatus$isSaveFailed,
	SaveStatus$isSaved,
	SaveStatus$isSaving,
	Storage$LoadFailed$reason,
	Storage$isLoadFailed,
	Storage$isLoading,
	Storage$isReady,
} from './recipes.mjs'

/** @typedef {import('./recipes.mjs').Model$} Model */
/** @typedef {import('./recipes.mjs').Recipe$} Recipe */
/** @typedef {import('./recipes.mjs').Editor$} Editor */
/** @typedef {(msg: import('./recipes.mjs').Msg$) => void} Dispatch */

/** @param {Model} model @param {Dispatch} dispatch @param {import('../runtime/instance.mjs').InstanceContext} context */
export const view = (model, dispatch, { id }) => {
	// -- DOM helpers ----------------------------------------------------
	const nonEmptyLines = pipe(split('\n'), filter(pipe(trim, isNotEmpty)))

	/** @param {string} line */
	const listItem = line => html`<li>${line}</li>`

	const favoriteSymbol = ifElse(Recipe$Recipe$favorite, always('★'), always('☆'))
	const favoriteAction = ifElse(
		Recipe$Recipe$favorite,
		always('★ In favourites'),
		always('☆ Add to favourites'),
	)

	// -- Collection -----------------------------------------------------

	/** @param {boolean} filtered */
	const emptyCollection = filtered => {
		const heading = filtered
			? 'No recipes match yet.'
			: 'A fresh page for good food.'
		const message = filtered
			? 'Try another search or turn off the favourites filter.'
			: 'Add your first recipe, or import the samples below.'

		return html`<div class="recipe-empty">
			<h3>${heading}</h3>
			<p>${message}</p>
		</div>`
	}

	/** @param {Recipe} recipe */
	const recipeCard = recipe => {
		const { recipeId, title, description, minutes, isFavorite, favorite } =
			applySpec({
				recipeId: Recipe$Recipe$id,
				title: Recipe$Recipe$title,
				description: Recipe$Recipe$description,
				minutes: Recipe$Recipe$minutes,
				isFavorite: Recipe$Recipe$favorite,
				favorite: favoriteSymbol,
			})(recipe)
		const handleToggleFavorite = thunkify(pipe(Msg$UserToggledFavorite, dispatch))(
			recipeId,
		)
		const address = `#/recipe/${recipeId}`
		const favoriteLabel = isFavorite
			? `Remove ${title} from favourites`
			: `Add ${title} to favourites`

		return html`
			<article class="recipe-card">
				<div class="recipe-card-top">
					<span>${minutes} min</span>
					<button
						type="button"
						class="recipe-star"
						aria-label=${favoriteLabel}
						aria-pressed=${String(isFavorite)}
						@click=${handleToggleFavorite}
					>
						${favorite}
					</button>
				</div>
				<h3><a href=${address}>${title}</a></h3>
				<p>${description}</p>
				<a class="recipe-open" href=${address}>
					Open recipe <span aria-hidden="true">↗</span>
					<span class="sr-only">: ${title}</span>
				</a>
			</article>
		`
	}

	const collection = () => {
		/** @param {Event} event */
		const handleQueryInput = pipe(inputValue, Msg$UserChangedQuery, dispatch)
		const handleToggleFavorites = pipe(Msg$UserToggledFavorites, dispatch)
		const { query, favoritesOnly, recipes } = applySpec({
			query: Model$Model$query,
			favoritesOnly: pipe(Model$Model$filter, RecipeFilter$isFavoritesOnly),
			recipes: pipe(Model$Model$recipes, from_list),
		})(model)
		const search = flow(query, [trim, toLower])
		const matchesSearch = pipe(
			juxt([
				Recipe$Recipe$title,
				Recipe$Recipe$description,
				Recipe$Recipe$ingredients,
			]),
			join(' '),
			toLower,
			includes(search),
		)
		const matchesFavorites = favoritesOnly ? Recipe$Recipe$favorite : T
		const visibleRecipes = filter(
			allPass([matchesSearch, matchesFavorites]),
			recipes,
		)
		const filtered = query !== '' || favoritesOnly
		const cards = repeat(visibleRecipes, Recipe$Recipe$id, recipeCard)

		return html`
			<section aria-labelledby=${id('collection-title')}>
				<div class="recipe-section-heading">
					<div>
						<p class="recipe-eyebrow">Good food, kept close</p>
						<h2 id=${id('collection-title')}>Your collection</h2>
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
					${visibleRecipes.length}
					${visibleRecipes.length === 1 ? 'recipe' : 'recipes'}${favoritesOnly
						? ' in favourites'
						: ''}
				</p>
				${visibleRecipes.length
					? html` <div class="recipe-grid">${cards}</div> `
					: emptyCollection(filtered)}
			</section>
		`
	}

	// -- Recipe details -------------------------------------------------

	/** @param {Recipe} recipe */
	const detail = recipe => {
		const {
			recipeId,
			title,
			description,
			minutes,
			isFavorite,
			favoriteLabel,
			ingredients,
			instructions,
		} = applySpec({
			recipeId: Recipe$Recipe$id,
			title: Recipe$Recipe$title,
			description: Recipe$Recipe$description,
			minutes: Recipe$Recipe$minutes,
			isFavorite: Recipe$Recipe$favorite,
			favoriteLabel: favoriteAction,
			ingredients: pipe(Recipe$Recipe$ingredients, nonEmptyLines, map(listItem)),
			instructions: pipe(Recipe$Recipe$instructions, nonEmptyLines, map(listItem)),
		})(recipe)
		const editPath = `#/recipe/${recipeId}/edit`
		const handleToggleFavorite = thunkify(pipe(Msg$UserToggledFavorite, dispatch))(
			recipeId,
		)
		const handleConfirmDelete = thunkify(pipe(Msg$UserConfirmedDelete, dispatch))(
			recipeId,
		)
		const handleRemoveRecipe = when(
			() => window.confirm(`Remove “${title}” from your collection?`),
			handleConfirmDelete,
		)

		return html`
			<article class="recipe-detail">
				<a class="recipe-back" href="#/">← Back to collection</a>
				<p class="recipe-eyebrow">${minutes} minutes · From your recipe box</p>
				<h2>${title}</h2>
				<p class="recipe-description">${description}</p>
				<div class="recipe-actions">
					<a class="recipe-button" href=${editPath}>Edit recipe</a>
					<button
						class="recipe-filter"
						type="button"
						aria-pressed=${String(isFavorite)}
						@click=${handleToggleFavorite}
					>
						${favoriteLabel}
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

	// -- Editor ---------------------------------------------------------

	/** @param {string[]} errors */
	const errorSummary = errors => {
		const items = map(listItem, errors)

		return html`
			<div
				class="recipe-errors"
				data-recipe-errors
				id=${id('recipe-errors')}
				role="alert"
				tabindex="-1"
			>
				<h3>Check your recipe</h3>
				<ul>
					${items}
				</ul>
			</div>
		`
	}

	/**
	 * @param {Editor} editor
	 * @param {boolean} editing
	 * @param {string} cancelPath
	 */
	const editorView = (editor, editing, cancelPath) => {
		const { title, description, minutes, ingredients, instructions, errors } =
			applySpec({
				title: Editor$Editor$title,
				description: Editor$Editor$description,
				minutes: Editor$Editor$minutes,
				ingredients: Editor$Editor$ingredients,
				instructions: Editor$Editor$instructions,
				errors: pipe(Editor$Editor$errors, from_list),
			})(editor)
		const handleSubmit = pipe(preventDefault, Msg$UserSubmittedRecipe, dispatch)
		const handleTitleInput = pipe(inputValue, Msg$UserChangedTitle, dispatch)
		const handleDescriptionInput = pipe(
			inputValue,
			Msg$UserChangedDescription,
			dispatch,
		)
		const handleMinutesInput = pipe(inputValue, Msg$UserChangedMinutes, dispatch)
		const handleIngredientsInput = pipe(
			inputValue,
			Msg$UserChangedIngredients,
			dispatch,
		)
		const handleInstructionsInput = pipe(
			inputValue,
			Msg$UserChangedInstructions,
			dispatch,
		)

		return html`
			<section class="recipe-editor" aria-labelledby=${id('editor-title')}>
				<a class="recipe-back" href=${cancelPath}>← Discard changes and go back</a>
				<p class="recipe-eyebrow">Something worth making again</p>
				<h2 id=${id('editor-title')}>
					${editing ? 'Edit your recipe' : 'A new favourite'}
				</h2>
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
							.value=${live(title)}
							@input=${handleTitleInput}
						/>
					</label>
					<label
						>A short description
						<textarea
							name="description"
							rows="2"
							.value=${live(description)}
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
							.value=${live(minutes)}
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
								.value=${live(ingredients)}
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
								.value=${live(instructions)}
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

	// -- Storage and sample imports -------------------------------------

	/** @param {string} reason */
	const storageRecovery = reason => {
		const handleRetryLoad = pipe(Msg$UserClickedRetryLoad, dispatch)
		const handleUseStarters = pipe(Msg$UserClickedUseStarters, dispatch)

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
					Replacing starts a new collection and attempts to save it over the old
					data. Nothing is replaced until you choose this.
				</p>
			</section>
		`
	}

	const saveStatus = () => {
		const savingMessage = cond([
			[SaveStatus$isSaved, always('Kept in this browser · No account needed')],
			[SaveStatus$isSaving, always('Saving in this browser…')],
			[SaveStatus$isSaveFailed, SaveStatus$SaveFailed$reason],
		])
		const { message, canRetry } = applySpec({
			message: pipe(Model$Model$save_status, savingMessage),
			canRetry: pipe(Model$Model$save_status, SaveStatus$isSaveFailed),
		})(model)
		const handleRetrySave = pipe(Msg$UserClickedRetrySave, dispatch)

		return html`
			<div class="recipe-save-status" role="status">
				${message}
				${canRetry
					? html`<button @click=${handleRetrySave}>Retry saving</button>`
					: nothing}
			</div>
		`
	}

	const sampleImport = () => {
		const handleImport = pipe(Msg$UserClickedImportSamples, dispatch)
		const handleCancelImport = pipe(Msg$UserCancelledImport, dispatch)
		const { isImporting, notice } = applySpec({
			isImporting: pipe(
				Model$Model$sample_import,
				SampleImportState$isImportInProgress,
			),
			notice: Model$Model$notice,
		})(model)
		const label = isImporting ? 'Restart sample import' : 'Import sample recipes'

		return html`
			<aside class="recipe-samples" aria-labelledby=${id('samples-title')}>
				<div>
					<p class="recipe-eyebrow">A little inspiration</p>
					<h2 id=${id('samples-title')}>Make room for something new.</h2>
					<p>
						Import two more recipes into your collection. Recipes with matching
						titles are kept.
					</p>
					<p class="recipe-notice" role="status">${notice}</p>
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
								<button
									type="button"
									class="recipe-back"
									@click=${handleCancelImport}
								>
									Cancel import
								</button>
							`
						: nothing}
				</div>
			</aside>
		`
	}

	// -- Page and screen selection --------------------------------------

	const notFound = () => html`
		<section class="recipe-empty">
			<h2>That recipe isn’t here.</h2>
			<p>It may have been removed, or the address may be incomplete.</p>
			<a class="recipe-button" href="#/">Back to collection</a>
		</section>
	`

	/** @param {import('./recipes.mjs').Route$} route */
	const recipeScreen = route => {
		const editing = Route$isEdit(route)
		const recipeId = flow(route, [
			ifElse(Route$isEdit, Route$Edit$id, Route$Detail$id),
		])
		const recipe = flow(model, [
			Model$Model$recipes,
			from_list,
			find(pipe(Recipe$Recipe$id, equals(recipeId))),
		])
		if (!recipe) return notFound()
		return editing
			? editorView(Model$Model$editor(model), true, `#/recipe/${recipeId}`)
			: detail(recipe)
	}

	/** @type {(route: import('./recipes.mjs').Route$) => import('lit-html').TemplateResult} */
	const renderRoute = cond([
		[Route$isCollection, collection],
		[Route$isNew, () => editorView(Model$Model$editor(model), false, '#/')],
		[Route$isDetail, recipeScreen],
		[Route$isEdit, recipeScreen],
		[Route$isNotFound, notFound],
	])

	/** @type {(storage: import('./recipes.mjs').Storage$) => import('lit-html').TemplateResult} */
	const renderScreen = cond([
		[
			Storage$isLoading,
			always(
				html`<p class="recipe-empty" role="status">Opening your recipe box…</p>`,
			),
		],
		[Storage$isLoadFailed, pipe(Storage$LoadFailed$reason, storageRecovery)],
		[Storage$isReady, () => flow(model, [Model$Model$route, renderRoute])],
	])

	const storage = Model$Model$storage(model)
	const status = saveStatus()
	const content = renderScreen(storage)
	const samples = Storage$isReady(storage) ? sampleImport() : nothing

	return html`${status} ${content} ${samples}`
}
