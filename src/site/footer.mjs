import { pages, githubLinkMarkup, currentPage } from './navigation.mjs'

export function footerMarkup(path) {
  const current = currentPage(path)
  return `<footer class="site-footer">
    <span>Glimlit · Gleam + lit-html</span>
    <nav aria-label="Footer navigation">
      ${pages.map(page => `<a href="${page.href}"${current === page.href ? ' aria-current="page"' : ''}>${page.label}</a>`).join('\n      ')}
      ${githubLinkMarkup()}
    </nav>
  </footer>`
}
