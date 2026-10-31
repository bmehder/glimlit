// @ts-check

import { inputValue, preventDefault } from '#browser/events'
import { html, nothing } from 'lit-html'
import {
	always,
	applySpec,
	cond,
	converge,
	count,
	length,
	map,
	pipe,
	subtract,
	T,
	thunkify,
} from 'ramda'
import { from_list } from '#gleam/array'
import { repeat } from 'lit-html/directives/repeat.js'
import { live } from 'lit-html/directives/live.js'
import {
	Editing$Editing$id,
	Editing$Editing$text,
	Editing$isEditing,
	Model$Model$draft,
	Model$Model$editing,
	Model$Model$shortcut_status,
	Model$Model$storage,
	Model$Model$todos,
	Msg$UserClickedCancelTodoEdit,
	Msg$UserClickedDeleteTodo,
	Msg$UserClickedEditTodo,
	Msg$UserSubmittedNewTodo,
	Msg$UserSubmittedTodoEdit,
	Msg$UserToggledTodoCompletion,
	Msg$UserTypedNewTodo,
	Msg$UserTypedTodoEdit,
	ShortcutStatus$isListening,
	ShortcutStatus$isShortcutFailed,
	ShortcutStatus$isStarting,
	ShortcutStatus$ShortcutFailed$reason,
	Status$isCompleted,
	StorageState$Failed$reason,
	StorageState$isFailed,
	StorageState$isLoading,
	StorageState$isReady,
	Todo$Todo$id,
	Todo$Todo$status,
	Todo$Todo$title,
} from './todos.mjs'

/** @typedef {import('./todos.mjs').Model$} Model */
/** @typedef {import('./todos.mjs').Todo$} Todo */
/** @typedef {import('./todos.mjs').Msg$} Msg */
/** @typedef {(message: Msg) => void} Dispatch */
/** @typedef {import('./todos.mjs').StorageState$} StorageState */
/** @typedef {import('./todos.mjs').ShortcutStatus$} ShortcutStatus */
/** @typedef {Event & { currentTarget: HTMLInputElement }} InputElementEvent */
/** @typedef {(event: InputElementEvent) => void} InputHandler */

/** @param {Model} model @param {Dispatch} dispatch @param {import('../runtime/instance.mjs').InstanceContext} context */
export const view = (model, dispatch, { id }) => {
	/** @type {(storage: StorageState) => string} */
	const storageMessage = cond([
		[StorageState$isLoading, always('Loading saved todos…')],
		[StorageState$isReady, always('Todos are saved in this browser.')],
		[
			StorageState$isFailed,
			pipe(
				StorageState$Failed$reason,
				reason => `${reason} Changes are only in memory.`,
			),
		],
		[
			T,
			/** @param {StorageState} _storage @returns {string} */ _storage => {
				throw new Error('Unknown todo storage state')
			},
		],
	])

	/** @type {(status: ShortcutStatus) => string} */
	const shortcutMessage = cond([
		[ShortcutStatus$isStarting, always('Starting keyboard shortcut…')],
		[
			ShortcutStatus$isListening,
			always(
				'Press "n" inside this app, outside an input field, to focus the new-todo input.',
			),
		],
		[
			ShortcutStatus$isShortcutFailed,
			pipe(
				ShortcutStatus$ShortcutFailed$reason,
				reason => `Keyboard shortcut unavailable. ${reason}`,
			),
		],
		[
			T,
			/** @param {ShortcutStatus} _status @returns {string} */ _status => {
				throw new Error('Unknown todo keyboard shortcut state')
			},
		],
	])

	const { todos, draft, editing, storageText, shortcutText } = applySpec({
		todos: pipe(Model$Model$todos, from_list),
		draft: Model$Model$draft,
		editing: Model$Model$editing,
		storageText: pipe(Model$Model$storage, storageMessage),
		shortcutText: pipe(Model$Model$shortcut_status, shortcutMessage),
	})(model)

	const remaining = converge(subtract, [
		length,
		pipe(map(Todo$Todo$status), count(Status$isCompleted)),
	])(todos)

	/** @type {InputHandler} */
	const handleNewTodoInput = pipe(inputValue, Msg$UserTypedNewTodo, dispatch)

	const handleNewTodoSubmit = pipe(
		preventDefault,
		Msg$UserSubmittedNewTodo,
		dispatch,
	)

	/** @param {string} label @param {(event: Event) => void} handleClick */
	const button = (label, handleClick) => {
		return html`<button
			type="button"
			class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-teal-400"
			@click=${handleClick}
		>
			${label}
		</button>`
	}

	/** @param {number} todoId @param {string} text */
	const editForm = (todoId, text) => {
		/** @type {InputHandler} */
		const handleEditInput = pipe(inputValue, Msg$UserTypedTodoEdit, dispatch)

		const handleEditSubmit = pipe(
			preventDefault,
			Msg$UserSubmittedTodoEdit,
			dispatch,
		)

		const handleCancelEdit = pipe(Msg$UserClickedCancelTodoEdit, dispatch)

		return html`
			<form
				class="mt-4 flex flex-wrap items-end gap-3"
				@submit=${handleEditSubmit}
			>
				<div class="min-w-0 flex-1 basis-48">
					<label
						class="mb-2 block text-sm text-slate-400"
						for=${id(`edit-${todoId}`)}
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

	/** @param {Todo} todo */
	const todoRow = todo => {
		const { todoId, title, done } = applySpec({
			todoId: Todo$Todo$id,
			title: Todo$Todo$title,
			done: pipe(Todo$Todo$status, Status$isCompleted),
		})(todo)
		const editingThisTodo =
			Editing$isEditing(editing) && Editing$Editing$id(editing) === todoId
		const text = editingThisTodo ? Editing$Editing$text(editing) : ''
		const handleToggleCompletion = thunkify(
			pipe(Msg$UserToggledTodoCompletion, dispatch),
		)(todoId)
		const handleEdit = thunkify(pipe(Msg$UserClickedEditTodo, dispatch))(todoId)
		const handleConfirmDelete = thunkify(
			pipe(Msg$UserClickedDeleteTodo, dispatch),
		)(todoId)
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
			if (
				dialog instanceof HTMLDialogElement &&
				dialog.returnValue === 'delete'
			) {
				handleConfirmDelete()
			}
		}

		return html`
			<li class="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div class="flex items-start gap-3">
					<input
						type="checkbox"
						class="mt-1 size-5 shrink-0 cursor-pointer accent-teal-400"
						aria-label=${`Mark ${title} ${done ? 'incomplete' : 'complete'}`}
						.checked=${live(done)}
						@change=${handleToggleCompletion}
					/>
					<span
						class=${`min-w-0 flex-1 break-words ${done ? 'text-slate-500 line-through' : 'text-slate-100'}`}
						>${title}</span
					>
					${editingThisTodo ? nothing : button('Edit', handleEdit)}
					${button('Delete', handleDelete)}
				</div>
				<dialog
					id=${id(`delete-todo-${todoId}`)}
					class="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-7 text-slate-100 shadow-2xl backdrop:bg-slate-950/70"
					aria-labelledby=${id(`delete-title-${todoId}`)}
					aria-describedby=${id(`delete-description-${todoId}`)}
					@close=${handleDeleteDialogClose}
				>
					<form method="dialog">
						<h2
							class="text-2xl font-semibold"
							id=${id(`delete-title-${todoId}`)}
						>
							Delete todo?
						</h2>
						<p
							class="mt-3 text-slate-300 wrap-anywhere"
							id=${id(`delete-description-${todoId}`)}
						>
							“${title}” will be removed from your list.
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
				${editingThisTodo ? editForm(todoId, text) : nothing}
			</li>
		`
	}

	const rows = repeat(todos, Todo$Todo$id, todoRow)

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
					.value=${live(draft)}
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
		${
			todos.length === 0
				? html`<p
						class="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500"
					>
						Your list is clear. Add a todo above.
					</p>`
				: html`
						<ul class="space-y-3">
							${rows}
						</ul>
					`
		}
		<p class="mt-8 text-xs text-slate-500">${storageText}</p>
		<p class="mt-2 text-xs text-slate-500" role="status">${shortcutText}</p>
	`
}
