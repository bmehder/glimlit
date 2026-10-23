import {
  Msg$DesignSaved as designSaved,
  Msg$StorageFailed as storageFailed,
  Msg$StorageReturnedDesign as storageReturnedDesign,
  Msg$StorageWasEmpty as storageWasEmpty,
  Msg$ShortcutsChanged as shortcutsChanged,
  Msg$ShortcutsFailed as shortcutsFailed,
  UserPressedNextTheme,
} from './tutorial.mjs'
import { nextThemeKey } from './subscriptions.mjs'

const key = 'glimlit.postcard.v1'

export function saveDesign(title, message, theme) {
  return {
    perform: () => localStorage.setItem(key, JSON.stringify({ title, message, theme })),
    onSuccess: () => designSaved(),
    onFailure: () => storageFailed('Could not save. Browser storage may be unavailable.'),
  }
}

export function loadDesign() {
  return {
    perform: () => localStorage.getItem(key),
    onSuccess: saved => saved === null ? storageWasEmpty() : storageReturnedDesign(saved),
    onFailure: () => storageFailed('Could not restore. Browser storage may be unavailable.'),
  }
}

export function setShortcuts(enabled) {
  return {
    perform: ({ subscriptions, dispatch }) => {
      if (enabled) {
        subscriptions.start('postcard-keys', nextThemeKey(() => new UserPressedNextTheme()), dispatch)
      } else {
        subscriptions.stop('postcard-keys')
      }
    },
    onSuccess: () => shortcutsChanged(enabled),
    onFailure: () => shortcutsFailed('Could not change keyboard shortcuts.'),
  }
}
