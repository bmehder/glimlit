import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { contentPages } from '../scripts/content-pages.mjs'

const root = new URL('../', import.meta.url)

test('Docs and tutorial produce static highlighted HTML through one content pipeline', async () => {
  const plugin = contentPages()
  try {
    const render = async page => plugin.transformIndexHtml.handler(
      await readFile(new URL(`site/${page}/index.html`, root), 'utf8'),
      { path: `/${page}/index.html` },
    )
    const tutorial = await render('tutorial')
    for (const id of ['get-ready', 'first-view', 'editing', 'themes', 'saving', 'restoring', 'subscriptions', 'keep-going']) {
      assert.ok(tutorial.includes(`id="${id}"`), id)
      assert.ok(tutorial.includes(`href="#${id}"`), id)
    }
    assert.equal((tutorial.match(/class="source-details"/g) ?? []).length, 16)
    assert.equal((tutorial.match(/data-copy-file hidden/g) ?? []).length, 16)
    assert.ok(tutorial.includes('data-language="gleam"'))
    assert.ok(tutorial.includes('<span style="color:'))
    assert.ok(tutorial.includes('Press'))
    assert.ok(!/<!-- (?:code:|checkpoint:|tutorial-guide)/.test(tutorial))
    assert.ok(!tutorial.includes('mountGuide'))
    assert.ok(!tutorial.includes('virtual:tutorial-highlighting'))

    // Downloads and copy buttons must use the complete file, including its final
    // newline, rather than reconstructing source from highlighted markup.
    const download = tutorial.match(/href="(data:text\/plain;charset=utf-8,[^"]+)" download="postcard\.gleam"/)
    assert.ok(download)
    assert.equal(decodeURIComponent(download[1].slice(download[1].indexOf(',') + 1)),
      await readFile(new URL('site/tutorial/checkpoints/01-first-view/postcard.gleam', root), 'utf8'))

    const docs = await render('docs')
    assert.ok(docs.includes('class="docs-code"'))
    assert.ok(docs.includes('id="api-createSubscriptions"'))
    assert.ok(docs.includes('id="api-run"'))
    assert.ok(!/<!-- (?:code:|runtime-reference)/.test(docs))
  } finally {
    await plugin.closeBundle()
  }
})
