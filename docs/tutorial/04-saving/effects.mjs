import {
  Msg$DesignSaved as designSaved,
  Msg$StorageFailed as storageFailed,
} from './tutorial.mjs'

const key = 'glimlit.postcard.v1'

export function saveDesign(title, message, theme) {
  return {
    perform: () => localStorage.setItem(key, JSON.stringify({ title, message, theme })),
    onSuccess: () => designSaved(),
    onFailure: () => storageFailed('Could not save. Browser storage may be unavailable.'),
  }
}
