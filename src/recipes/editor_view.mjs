// @ts-check

import { html, nothing } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import { from_list as toArray } from '#gleam/array'
import {
  TitleChanged, DescriptionChanged, MinutesChanged,
  IngredientsChanged, InstructionsChanged,
} from './editor.mjs'
import { inputValue } from './inputs.mjs'

/**
 * @param {import('./editor.mjs').Model$} model
 * @param {(msg: import('./editor.mjs').Msg$) => void} dispatch
 * @param {() => void} submit
 * @param {boolean} editing
 * @param {string} cancelPath
 */
export function editorView(model, dispatch, submit, editing, cancelPath) {
  const errors = /** @type {string[]} */ (toArray(model.errors))
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
          <input required name="title" autocomplete="off" .value=${live(model.title)}
            @input=${/** @param {Event} event */ event => dispatch(new TitleChanged(inputValue(event)))}>
        </label>
        <label>A short description
          <textarea name="description" rows="2" .value=${live(model.description)}
            @input=${/** @param {Event} event */ event => dispatch(new DescriptionChanged(inputValue(event)))}></textarea>
        </label>
        <label class="recipe-minutes">Time in minutes
          <input required name="minutes" type="number" min="1" max="1440" step="1"
            .value=${live(model.minutes)}
            @input=${/** @param {Event} event */ event => dispatch(new MinutesChanged(inputValue(event)))}>
        </label>
        <div class="recipe-form-columns">
          <label>Ingredients
            <span class="recipe-hint">One ingredient per line.</span>
            <textarea required name="ingredients" rows="7" .value=${live(model.ingredients)}
              @input=${/** @param {Event} event */ event => dispatch(new IngredientsChanged(inputValue(event)))}></textarea>
          </label>
          <label>Instructions
            <span class="recipe-hint">One step per line.</span>
            <textarea required name="instructions" rows="7" .value=${live(model.instructions)}
              @input=${/** @param {Event} event */ event => dispatch(new InstructionsChanged(inputValue(event)))}></textarea>
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
