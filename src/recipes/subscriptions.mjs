// @ts-check

/**
 * @template Msg
 * @param {(hash: string) => Msg} onChange
 * @returns {import('../runtime/subscriptions.mjs').Subscription<Msg>}
 */
export const hashRoute = onChange => ({
  start: emit => {
    const changed = () => emit(onChange(window.location.hash))
    window.addEventListener('hashchange', changed)
    changed()
    return () => window.removeEventListener('hashchange', changed)
  },
})
