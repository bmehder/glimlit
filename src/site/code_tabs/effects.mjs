// @ts-nocheck

export const focusTab = id => ({
  perform: () => document.getElementById(id)?.focus(),
})
