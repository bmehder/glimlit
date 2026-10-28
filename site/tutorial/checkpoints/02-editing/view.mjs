import { html } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import {
  Model$Model$title,
  Model$Model$message,
  Msg$UserChangedTitle,
  Msg$UserChangedMessage,
} from './postcard.mjs'

export function view(model, dispatch) {
  const handleTitleInput = event => dispatch(Msg$UserChangedTitle(event.currentTarget.value))
  const handleMessageInput = event => dispatch(Msg$UserChangedMessage(event.currentTarget.value))

  return html`
    <div class="studio">
      <div class="studio-controls">
        <label for="postcard-title">A title for your postcard</label>
        <input id="postcard-title" maxlength="80"
          .value=${live(Model$Model$title(model))}
          @input=${handleTitleInput}>
        <label for="postcard-message">Your message</label>
        <textarea id="postcard-message" rows="4" maxlength="400"
          .value=${live(Model$Model$message(model))}
          @input=${handleMessageInput}></textarea>
      </div>
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
