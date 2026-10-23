// @ts-nocheck

import { html, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import {
	Model$Model$title as title,
	Model$Model$message as message,
	UserChangedTitle,
	UserChangedMessage,
	Coral,
	Ocean,
	Meadow,
	UserSelectedTheme,
	Model$Model$theme as theme,
	theme_name as themeName,
	UserClickedSave,
	Model$Model$notice as notice,
	UserClickedRestore,
	UserToggledShortcuts,
	Model$Model$shortcuts as shortcuts,
} from './tutorial.mjs'

export function view(model, dispatch) {
	const app = document.getElementById('tutorial-app')
	if (!app) throw new Error('Missing #tutorial-app mount element')

	render(
		html`
			<div class="studio">
				<div class="studio-controls">
					<label for="postcard-title">A title for your postcard</label>
					<input
						id="postcard-title"
						maxlength="80"
						.value=${live(title(model))}
						@input=${event =>
							dispatch(new UserChangedTitle(event.currentTarget.value))}
					/>
					<label for="postcard-message">Your message</label>
					<textarea
						id="postcard-message"
						rows="4"
						maxlength="400"
						.value=${live(message(model))}
						@input=${event =>
							dispatch(new UserChangedMessage(event.currentTarget.value))}
					></textarea>
					<fieldset>
						<legend>Choose a colour</legend>
						<div class="theme-options">
							${themeButton('Coral', new Coral(), model, dispatch)}
							${themeButton('Ocean', new Ocean(), model, dispatch)}
							${themeButton('Meadow', new Meadow(), model, dispatch)}
						</div>
					</fieldset>
					<div class="studio-actions">
						<button type="button" @click=${() => dispatch(new UserClickedSave())}>
							Save design
						</button>
						<button
							type="button"
							class="secondary"
							@click=${() => dispatch(new UserClickedRestore())}
						>
							Restore saved
						</button>
					</div>
					<p class="studio-status" role="status">${notice(model)}</p>
					<label class="shortcut-toggle" for="postcard-shortcuts">
						<input
							id="postcard-shortcuts"
							type="checkbox"
							.checked=${shortcuts(model)}
							@change=${() => dispatch(new UserToggledShortcuts())}
						/>
						Enable keyboard shortcuts
					</label>
					<p class="studio-hint">
						Press N outside an input field to cycle colours. Turn shortcuts off to
						remove the listener.
					</p>
				</div>
				<div class="preview-area">
					<p class="preview-label">Live preview</p>
					<article
						class="postcard postcard-${themeName(theme(model))}"
						aria-label="Your postcard preview"
					>
						<div class="postcard-top">
							<span>A note from me to you</span
							><span class="postcard-stamp" aria-hidden="true">✳︎</span>
						</div>
						<h3>${title(model)}</h3>
						<p class="postcard-message">${message(model)}</p>
						<div class="postcard-bottom">
							<span>Somewhere nice</span><span aria-hidden="true">↗</span>
						</div>
					</article>
				</div>
			</div>
		`,
		app,
	)
}

function themeButton(label, value, model, dispatch) {
	return html`<button
		type="button"
		class="theme-option"
		aria-pressed=${themeName(theme(model)) === themeName(value)}
		@click=${() => dispatch(new UserSelectedTheme(value))}
	>
		${label}
	</button>`
}
