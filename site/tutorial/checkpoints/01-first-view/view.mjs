import { html } from 'lit-html'
import {
  Model$Model$title,
  Model$Model$message,
} from './postcard.mjs'

export function view(model, dispatch, context) {
  return html`
    <div class="studio">
      <div class="preview-area">
        <p class="preview-label">Live preview</p>
        <article class="postcard postcard-coral" aria-label="Your postcard preview">
          <div class="postcard-top"><span>A note from me to you</span><span class="postcard-stamp" aria-hidden="true">✳︎</span></div>
          <h3>${Model$Model$title(model)}</h3>
          <p class="postcard-message">${Model$Model$message(model)}</p>
          <div class="postcard-bottom"><span>Somewhere nice</span><span aria-hidden="true">↗</span></div>
        </article>
      </div>
    </div>
  `
}
