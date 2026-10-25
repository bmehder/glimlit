// @ts-check

import { html, render, nothing } from 'lit-html'
import { from_list as toArray } from '#gleam/array'
import { repeat } from 'lit-html/directives/repeat.js'
import { live } from 'lit-html/directives/live.js'
import {
	Msg$UserClickedRunEffectOrdering as UserClickedRunEffectOrdering,
	Msg$UserClickedStartResize as UserClickedStartResize,
	Msg$UserClickedStopResize as UserClickedStopResize,
	resize_can_start as resizeCanStart,
	resize_can_stop as resizeCanStop,
	resize_message as resizeMessage,
	Model$Model$window_width as windowWidth,
	Model$Model$window_height as windowHeight,
	Msg$UserClickedStartClock as UserClickedStartClock,
	Msg$UserClickedStopClock as UserClickedStopClock,
	clock_can_start as clockCanStart,
	clock_can_stop as clockCanStop,
	clock_message as clockMessage,
	Model$Model$clock_time as clockTime,
	Msg$UserClickedFetchTodo as UserClickedFetchTodo,
	is_fetching as isFetching,
	fetch_message as fetchMessage,
	Msg$UserTypedNewTodo as UserTypedNewTodo,
	Msg$UserSubmittedNewTodo as UserSubmittedNewTodo,
	Msg$UserToggledTodoCompletion as UserToggledTodoCompletion,
	Msg$UserClickedEditTodo as UserClickedEditTodo,
	Msg$UserTypedTodoEdit as UserTypedTodoEdit,
	Msg$UserSubmittedTodoEdit as UserSubmittedTodoEdit,
	Msg$UserClickedCancelTodoEdit as UserClickedCancelTodoEdit,
	Msg$UserClickedDeleteTodo as UserClickedDeleteTodo,
	storage_message as storageMessage,
	Model$Model$todos as todos,
	Model$Model$draft as draft,
	Model$Model$editing as editing,
	Editing$isEditing as isEditing,
	Editing$Editing$id as editingId,
	Editing$Editing$text as editText,
	Status$isCompleted as isCompleted,
	Todo$Todo$id as id,
	Todo$Todo$title as title,
	Todo$Todo$status as status,
} from './todos.mjs'

/** @typedef {import('./todos.mjs').Model$} Model */
/** @typedef {import('./todos.mjs').Todo$} Todo */
/** @typedef {import('./todos.mjs').Msg$} Msg */
/** @typedef {(message: Msg) => void} Dispatch */
/** @typedef {Event & { currentTarget: HTMLInputElement }} InputElementEvent */
/** @typedef {(event: InputElementEvent) => void} InputHandler */

/** @param {Model} model @param {Dispatch} dispatch */
export function view(model, dispatch) {
	const app = document.getElementById('app')
	if (!app) throw new Error('Missing #app mount element')

	/** @type {Todo[]} */
	const items = toArray(todos(model))
	const remaining = items.filter(todo => !isCompleted(status(todo))).length

	/** @type {InputHandler} */
	const handleNewTodoInput = event => {
		dispatch(UserTypedNewTodo(event.currentTarget.value))
	}
	const handleNewTodoSubmit = submit(UserSubmittedNewTodo(), dispatch)
	const handleStartClock = () => dispatch(UserClickedStartClock())
	const handleStopClock = () => dispatch(UserClickedStopClock())
	const handleStartResize = () => dispatch(UserClickedStartResize())
	const handleStopResize = () => dispatch(UserClickedStopResize())
	const handleFetchTodo = () => dispatch(UserClickedFetchTodo())
	const handleRunEffectOrdering = () => dispatch(UserClickedRunEffectOrdering())

	const canAdd = Boolean(draft(model).trim())
	const time = clockTime(model)
	const clockText = time === 0 ? '—' : new Date(time).toLocaleTimeString()
	const width = windowWidth(model)
	const windowSize = width === 0 ? '—' : `${width} × ${windowHeight(model)}`
	const fetchLabel = isFetching(model) ? 'Fetching…' : 'Fetch example todo'
	const rows = repeat(
		items,
		todo => id(todo),
		todo => todoRow(todo, model, dispatch),
	)

	render(
		html`
			<header class="mb-8">
				<h2 class="text-2xl font-semibold tracking-tight">Todos</h2>
			</header>
			<form class="flex gap-3" @submit=${handleNewTodoSubmit}>
				<div class="min-w-0 flex-1">
					<label class="sr-only" for="new-todo">New todo</label>
					<input
						id="new-todo"
						class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none"
						placeholder="What needs doing?"
						autocomplete="off"
						.value=${live(draft(model))}
						@input=${handleNewTodoInput}
					/>
				</div>
				<button
					class="cursor-pointer rounded-lg bg-teal-400 px-5 py-3 font-semibold text-slate-950 hover:bg-teal-300 disabled:cursor-default disabled:opacity-40"
					?disabled=${!canAdd}
				>
					Add
				</button>
			</form>
			<p class="my-6 text-sm text-slate-400" role="status">
				${remaining} remaining · ${items.length} total
			</p>
			${items.length === 0
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
			<section
				class="mt-8 border-t border-slate-800 pt-6"
				aria-label="Clock subscription"
			>
				<h2 class="text-lg font-medium">Clock</h2>
				<output class="my-3 block text-3xl tabular-nums">${clockText}</output>
				<div class="flex gap-3">
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40"
						?disabled=${!clockCanStart(model)}
						@click=${handleStartClock}
					>
						Start clock
					</button>
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40"
						?disabled=${!clockCanStop(model)}
						@click=${handleStopClock}
					>
						Stop clock
					</button>
				</div>
				<p class="mt-3 text-sm text-slate-400" role="status">
					${clockMessage(model)}
				</p>
			</section>
			<section
				class="mt-8 border-t border-slate-800 pt-6"
				aria-label="Window resize subscription"
			>
				<h2 class="text-lg font-medium">Window size</h2>
				<output class="my-3 block text-3xl tabular-nums">${windowSize}</output>
				<div class="flex gap-3">
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40"
						?disabled=${!resizeCanStart(model)}
						@click=${handleStartResize}
					>
						Watch window size
					</button>
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40"
						?disabled=${!resizeCanStop(model)}
						@click=${handleStopResize}
					>
						Stop watching
					</button>
				</div>
				<p class="mt-3 text-sm text-slate-400" role="status">
					${resizeMessage(model)}
				</p>
			</section>
			<section
				class="mt-8 border-t border-slate-800 pt-6"
				aria-label="Fetch example"
			>
				<button
					type="button"
					class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-teal-400 disabled:cursor-wait disabled:opacity-50"
					?disabled=${isFetching(model)}
					@click=${handleFetchTodo}
				>
					${fetchLabel}
				</button>
				<p class="mt-3 text-sm text-slate-400" role="status">
					${fetchMessage(model)}
				</p>
			</section>
			<section
				class="mt-8 border-t border-slate-800 pt-6"
				aria-label="Effect ordering example"
			>
				<h2 class="text-lg font-medium">Effect ordering</h2>
				<p class="my-3 text-sm text-slate-400">
					Two effects start in order and finish independently. Open the browser
					console to see the second finish first.
				</p>
				<button
					type="button"
					class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-teal-400"
					@click=${handleRunEffectOrdering}
				>
					Run effect ordering example
				</button>
			</section>
			<p class="mt-8 text-xs text-slate-500">${storageMessage(model)}</p>
		`,
		app,
	)
}

/** @param {Todo} todo @param {Model} model @param {Dispatch} dispatch */
function todoRow(todo, model, dispatch) {
	const edit = editing(model)
	const editingThisTodo = isEditing(edit) && editingId(edit) === id(todo)
	const text = editingThisTodo ? editText(edit) : ''
	const done = isCompleted(status(todo))

	const handleToggleCompletion = () => dispatch(UserToggledTodoCompletion(id(todo)))
	const handleEdit = () => dispatch(UserClickedEditTodo(id(todo)))
	const handleDelete = () => openDeleteDialog(id(todo))
	/** @param {Event} event */
	const handleDeleteDialogClose = event => {
		const dialog = event.currentTarget
		if (dialog instanceof HTMLDialogElement && dialog.returnValue === 'delete') {
			dispatch(UserClickedDeleteTodo(id(todo)))
		}
	}
	return html`
		<li class="rounded-xl border border-slate-800 bg-slate-900 p-4">
			<div class="flex items-start gap-3">
				<input
					type="checkbox"
					class="mt-1 size-5 shrink-0 cursor-pointer accent-teal-400"
					aria-label=${`Mark ${title(todo)} ${done ? 'incomplete' : 'complete'}`}
					.checked=${live(done)}
					@change=${handleToggleCompletion}
				/>
				<span
					class=${`min-w-0 flex-1 break-words ${done ? 'text-slate-500 line-through' : 'text-slate-100'}`}
					>${title(todo)}</span
				>
				${editingThisTodo ? nothing : button('Edit', handleEdit)}
				${button('Delete', handleDelete)}
			</div>
			<dialog
				id=${`delete-todo-${id(todo)}`}
				class="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-7 text-slate-100 shadow-2xl backdrop:bg-slate-950/70"
				aria-labelledby=${`delete-title-${id(todo)}`}
				aria-describedby=${`delete-description-${id(todo)}`}
				@close=${handleDeleteDialogClose}
			>
				<form method="dialog">
					<h2 class="text-2xl font-semibold" id=${`delete-title-${id(todo)}`}>
						Delete todo?
					</h2>
					<p
						class="mt-3 text-slate-300 wrap-anywhere"
						id=${`delete-description-${id(todo)}`}
					>
						“${title(todo)}” will be removed from your list.
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
			${editingThisTodo ? editForm(id(todo), text, dispatch) : nothing}
		</li>
	`
}

/** @param {number} todoId @param {string} text @param {Dispatch} dispatch */
function editForm(todoId, text, dispatch) {
	/** @type {InputHandler} */
	const handleEditInput = event => {
		dispatch(UserTypedTodoEdit(event.currentTarget.value))
	}
	const handleEditSubmit = submit(UserSubmittedTodoEdit(), dispatch)
	const handleCancelEdit = () => dispatch(UserClickedCancelTodoEdit())

	return html`
		<form class="mt-4 flex flex-wrap items-end gap-3" @submit=${handleEditSubmit}>
			<div class="min-w-0 flex-1 basis-48">
				<label class="mb-2 block text-sm text-slate-400" for=${`edit-${todoId}`}
					>Edit todo</label
				>
				<input
					id=${`edit-${todoId}`}
					class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:border-teal-400 focus:outline-none"
					.value=${live(text)}
					@input=${handleEditInput}
				/>
			</div>
			<button
				class="cursor-pointer rounded-lg bg-teal-400 px-3 py-2 font-medium text-slate-950 hover:bg-teal-300 disabled:opacity-40"
				?disabled=${!text.trim()}
			>
				Save
			</button>
			${button('Cancel', handleCancelEdit)}
		</form>
	`
}

/** @param {string} label @param {() => void} handleClick */
function button(label, handleClick) {
	return html`<button
		type="button"
		class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-teal-400"
		@click=${handleClick}
	>
		${label}
	</button>`
}

/** @param {Msg} message @param {Dispatch} dispatch @returns {(event: Event) => void} */
function submit(message, dispatch) {
	return event => {
		event.preventDefault()
		dispatch(message)
	}
}

/** @param {number} todoId */
function openDeleteDialog(todoId) {
	const dialog = document.getElementById(`delete-todo-${todoId}`)
	if (dialog instanceof HTMLDialogElement) {
		// Escape does not replace the previous result, so reset it on each opening.
		dialog.returnValue = ''
		dialog.showModal()
	}
}
