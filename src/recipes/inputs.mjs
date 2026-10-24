// @ts-check

/** @param {Event} event */
export function inputValue(event) {
  const target = event.currentTarget
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : ''
}
