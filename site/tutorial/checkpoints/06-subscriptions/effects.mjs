import {
  Msg$LocalStorageSavedDesign,
  Msg$LocalStorageSaveFailed,
  Msg$LocalStorageRestoreFailed,
  Msg$LocalStorageReturnedDesign,
  Msg$LocalStorageWasEmpty,
  Msg$KeyboardShortcutsChanged,
  Shortcuts$isEnabled,
  Msg$KeyboardShortcutsFailed,
  Msg$UserPressedNextTheme,
} from './postcard.mjs'
import { nextThemeKey } from './subscriptions.mjs'

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

export function setShortcuts(shortcuts) {
  return {
    perform: ({ subscriptions, root }) => {
      if (Shortcuts$isEnabled(shortcuts)) {
        subscriptions.start('postcard-keys', nextThemeKey(Msg$UserPressedNextTheme, root))
      } else {
        subscriptions.stop('postcard-keys')
      }
    },
    onSuccess: () => Msg$KeyboardShortcutsChanged(shortcuts),
    onFailure: () => Msg$KeyboardShortcutsFailed(),
  }
}
