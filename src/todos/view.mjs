// @ts-check

import { html, render, nothing } from 'lit-html'
import { from_list } from '#gleam/array'
import { repeat } from 'lit-html/directives/repeat.js'
import { live } from 'lit-html/directives/live.js'
import {
	Msg$UserClickedRunEffectOrdering,
	Msg$UserClickedStartResize,
	Msg$UserClickedStopResize,
	resize_can_start,
	resize_can_stop,
	resize_message,
	Model$Model$window_width,
	Model$Model$window_height,
	Msg$UserClickedStartClock,
	Msg$UserClickedStopClock,
	clock_can_start,
	clock_can_stop,
	clock_message,
	Model$Model$clock_time,
	Msg$UserClickedFetchTodo,
	is_fetching,
	fetch_message,
	Msg$UserTypedNewTodo,
	Msg$UserSubmittedNewTodo,
	Msg$UserToggledTodoCompletion,
	Msg$UserClickedEditTodo,
	Msg$UserTypedTodoEdit,
	Msg$UserSubmittedTodoEdit,
	Msg$UserClickedCancelTodoEdit,
	Msg$UserClickedDeleteTodo,
	storage_message,
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

/** @param {Model} model @param {Dispatch} dispatch */
export function view(model, dispatch) {
	const app = document.getElementById('app')
	if (!app) throw new Error('Missing #app mount element')

	/** @type {Todo[]} */
	const items = from_list(Model$Model$todos(model))
	const remaining = items.filter(todo => !Status$isCompleted(Todo$Todo$status(todo))).length

	/** @type {InputHandler} */
	const handleNewTodoInput = event => {
		dispatch(Msg$UserTypedNewTodo(event.currentTarget.value))
	}
	const handleNewTodoSubmit = submit(Msg$UserSubmittedNewTodo(), dispatch)
	const handleStartClock = () => dispatch(Msg$UserClickedStartClock())
	const handleStopClock = () => dispatch(Msg$UserClickedStopClock())
	const handleStartResize = () => dispatch(Msg$UserClickedStartResize())
	const handleStopResize = () => dispatch(Msg$UserClickedStopResize())
	const handleFetchTodo = () => dispatch(Msg$UserClickedFetchTodo())
	const handleRunEffectOrdering = () => dispatch(Msg$UserClickedRunEffectOrdering())

	const canAdd = Boolean(Model$Model$draft(model).trim())
	const time = Model$Model$clock_time(model)
	const clockText = time === 0 ? '—' : new Date(time).toLocaleTimeString()
	const width = Model$Model$window_width(model)
	const windowSize = width === 0 ? '—' : `${width} × ${Model$Model$window_height(model)}`
	const fetchLabel = is_fetching(model) ? 'Fetching…' : 'Fetch example todo'
	const rows = repeat(
		items,
		todo => Todo$Todo$id(todo),
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
						.value=${live(Model$Model$draft(model))}
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
						?disabled=${!clock_can_start(model)}
						@click=${handleStartClock}
					>
						Start clock
					</button>
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40"
						?disabled=${!clock_can_stop(model)}
						@click=${handleStopClock}
					>
						Stop clock
					</button>
				</div>
				<p class="mt-3 text-sm text-slate-400" role="status">
					${clock_message(model)}
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
						?disabled=${!resize_can_start(model)}
						@click=${handleStartResize}
					>
						Watch window size
					</button>
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40"
						?disabled=${!resize_can_stop(model)}
						@click=${handleStopResize}
					>
						Stop watching
					</button>
				</div>
				<p class="mt-3 text-sm text-slate-400" role="status">
					${resize_message(model)}
				</p>
			</section>
			<section
				class="mt-8 border-t border-slate-800 pt-6"
				aria-label="Fetch example"
			>
				<button
					type="button"
					class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-teal-400 disabled:cursor-wait disabled:opacity-50"
					?disabled=${is_fetching(model)}
					@click=${handleFetchTodo}
				>
					${fetchLabel}
				</button>
				<p class="mt-3 text-sm text-slate-400" role="status">
					${fetch_message(model)}
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
			<p class="mt-8 text-xs text-slate-500">${storage_message(model)}</p>
		`,
		app,
	)
}

/** @param {Todo} todo @param {Model} model @param {Dispatch} dispatch */
function todoRow(todo, model, dispatch) {
	const edit = Model$Model$editing(model)
	const editingThisTodo = Editing$isEditing(edit) && Editing$Editing$id(edit) === Todo$Todo$id(todo)
	const text = editingThisTodo ? Editing$Editing$text(edit) : ''
	const done = Status$isCompleted(Todo$Todo$status(todo))

	const handleToggleCompletion = () => dispatch(Msg$UserToggledTodoCompletion(Todo$Todo$id(todo)))
	const handleEdit = () => dispatch(Msg$UserClickedEditTodo(Todo$Todo$id(todo)))
	const handleDelete = () => openDeleteDialog(Todo$Todo$id(todo))
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
				id=${`delete-todo-${Todo$Todo$id(todo)}`}
				class="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-7 text-slate-100 shadow-2xl backdrop:bg-slate-950/70"
				aria-labelledby=${`delete-title-${Todo$Todo$id(todo)}`}
				aria-describedby=${`delete-description-${Todo$Todo$id(todo)}`}
				@close=${handleDeleteDialogClose}
			>
				<form method="dialog">
					<h2 class="text-2xl font-semibold" id=${`delete-title-${Todo$Todo$id(todo)}`}>
						Delete todo?
					</h2>
					<p
						class="mt-3 text-slate-300 wrap-anywhere"
						id=${`delete-description-${Todo$Todo$id(todo)}`}
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
			${editingThisTodo ? editForm(Todo$Todo$id(todo), text, dispatch) : nothing}
		</li>
	`
}

/** @param {number} todoId @param {string} text @param {Dispatch} dispatch */
function editForm(todoId, text, dispatch) {
	/** @type {InputHandler} */
	const handleEditInput = event => {
		dispatch(Msg$UserTypedTodoEdit(event.currentTarget.value))
	}
	const handleEditSubmit = submit(Msg$UserSubmittedTodoEdit(), dispatch)
	const handleCancelEdit = () => dispatch(Msg$UserClickedCancelTodoEdit())

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
