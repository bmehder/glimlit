// @ts-check

import { html, render, nothing } from 'lit-html'
import { from_list as toArray } from '#gleam/array'
import { repeat } from 'lit-html/directives/repeat.js'
import { live } from 'lit-html/directives/live.js'
import {
	UserClickedStartResize,
	UserClickedStopResize,
	resize_can_start as resizeCanStart,
	resize_can_stop as resizeCanStop,
	resize_message as resizeMessage,
	Model$Model$window_width as windowWidth,
	Model$Model$window_height as windowHeight,
	UserClickedStartClock,
	UserClickedStopClock,
	clock_can_start as clockCanStart,
	clock_can_stop as clockCanStop,
	clock_message as clockMessage,
	Model$Model$clock_time as clockTime,
	UserClickedFetchTodo,
	is_fetching as isFetching,
	fetch_message as fetchMessage,
	UserTypedNewTodo,
	UserSubmittedNewTodo,
	UserToggledTodoCompletion,
	UserClickedEditTodo,
	UserTypedTodoEdit,
	UserSubmittedTodoEdit,
	UserClickedCancelTodoEdit,
	UserClickedDeleteTodo,
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

/** @param {Model} model @param {Dispatch} dispatch */
export function view(model, dispatch) {
	const app = document.getElementById('app')
	if (!app) throw new Error('Missing #app mount element')

	/** @type {Todo[]} */
	const items = toArray(todos(model))
	const remaining = items.filter(todo => !isCompleted(status(todo))).length

	render(
		html`
			<header class="mb-8">
				<p class="mb-2 text-sm font-medium text-teal-400">
					A little less to remember
				</p>
				<h1 class="text-3xl font-semibold tracking-tight">Todos</h1>
				<p class="mt-2 text-slate-400">One thing at a time.</p>
			</header>
			<form
				class="flex gap-3"
				@submit=${submit(new UserSubmittedNewTodo(), dispatch)}
			>
				<div class="min-w-0 flex-1">
					<label class="sr-only" for="new-todo">New todo</label>
					<input
						id="new-todo"
						class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none"
						placeholder="What needs doing?"
						autocomplete="off"
						.value=${live(draft(model))}
						@input=${input(UserTypedNewTodo, dispatch)}
					/>
				</div>
				<button
					class="cursor-pointer rounded-lg bg-teal-400 px-5 py-3 font-semibold text-slate-950 hover:bg-teal-300 disabled:cursor-default disabled:opacity-40"
					?disabled=${!draft(model).trim()}
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
							${repeat(items, id, todo => todoRow(todo, model, dispatch))}
						</ul>
					`}
			<section class="mt-8 border-t border-slate-800 pt-6" aria-label="Clock subscription">
				<h2 class="text-lg font-medium">Clock</h2>
				<output class="my-3 block text-3xl tabular-nums">${clockTime(model) === 0 ? '—' : new Date(clockTime(model)).toLocaleTimeString()}</output>
				<div class="flex gap-3">
					<button type="button" class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40" ?disabled=${!clockCanStart(model)} @click=${() => dispatch(new UserClickedStartClock())}>Start clock</button>
					<button type="button" class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40" ?disabled=${!clockCanStop(model)} @click=${() => dispatch(new UserClickedStopClock())}>Stop clock</button>
				</div>
				<p class="mt-3 text-sm text-slate-400" role="status">${clockMessage(model)}</p>
			</section>
			<section class="mt-8 border-t border-slate-800 pt-6" aria-label="Window resize subscription">
				<h2 class="text-lg font-medium">Window size</h2>
				<output class="my-3 block text-3xl tabular-nums">${windowWidth(model) === 0 ? '—' : `${windowWidth(model)} × ${windowHeight(model)}`}</output>
				<div class="flex gap-3">
					<button type="button" class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40" ?disabled=${!resizeCanStart(model)} @click=${() => dispatch(new UserClickedStartResize())}>Watch window size</button>
					<button type="button" class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:cursor-default disabled:opacity-40" ?disabled=${!resizeCanStop(model)} @click=${() => dispatch(new UserClickedStopResize())}>Stop watching</button>
				</div>
				<p class="mt-3 text-sm text-slate-400" role="status">${resizeMessage(model)}</p>
			</section>
			<section
				class="mt-8 border-t border-slate-800 pt-6"
				aria-label="Fetch example"
			>
				<button
					type="button"
					class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-teal-400 disabled:cursor-wait disabled:opacity-50"
					?disabled=${isFetching(model)}
					@click=${() => dispatch(new UserClickedFetchTodo())}
				>
					${isFetching(model) ? 'Fetching…' : 'Fetch example todo'}
				</button>
				<p class="mt-3 text-sm text-slate-400" role="status">
					${fetchMessage(model)}
				</p>
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
	return html`
		<li class="rounded-xl border border-slate-800 bg-slate-900 p-4">
			<div class="flex items-start gap-3">
				<input
					type="checkbox"
					class="mt-1 size-5 shrink-0 cursor-pointer accent-teal-400"
					aria-label=${`Mark ${title(todo)} ${done ? 'incomplete' : 'complete'}`}
					.checked=${live(done)}
					@change=${() => dispatch(new UserToggledTodoCompletion(id(todo)))}
				/>
				<span
					class=${`min-w-0 flex-1 break-words ${done ? 'text-slate-500 line-through' : 'text-slate-100'}`}
					>${title(todo)}</span
				>
				${editingThisTodo
					? nothing
					: button('Edit', new UserClickedEditTodo(id(todo)), dispatch)}
				${button('Delete', new UserClickedDeleteTodo(id(todo)), dispatch)}
			</div>
			${editingThisTodo
				? html`
						<form
							class="mt-4 flex flex-wrap items-end gap-3"
							@submit=${submit(new UserSubmittedTodoEdit(), dispatch)}
						>
							<div class="min-w-0 flex-1 basis-48">
								<label
									class="mb-2 block text-sm text-slate-400"
									for=${`edit-${id(todo)}`}
									>Edit todo</label
								>
								<input
									id=${`edit-${id(todo)}`}
									class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:border-teal-400 focus:outline-none"
									.value=${live(text)}
									@input=${input(UserTypedTodoEdit, dispatch)}
								/>
							</div>
							<button
								class="cursor-pointer rounded-lg bg-teal-400 px-3 py-2 font-medium text-slate-950 hover:bg-teal-300 disabled:opacity-40"
								?disabled=${!text.trim()}
							>
								Save
							</button>
							${button('Cancel', new UserClickedCancelTodoEdit(), dispatch)}
						</form>
					`
				: nothing}
		</li>
	`
}

/** @param {string} label @param {Msg} message @param {Dispatch} dispatch */
function button(label, message, dispatch) {
	return html`<button
		type="button"
		class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-teal-400"
		@click=${() => dispatch(message)}
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

/** @param {new (text: string) => Msg} Message @param {Dispatch} dispatch @returns {(event: Event) => void} */
function input(Message, dispatch) {
	return event => {
		if (event.currentTarget instanceof HTMLInputElement) {
			dispatch(new Message(event.currentTarget.value))
		}
	}
}
