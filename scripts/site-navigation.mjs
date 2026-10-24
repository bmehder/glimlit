import { navigationMarkup } from '../src/site/navigation.mjs'

export function siteNavigation() {
  return {
    name: 'shared-site-navigation',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return html.replace('<!-- site-navigation -->', navigationMarkup(context.path))
      },
    },
  }
}
