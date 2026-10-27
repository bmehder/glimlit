export function nextThemeKey(handleNext) {
  return {
    start: emit => {
      const handleKeydown = event => {
        const editing =
          event.target instanceof HTMLElement &&
          (event.target.matches('input, textarea, select') ||
            event.target.isContentEditable ||
            event.target.closest('dialog'))
        if (
          editing ||
          event.defaultPrevented ||
          event.isComposing ||
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.shiftKey
        ) return
        if (event.key.toLowerCase() !== 'n') return
        event.preventDefault()
        emit(handleNext())
      }
      window.addEventListener('keydown', handleKeydown)
      return () => window.removeEventListener('keydown', handleKeydown)
    },
  }
}
