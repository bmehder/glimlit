import { navigationMarkup } from '../site/shared/navigation.mjs'
import { footerMarkup } from '../site/shared/footer.mjs'

export function siteNavigation() {
  return {
    name: 'shared-site-navigation',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return html
          .replace('<!-- site-navigation -->', navigationMarkup(context.path))
          .replace('<!-- site-footer -->', footerMarkup(context.path))
      },
    },
  }
}
