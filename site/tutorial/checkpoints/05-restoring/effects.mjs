import {
  Msg$LocalStorageSavedDesign,
  Msg$LocalStorageSaveFailed,
  Msg$LocalStorageRestoreFailed,
  Msg$LocalStorageReturnedDesign,
  Msg$LocalStorageWasEmpty,
} from './postcard.mjs'

const key = 'glimlit.postcard.v1'

export function saveDesign(title, message, theme) {
  return {
    perform: () => localStorage.setItem(key, JSON.stringify({ title, message, theme })),
    onSuccess: () => Msg$LocalStorageSavedDesign(),
    onFailure: () => Msg$LocalStorageSaveFailed(),
  }
}

export function loadDesign() {
  return {
    perform: () => localStorage.getItem(key),
    onSuccess: saved => saved === null ? Msg$LocalStorageWasEmpty() : Msg$LocalStorageReturnedDesign(saved),
    onFailure: () => Msg$LocalStorageRestoreFailed(),
  }
}
