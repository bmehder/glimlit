import { html, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import {
  Model$Model$title,
  Model$Model$message,
  Msg$UserChangedTitle,
  Msg$UserChangedMessage,
  Theme$Coral,
  Theme$Ocean,
  Theme$Meadow,
  Msg$UserSelectedTheme,
  Model$Model$theme,
  Theme$isCoral,
  Theme$isOcean,
  Theme$isMeadow,
} from './postcard.mjs'

export function view(model, dispatch) {
  const app = document.getElementById('postcard-app')
  if (!app) throw new Error('Missing #postcard-app mount element')

  const handleTitleInput = event => dispatch(Msg$UserChangedTitle(event.currentTarget.value))
  const handleMessageInput = event => dispatch(Msg$UserChangedMessage(event.currentTarget.value))

  function themeButton(label, value) {
    const handleThemeClick = () => dispatch(Msg$UserSelectedTheme(value))
    return html`<button type="button" class="theme-option"
      aria-pressed=${themeName(Model$Model$theme(model)) === themeName(value)}
      @click=${handleThemeClick}>${label}</button>`
  }

  render(html`
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
        <fieldset>
          <legend>Choose a colour</legend>
          <div class="theme-options">
            ${themeButton('Coral', Theme$Coral())}
            ${themeButton('Ocean', Theme$Ocean())}
            ${themeButton('Meadow', Theme$Meadow())}
          </div>
        </fieldset>
      </div>
      <div class="preview-area">
        <p class="preview-label">Live preview</p>
        <article class="postcard postcard-${themeName(Model$Model$theme(model))}" aria-label="Your postcard preview">
          <div class="postcard-top"><span>A note from me to you</span><span class="postcard-stamp" aria-hidden="true">✳︎</span></div>
          <h3>${Model$Model$title(model)}</h3>
          <p class="postcard-message">${Model$Model$message(model)}</p>
          <div class="postcard-bottom"><span>Somewhere nice</span><span aria-hidden="true">↗</span></div>
        </article>
      </div>
    </div>
  `, app)
}


function themeName(theme) {
  if (Theme$isCoral(theme)) return 'coral'
  if (Theme$isOcean(theme)) return 'ocean'
  if (Theme$isMeadow(theme)) return 'meadow'
  throw new Error('Unknown postcard theme')
}
