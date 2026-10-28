// @ts-check

import { html, nothing } from 'lit-html'
import { from_list } from '#gleam/array'
import { repeat } from 'lit-html/directives/repeat.js'
import { live } from 'lit-html/directives/live.js'
import {
	Msg$UserTypedNewTodo,
	Msg$UserSubmittedNewTodo,
	Msg$UserToggledTodoCompletion,
	Msg$UserClickedEditTodo,
	Msg$UserTypedTodoEdit,
	Msg$UserSubmittedTodoEdit,
	Msg$UserClickedCancelTodoEdit,
	Msg$UserClickedDeleteTodo,
	Model$Model$storage,
	Model$Model$shortcut_status,
	StorageState$isLoading,
	StorageState$isReady,
	StorageState$isFailed,
	StorageState$Failed$reason,
	ShortcutStatus$isStarting,
	ShortcutStatus$isListening,
	ShortcutStatus$isShortcutFailed,
	ShortcutStatus$ShortcutFailed$reason,
	Model$Model$todos,
	Model$Model$draft,
	Model$Model$editing,
	Editing$isEditing,
	Editing$Editing$id,
	Editing$Editing$text,
	Status$isCompleted,
	Todo$Todo$id,
	Todo$Todo$title,
	Todo$Todo$status,
} from './todos.mjs'

/** @typedef {import('./todos.mjs').Model$} Model */
/** @typedef {import('./todos.mjs').Todo$} Todo */
/** @typedef {import('./todos.mjs').Msg$} Msg */
/** @typedef {(message: Msg) => void} Dispatch */
/** @typedef {Event & { currentTarget: HTMLInputElement }} InputElementEvent */
/** @typedef {(event: InputElementEvent) => void} InputHandler */

/** @param {Model} model @param {Dispatch} dispatch @param {import('../runtime/instance.mjs').InstanceContext} context */
export function view(model, dispatch, context) {
	const { id } = context
	/** @type {Todo[]} */
	const todos = from_list(Model$Model$todos(model))
	const remaining = todos.filter(
		todo => !Status$isCompleted(Todo$Todo$status(todo)),
	).length

	/** @type {InputHandler} */
	const handleNewTodoInput = event => {
		dispatch(Msg$UserTypedNewTodo(event.currentTarget.value))
	}
	/** @param {Event} event */
	const handleNewTodoSubmit = event => {
		event.preventDefault()
		dispatch(Msg$UserSubmittedNewTodo())
	}
	const storageText = storageMessage(Model$Model$storage(model))
	const shortcutText = shortcutMessage(Model$Model$shortcut_status(model))
	const rows = repeat(todos, todo => Todo$Todo$id(todo), todoRow)

	return html`
			<header class="mb-8">
				<h2 class="text-2xl font-semibold tracking-tight">Todos</h2>
			</header>
			<form class="flex gap-3" @submit=${handleNewTodoSubmit}>
				<div class="min-w-0 flex-1">
					<label class="sr-only" for=${id('new-todo')}>New todo</label>
					<input
						id=${id('new-todo')}
						class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none"
						placeholder="What needs doing?"
						autocomplete="off"
						.value=${live(Model$Model$draft(model))}
						@input=${handleNewTodoInput}
					/>
				</div>
				<button
					class="cursor-pointer rounded-lg bg-teal-400 px-5 py-3 font-semibold text-slate-950 hover:bg-teal-300"
				>
					Add
				</button>
			</form>
			<p class="my-6 text-sm text-slate-400" role="status">
				${remaining} remaining · ${todos.length} total
			</p>
			${todos.length === 0
				? html`<p
						class="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500"
					>
						Your list is clear. Add a todo above.
					</p>`
				: html`
						<ul class="space-y-3">
							${rows}
						</ul>
					`}
			<p class="mt-8 text-xs text-slate-500">${storageText}</p>
			<p class="mt-2 text-xs text-slate-500" role="status">${shortcutText}</p>
		`

	/** @param {Todo} todo */
	function todoRow(todo) {
		const edit = Model$Model$editing(model)
		const editingThisTodo =
			Editing$isEditing(edit) && Editing$Editing$id(edit) === Todo$Todo$id(todo)
		const text = editingThisTodo ? Editing$Editing$text(edit) : ''
		const done = Status$isCompleted(Todo$Todo$status(todo))

		const handleToggleCompletion = () =>
			dispatch(Msg$UserToggledTodoCompletion(Todo$Todo$id(todo)))
		const handleEdit = () => dispatch(Msg$UserClickedEditTodo(Todo$Todo$id(todo)))
		/** @param {Event} event */
		const handleDelete = event => {
			const target = event.currentTarget
			if (!(target instanceof HTMLElement)) return
			const dialog = target.closest('li')?.querySelector('dialog')
			if (dialog instanceof HTMLDialogElement) {
				dialog.returnValue = ''
				dialog.showModal()
			}
		}
		/** @param {Event} event */
		const handleDeleteDialogClose = event => {
			const dialog = event.currentTarget
			if (dialog instanceof HTMLDialogElement && dialog.returnValue === 'delete') {
				dispatch(Msg$UserClickedDeleteTodo(Todo$Todo$id(todo)))
			}
		}
		return html`
			<li class="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div class="flex items-start gap-3">
					<input
						type="checkbox"
						class="mt-1 size-5 shrink-0 cursor-pointer accent-teal-400"
						aria-label=${`Mark ${Todo$Todo$title(todo)} ${done ? 'incomplete' : 'complete'}`}
						.checked=${live(done)}
						@change=${handleToggleCompletion}
					/>
					<span
						class=${`min-w-0 flex-1 break-words ${done ? 'text-slate-500 line-through' : 'text-slate-100'}`}
						>${Todo$Todo$title(todo)}</span
					>
					${editingThisTodo ? nothing : button('Edit', handleEdit)}
					${button('Delete', handleDelete)}
				</div>
				<dialog
					id=${id(`delete-todo-${Todo$Todo$id(todo)}`)}
					class="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-7 text-slate-100 shadow-2xl backdrop:bg-slate-950/70"
					aria-labelledby=${id(`delete-title-${Todo$Todo$id(todo)}`)}
					aria-describedby=${id(`delete-description-${Todo$Todo$id(todo)}`)}
					@close=${handleDeleteDialogClose}
				>
					<form method="dialog">
						<h2
							class="text-2xl font-semibold"
							id=${id(`delete-title-${Todo$Todo$id(todo)}`)}
						>
							Delete todo?
						</h2>
						<p
							class="mt-3 text-slate-300 wrap-anywhere"
							id=${id(`delete-description-${Todo$Todo$id(todo)}`)}
						>
							“${Todo$Todo$title(todo)}” will be removed from your list.
						</p>
						<div class="mt-7 flex flex-wrap justify-end gap-3">
							<button
								class="cursor-pointer rounded-lg bg-slate-700 px-4 py-2.5 font-semibold hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"
								value="cancel"
								autofocus
							>
								Keep todo
							</button>
							<button
								value="delete"
								class="cursor-pointer rounded-lg bg-rose-300 px-4 py-2.5 font-semibold text-rose-950 hover:bg-rose-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"
							>
								Delete todo
							</button>
						</div>
					</form>
				</dialog>
				${editingThisTodo ? editForm(Todo$Todo$id(todo), text) : nothing}
			</li>
		`
	}

	/** @param {number} todoId @param {string} text */
	function editForm(todoId, text) {
		/** @type {InputHandler} */
		const handleEditInput = event => {
			dispatch(Msg$UserTypedTodoEdit(event.currentTarget.value))
		}
		/** @param {Event} event */
		const handleEditSubmit = event => {
			event.preventDefault()
			dispatch(Msg$UserSubmittedTodoEdit())
		}
		const handleCancelEdit = () => dispatch(Msg$UserClickedCancelTodoEdit())

		return html`
			<form class="mt-4 flex flex-wrap items-end gap-3" @submit=${handleEditSubmit}>
				<div class="min-w-0 flex-1 basis-48">
					<label class="mb-2 block text-sm text-slate-400" for=${id(`edit-${todoId}`)}
						>Edit todo</label
					>
					<input
						id=${id(`edit-${todoId}`)}
						class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:border-teal-400 focus:outline-none"
						.value=${live(text)}
						@input=${handleEditInput}
					/>
				</div>
				<button
					class="cursor-pointer rounded-lg bg-teal-400 px-3 py-2 font-medium text-slate-950 hover:bg-teal-300"
				>
					Save
				</button>
				${button('Cancel', handleCancelEdit)}
			</form>
		`
	}
}

/** @param {string} label @param {(event: Event) => void} handleClick */
function button(label, handleClick) {
	return html`<button
		type="button"
		class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-teal-400"
		@click=${handleClick}
	>
		${label}
	</button>`
}

/** @param {import('./todos.mjs').StorageState$} storage */
function storageMessage(storage) {
	if (StorageState$isLoading(storage)) return 'Loading saved todos…'
	if (StorageState$isReady(storage)) return 'Todos are saved in this browser.'
	if (StorageState$isFailed(storage))
		return `${StorageState$Failed$reason(storage)} Changes are only in memory.`
	throw new Error('Unknown todo storage state')
}

/** @param {import('./todos.mjs').ShortcutStatus$} shortcutStatus */
function shortcutMessage(shortcutStatus) {
	if (ShortcutStatus$isStarting(shortcutStatus)) return 'Starting keyboard shortcut…'
	if (ShortcutStatus$isListening(shortcutStatus))
		return 'Press "n" inside this app, outside an input field, to focus the new-todo input.'
	if (ShortcutStatus$isShortcutFailed(shortcutStatus))
		return `Keyboard shortcut unavailable. ${ShortcutStatus$ShortcutFailed$reason(shortcutStatus)}`
	throw new Error('Unknown todo keyboard shortcut state')
}
