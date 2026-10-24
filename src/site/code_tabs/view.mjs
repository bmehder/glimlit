// @ts-nocheck

import { html, render } from 'lit-html'
import {
  View, ModelAndUpdate, Effects,
  Next, Previous, First, Last,
  UserSelectedTab, UserNavigatedTab,
  Model$Model$selected as selected,
  tab_id,
} from './code_tabs.mjs'

const tabs = () => [
  { tab: new View(), label: 'View', file: 'view.mjs', panel: 'view-example' },
  { tab: new ModelAndUpdate(), label: 'Model & update', file: 'tutorial.gleam', panel: 'model-example' },
  { tab: new Effects(), label: 'Effects', file: 'effects.mjs', panel: 'effects-example' },
]

function navigate(event, tab, dispatch) {
  const direction = {
    ArrowRight: () => new Next(),
    ArrowLeft: () => new Previous(),
    Home: () => new First(),
    End: () => new Last(),
  }[event.key]
  if (!direction) return
  event.preventDefault()
  dispatch(new UserNavigatedTab(tab, direction()))
}

export function view(model, dispatch) {
  const tablist = document.querySelector('.code-tabs')
  if (!tablist) throw new Error('Missing homepage tab list')
  const entries = tabs()
  const selectedId = tab_id(selected(model))

  // Keep the highlighted code in the initial HTML, readable before JS starts.
  entries.forEach(({ tab, panel }) => {
    document.getElementById(panel).hidden = tab_id(tab) !== selectedId
  })

  tablist.querySelectorAll('[data-static-tab]').forEach(fallback => fallback.remove())

  render(html`${entries.map(({ tab, label, file, panel }) => {
    const id = tab_id(tab)
    const active = id === selectedId
    return html`<button
      id=${id} type="button" role="tab"
      aria-selected=${String(active)} aria-controls=${panel}
      tabindex=${active ? 0 : -1}
      @click=${() => dispatch(new UserSelectedTab(tab))}
      @keydown=${event => navigate(event, tab, dispatch)}
    >${label}<span>${file}</span></button>`
  })}`, tablist)
}
