// @ts-check

import { html, render, nothing } from 'lit-html'
import { from_list as toArray } from '#gleam/array'
import { Collection, Detail, Edit, New } from './route.mjs'
import {
  Loading, LoadFailed, Saving, SaveFailed, RetryLoad, UseStarters,
  RetrySave, ImportRequested, ImportCancelled, EditorChanged, RecipeSubmitted,
} from './recipes.mjs'
import { collection } from './collection.mjs'
import { detail } from './detail.mjs'
import { editorView } from './editor_view.mjs'

/** @typedef {import('./recipes.mjs').Model$} Model */
/** @typedef {(msg: import('./recipes.mjs').Msg$) => void} Dispatch */

/** @param {Model} model @param {Dispatch} dispatch */
export function view(model, dispatch) {
  const mount = document.getElementById('recipe-app')
  if (!mount) throw new Error('Missing #recipe-app mount element')
  const ready = !(model.storage instanceof Loading || model.storage instanceof LoadFailed)

  render(html`
    ${saveStatus(model, dispatch)}
    ${screen(model, dispatch)}
    ${ready ? sampleImport(model, dispatch) : nothing}
  `, mount)
}

/** @param {Model} model @param {Dispatch} dispatch */
function screen(model, dispatch) {
  if (model.storage instanceof Loading) {
    return html`<p class="recipe-empty" role="status">Opening your recipe box…</p>`
  }
  if (model.storage instanceof LoadFailed) return storageRecovery(model.storage[0], dispatch)
  if (model.route instanceof Collection) return collection(model, dispatch)
  if (model.route instanceof New) return editorScreen(model, dispatch, false, '#/')

  const recipe = selectedRecipe(model)
  if (model.route instanceof Detail && recipe) return detail(recipe, dispatch)
  if (model.route instanceof Edit && recipe) {
    return editorScreen(model, dispatch, true, `#/recipe/${recipe.id}`)
  }
  return html`
    <section class="recipe-empty">
      <h2>That recipe isn’t here.</h2>
      <p>It may have been removed, or the address may be incomplete.</p>
      <a class="recipe-button" href="#/">Back to collection</a>
    </section>
  `
}

/** @param {Model} model */
function selectedRecipe(model) {
  const route = model.route
  if (!(route instanceof Detail || route instanceof Edit)) return undefined
  const recipes = /** @type {import('./recipe.mjs').Recipe$[]} */ (toArray(model.recipes))
  return recipes.find(recipe => recipe.id === route[0])
}

/** @param {Model} model @param {Dispatch} dispatch @param {boolean} editing @param {string} cancelPath */
function editorScreen(model, dispatch, editing, cancelPath) {
  return editorView(
    model.editor,
    message => dispatch(new EditorChanged(message)),
    () => dispatch(new RecipeSubmitted()),
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
        <button class="recipe-button" @click=${() => dispatch(new RetryLoad())}>Try loading again</button>
        <button class="recipe-filter" @click=${() => dispatch(new UseStarters())}>Replace with starter recipes</button>
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
  let message = html`Kept in this browser · No account needed`
  if (model.saving instanceof Saving) message = html`Saving in this browser…`
  if (model.saving instanceof SaveFailed) {
    message = html`
      ${model.saving[0]}
      <button @click=${() => dispatch(new RetrySave())}>Retry saving</button>
    `
  }
  return html`<div class="recipe-save-status" role="status">${message}</div>`
}

/** @param {Model} model @param {Dispatch} dispatch */
function sampleImport(model, dispatch) {
  const label = model.importing ? 'Restart sample import' : 'Import sample recipes'
  return html`
    <aside class="recipe-samples" aria-labelledby="samples-title">
      <div>
        <p class="recipe-eyebrow">A little inspiration</p>
        <h2 id="samples-title">Make room for something new.</h2>
        <p>Import two more recipes into your collection. Recipes with matching titles are kept.</p>
        <p class="recipe-notice" role="status">${model.notice}</p>
      </div>
      <div class="recipe-sample-actions">
        <button type="button" class="recipe-filter" aria-busy=${String(model.importing)}
          @click=${() => dispatch(new ImportRequested())}>${label}</button>
        ${model.importing ? html`
          <button type="button" class="recipe-back"
            @click=${() => dispatch(new ImportCancelled())}>Cancel import</button>
        ` : nothing}
      </div>
    </aside>
  `
}
