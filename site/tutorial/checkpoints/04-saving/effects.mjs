import {
  Msg$DesignSaved,
  Msg$StorageFailed,
} from './postcard.mjs'

const key = 'glimlit.postcard.v1'

export function saveDesign(title, message, theme) {
  return {
    perform: () => localStorage.setItem(key, JSON.stringify({ title, message, theme })),
    onSuccess: () => Msg$DesignSaved(),
    onFailure: () => Msg$StorageFailed('Could not save. Browser storage may be unavailable.'),
  }
}
