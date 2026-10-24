const cleanups = []

for (const header of document.querySelectorAll('[data-site-header]')) {
  const button = header.querySelector('.site-menu-toggle')
  const nav = header.querySelector('.site-navigation')
  const mobile = window.matchMedia('(max-width: 700px)')
  const controller = new AbortController()
  const options = { signal: controller.signal }

  function close(returnFocus = false) {
    header.removeAttribute('data-menu-open')
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-label', 'Open menu')
    if (returnFocus) button.focus()
  }

  button.hidden = false
  header.setAttribute('data-menu-ready', '')
  button.addEventListener('click', () => {
    if (header.hasAttribute('data-menu-open')) close()
    else {
      header.setAttribute('data-menu-open', '')
      button.setAttribute('aria-expanded', 'true')
      button.setAttribute('aria-label', 'Close menu')
    }
  }, options)
  nav.addEventListener('click', event => {
    // Let the link activate before hiding the element being clicked.
    if (event.target instanceof Element && event.target.closest('a')) setTimeout(() => close(), 0)
  }, options)
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) close()
  }, options)
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.hasAttribute('data-menu-open')) close(true)
  }, options)
  header.addEventListener('focusout', event => {
    if (!header.contains(event.relatedTarget)) close()
  }, options)
  mobile.addEventListener('change', () => {
    const focusWasInMenu = nav.contains(document.activeElement)
    close(mobile.matches && focusWasInMenu)
  }, options)
  cleanups.push(() => {
    controller.abort()
    header.removeAttribute('data-menu-ready')
    close()
    button.hidden = true
  })
}

if (import.meta.hot) import.meta.hot.dispose(() => cleanups.forEach(cleanup => cleanup()))
