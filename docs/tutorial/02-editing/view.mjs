import { html, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import {
  Model$Model$title as title,
  Model$Model$message as message,
  UserChangedTitle,
  UserChangedMessage,
} from './tutorial.mjs'

export function view(model, dispatch) {
  const app = document.getElementById('tutorial-app')
  if (!app) throw new Error('Missing #tutorial-app mount element')

  render(html`
    <div class="studio">
      <div class="studio-controls">
        <label for="postcard-title">A title for your postcard</label>
        <input id="postcard-title" maxlength="80"
          .value=${live(title(model))}
          @input=${event => dispatch(new UserChangedTitle(event.currentTarget.value))}>
        <label for="postcard-message">Your message</label>
        <textarea id="postcard-message" rows="4" maxlength="400"
          .value=${live(message(model))}
          @input=${event => dispatch(new UserChangedMessage(event.currentTarget.value))}></textarea>
      </div>
      <div class="preview-area">
        <p class="preview-label">Live preview</p>
        <article class="postcard postcard-coral" aria-label="Your postcard preview">
          <div class="postcard-top"><span>A note from me to you</span><span class="postcard-stamp" aria-hidden="true">✳︎</span></div>
          <h3>${title(model)}</h3>
          <p class="postcard-message">${message(model)}</p>
          <div class="postcard-bottom"><span>Somewhere nice</span><span aria-hidden="true">↗</span></div>
        </article>
      </div>
    </div>
  `, app)
}
