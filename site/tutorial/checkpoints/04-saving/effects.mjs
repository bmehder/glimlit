import {
  Msg$LocalStorageSavedDesign,
  Msg$LocalStorageSaveFailed,
} from './postcard.mjs'

const key = 'glimlit.postcard.v1'

export function saveDesign(title, message, theme) {
  return {
    perform: () => localStorage.setItem(key, JSON.stringify({ title, message, theme })),
    onSuccess: () => Msg$LocalStorageSavedDesign(),
    onFailure: () => Msg$LocalStorageSaveFailed(),
  }
}
