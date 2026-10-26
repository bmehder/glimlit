import {
  Msg$DesignSaved,
  Msg$StorageFailed,
  Msg$StorageReturnedDesign,
  Msg$StorageWasEmpty,
} from './tutorial.mjs'

const key = 'glimlit.postcard.v1'

export function saveDesign(title, message, theme) {
  return {
    perform: () => localStorage.setItem(key, JSON.stringify({ title, message, theme })),
    onSuccess: () => Msg$DesignSaved(),
    onFailure: () => Msg$StorageFailed('Could not save. Browser storage may be unavailable.'),
  }
}

export function loadDesign() {
  return {
    perform: () => localStorage.getItem(key),
    onSuccess: saved => saved === null ? Msg$StorageWasEmpty() : Msg$StorageReturnedDesign(saved),
    onFailure: () => Msg$StorageFailed('Could not restore. Browser storage may be unavailable.'),
  }
}
