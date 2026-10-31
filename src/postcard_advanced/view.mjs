// @ts-nocheck

import { inputValue } from '#browser/events'
import { message_text, title_text } from './text.mjs'
import { html } from 'lit-html'
import { always, applySpec, cond, eqBy, pipe, T, thunkify } from 'ramda'
import { live } from 'lit-html/directives/live.js'
import {
	Model$Model$message,
	Model$Model$notice,
	Model$Model$shortcuts,
	Model$Model$theme,
	Model$Model$title,
	Msg$UserChangedMessage,
	Msg$UserChangedTitle,
	Msg$UserClickedRestore,
	Msg$UserClickedSave,
	Msg$UserSelectedTheme,
	Msg$UserToggledShortcuts,
	Notice$isInvalidSavedDesign,
	Notice$isMessageRequired,
	Notice$isNoSavedDesign,
	Notice$isRestored,
	Notice$isRestoreFailed,
	Notice$isSaved,
	Notice$isSaveFailed,
	Notice$isSaving,
	Notice$isShortcutSetupFailed,
	Notice$isTitleRequired,
	Notice$isUnsaved,
	Shortcuts$isEnabled,
	Theme$Coral,
	Theme$isCoral,
	Theme$isMeadow,
	Theme$isOcean,
	Theme$Meadow,
	Theme$Ocean,
} from './postcard_advanced.mjs'

export const view = (model, dispatch, { id }) => {
	const themeName = cond([
		[Theme$isCoral, always('coral')],
		[Theme$isOcean, always('ocean')],
		[Theme$isMeadow, always('meadow')],
		[
			T,
			() => {
				throw new Error('Unknown postcard theme')
			},
		],
	])

	const noticeText = cond([
		[Notice$isTitleRequired, always('Enter a title before saving.')],
		[Notice$isMessageRequired, always('Enter a message before saving.')],
		[
			Notice$isUnsaved,
			always('Your design stays in this tab until you save it.'),
		],
		[Notice$isSaving, always('Saving…')],
		[Notice$isSaved, always('Saved in this browser.')],
		[
			Notice$isSaveFailed,
			always('Could not save. Browser storage may be unavailable.'),
		],
		[
			Notice$isRestoreFailed,
			always('Could not restore. Browser storage may be unavailable.'),
		],
		[Notice$isNoSavedDesign, always('No saved design yet. Save one first.')],
		[Notice$isRestored, always('Restored your saved design.')],
		[
			Notice$isInvalidSavedDesign,
			always('The saved design could not be read.'),
		],
		[
			Notice$isShortcutSetupFailed,
			always('Could not change keyboard shortcuts.'),
		],
		[
			T,
			() => {
				throw new Error('Unknown postcard notice')
			},
		],
	])

	const sameTheme = eqBy(themeName)

	const { title, message, theme, selectedTheme, notice, shortcutsEnabled } =
		applySpec({
			title: pipe(Model$Model$title, title_text),
			message: pipe(Model$Model$message, message_text),
			theme: pipe(Model$Model$theme, themeName),
			selectedTheme: Model$Model$theme,
			notice: pipe(Model$Model$notice, noticeText),
			shortcutsEnabled: pipe(Model$Model$shortcuts, Shortcuts$isEnabled),
		})(model)

	const handleTitleInput = pipe(inputValue, Msg$UserChangedTitle, dispatch)
	const handleMessageInput = pipe(inputValue, Msg$UserChangedMessage, dispatch)
	const handleSaveClick = pipe(Msg$UserClickedSave, dispatch)
	const handleRestoreClick = pipe(Msg$UserClickedRestore, dispatch)
	const handleShortcutsChange = pipe(Msg$UserToggledShortcuts, dispatch)

	const themeButton = (label, value) => {
		const handleThemeClick = thunkify(pipe(Msg$UserSelectedTheme, dispatch))(
			value,
		)

		return html` <button
			type="button"
			class="theme-option"
			aria-pressed=${sameTheme(selectedTheme, value)}
			@click=${handleThemeClick}
		>
			${label}
		</button>`
	}

	return html`
		<div class="studio">
			<div class="studio-controls">
				<label for=${id('postcard-title')}>A title for your postcard</label>
				<input
					id=${id('postcard-title')}
					maxlength="80"
					.value=${live(title)}
					@input=${handleTitleInput}
				/>
				<label for=${id('postcard-message')}>Your message</label>
				<textarea
					id=${id('postcard-message')}
					rows="4"
					maxlength="400"
					data-ssr-value=${message}
					.value=${live(message)}
					@input=${handleMessageInput}
				></textarea>
				<fieldset>
					<legend>Choose a colour</legend>
					<div class="theme-options">
						${themeButton('Coral', Theme$Coral())}
						${themeButton('Ocean', Theme$Ocean())}
						${themeButton('Meadow', Theme$Meadow())}
					</div>
				</fieldset>
				<div class="studio-actions">
					<button type="button" @click=${handleSaveClick}>Save design</button>
					<button type="button" class="secondary" @click=${handleRestoreClick}>
						Restore saved
					</button>
				</div>
				<p class="studio-status" role="status">${notice}</p>
				<label class="shortcut-toggle" for=${id('postcard-shortcuts')}>
					<input
						id=${id('postcard-shortcuts')}
						type="checkbox"
						.checked=${shortcutsEnabled}
						@change=${handleShortcutsChange}
					/>
					Enable keyboard shortcuts
				</label>
				<p class="studio-hint">
					Press N inside the postcard, outside an input field, to cycle colours.
					Turn shortcuts off to remove the listener.
				</p>
			</div>
			<div class="preview-area">
				<p class="preview-label">Live preview</p>
				<article
					class="postcard postcard-${theme}"
					aria-label="Your postcard preview"
				>
					<div class="postcard-top">
						<span>A note from me to you</span
						><span class="postcard-stamp" aria-hidden="true">✳︎</span>
					</div>
					<h3>${title}</h3>
					<p class="postcard-message">${message}</p>
					<div class="postcard-bottom">
						<span>Somewhere nice</span><span aria-hidden="true">↗</span>
					</div>
				</article>
			</div>
		</div>
	`
}
