import {
  Msg$DesignSaved,
  Msg$StorageFailed,
  Msg$StorageReturnedDesign,
  Msg$StorageWasEmpty,
  Msg$ShortcutsChanged,
  Msg$ShortcutsFailed,
  Msg$UserPressedNextTheme,
} from './tutorial.mjs'
import { nextThemeKey } from './subscriptions.mjs'

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

export function setShortcuts(enabled) {
  return {
    perform: ({ subscriptions, dispatch }) => {
      if (enabled) {
        subscriptions.start('postcard-keys', nextThemeKey(() => Msg$UserPressedNextTheme()), dispatch)
      } else {
        subscriptions.stop('postcard-keys')
      }
    },
    onSuccess: () => Msg$ShortcutsChanged(enabled),
    onFailure: () => Msg$ShortcutsFailed('Could not change keyboard shortcuts.'),
  }
}
