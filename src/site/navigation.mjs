const pages = [
  { href: '/', label: 'Home' },
  { href: '/demo/', label: 'Demo' },
  { href: '/tutorial/', label: 'Tutorial' },
]

export function navigationMarkup(path) {
  const current = pages.find(page => page.href !== '/' && path.startsWith(page.href))?.href ?? '/'
  return `<header class="site-bar" data-site-header>
    <a class="brand" href="/" aria-label="Glimlit home"><img src="/brand/glimlit-wordmark-dark.svg" alt="Glimlit" width="180" height="48"></a>
    <button class="site-menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu" hidden>
      <svg class="menu-open-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      <svg class="menu-close-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
      <span>Menu</span>
    </button>
    <nav id="site-menu" class="site-navigation" aria-label="Main navigation">
      ${pages.map(page => `<a href="${page.href}"${current === page.href ? ' aria-current="page"' : ''}>${page.label}</a>`).join('\n      ')}
      <a class="github-link" href="https://github.com/bmehder/glimlit" target="_blank" rel="noopener noreferrer" aria-label="View Glimlit on GitHub (opens in a new tab)" title="GitHub">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.77-.244.77-.542 0-.267-.01-1.155-.015-2.096-3.13.68-3.791-1.327-3.791-1.327-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.077-.685.077-.685 1.13.08 1.725 1.16 1.725 1.16 1.004 1.72 2.633 1.223 3.275.935.102-.727.393-1.223.715-1.504-2.499-.284-5.126-1.25-5.126-5.564 0-1.23.44-2.233 1.16-3.022-.117-.285-.503-1.43.11-2.98 0 0 .945-.303 3.095 1.155a10.79 10.79 0 0 1 5.625 0c2.15-1.458 3.094-1.155 3.094-1.155.614 1.55.228 2.695.112 2.98.72.79 1.158 1.792 1.158 3.022 0 4.325-2.632 5.277-5.139 5.556.404.35.763 1.044.763 2.105 0 1.52-.014 2.745-.014 3.119 0 .3.203.65.774.54A11.252 11.252 0 0 0 12 .75Z"/></svg>
        <span class="github-label">GitHub</span>
      </a>
    </nav>
  </header>
  <script type="module" src="/src/site/menu.mjs"></script>`
}
