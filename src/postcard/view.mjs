// @ts-nocheck

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
	theme_name,
	Msg$UserClickedSave,
	Model$Model$notice,
	Msg$UserClickedRestore,
	Msg$UserToggledShortcuts,
	Model$Model$shortcuts,
} from './postcard.mjs'

export function view(model, dispatch) {
	const app = document.getElementById('postcard-app')
	if (!app) throw new Error('Missing #postcard-app mount element')

	render(
		html`
			<div class="studio">
				<div class="studio-controls">
					<label for="postcard-title">A title for your postcard</label>
					<input
						id="postcard-title"
						maxlength="80"
						.value=${live(Model$Model$title(model))}
						@input=${event =>
							dispatch(Msg$UserChangedTitle(event.currentTarget.value))}
					/>
					<label for="postcard-message">Your message</label>
					<textarea
						id="postcard-message"
						rows="4"
						maxlength="400"
						.value=${live(Model$Model$message(model))}
						@input=${event =>
							dispatch(Msg$UserChangedMessage(event.currentTarget.value))}
					></textarea>
					<fieldset>
						<legend>Choose a colour</legend>
						<div class="theme-options">
							${themeButton('Coral', Theme$Coral(), model, dispatch)}
							${themeButton('Ocean', Theme$Ocean(), model, dispatch)}
							${themeButton('Meadow', Theme$Meadow(), model, dispatch)}
						</div>
					</fieldset>
					<div class="studio-actions">
						<button type="button" @click=${() => dispatch(Msg$UserClickedSave())}>
							Save design
						</button>
						<button
							type="button"
							class="secondary"
							@click=${() => dispatch(Msg$UserClickedRestore())}
						>
							Restore saved
						</button>
					</div>
					<p class="studio-status" role="status">${Model$Model$notice(model)}</p>
					<label class="shortcut-toggle" for="postcard-shortcuts">
						<input
							id="postcard-shortcuts"
							type="checkbox"
							.checked=${Model$Model$shortcuts(model)}
							@change=${() => dispatch(Msg$UserToggledShortcuts())}
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
						class="postcard postcard-${theme_name(Model$Model$theme(model))}"
						aria-label="Your postcard preview"
					>
						<div class="postcard-top">
							<span>A note from me to you</span
							><span class="postcard-stamp" aria-hidden="true">✳︎</span>
						</div>
						<h3>${Model$Model$title(model)}</h3>
						<p class="postcard-message">${Model$Model$message(model)}</p>
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
		aria-pressed=${theme_name(Model$Model$theme(model)) === theme_name(value)}
		@click=${() => dispatch(Msg$UserSelectedTheme(value))}
	>
		${label}
	</button>`
}
