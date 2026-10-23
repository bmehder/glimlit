export function trackChapters(root) {
  const links = [...root.querySelectorAll('.lesson-nav a')]
  const sections = [...root.querySelectorAll('.lesson')]
  let activeId
  let frame = 0

  function update() {
    frame = 0
    const readingLine = Math.min(window.innerHeight * 0.25, 160)
    let current = sections[0]
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= readingLine) current = section
      else break
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = sections.at(-1)
    }
    if (!current || current.id === activeId) return
    activeId = current.id
    for (const link of links) {
      if (link.getAttribute('href') === `#${activeId}`) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update)
  }

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  window.addEventListener('hashchange', schedule)
  const observer = new ResizeObserver(schedule)
  observer.observe(root)
  schedule()

  return () => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('hashchange', schedule)
    observer.disconnect()
    cancelAnimationFrame(frame)
  }
}
