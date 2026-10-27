import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build, createServer } from 'vite'
import { gleamProject } from '../scripts/gleam-source.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

// Use real compiled modules, repeated basenames, and a package name other than
// glimlit so the test cannot pass because of this repository's old aliases.
test('a separate website root resolves nested apps and live edits without app aliases', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'glimlit-resolution-')))
  let server
  try {
    for (const file of ['gleam.toml', 'manifest.toml', 'package.json']) {
      await cp(join(root, file), join(directory, file))
    }
    const manifest = await readFile(join(directory, 'gleam.toml'), 'utf8')
    await writeFile(join(directory, 'gleam.toml'), manifest.replace('name = "glimlit"', 'name = "resolution_fixture"'))
    await mkdir(join(directory, 'build'))
    await symlink(join(root, 'build/packages'), join(directory, 'build/packages'), 'dir')
    await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
    for (const name of ['first', 'nested/second']) {
      const folder = join(directory, 'src', name)
      await mkdir(folder, { recursive: true })
      await writeFile(join(folder, 'widget.gleam'), `
@external(javascript, "./view.mjs", "describe")
fn describe() -> String

pub fn label() -> String { "${name}" }
pub fn main() -> String { describe() }
`)
      await writeFile(join(folder, 'view.mjs'), `
import { label } from './widget.mjs'
import { suffix } from './custom-helper.js'
import { decorate } from './effects.mjs'
export const describe = () => decorate(label() + suffix)
`)
      await writeFile(join(folder, 'effects.mjs'), 'export const decorate = text => text\n')
      await writeFile(join(folder, 'custom-helper.js'), 'export const suffix = ":source"\n')
    }
    await mkdir(join(directory, 'site'))
    await writeFile(join(directory, 'site/entry.mjs'), `
export { main as first } from 'gleam:first/widget'
export { main as second } from 'gleam:nested/second/widget'
`)
    let watcherReady
    const config = () => ({
      root: join(directory, 'site'),
      cacheDir: join(directory, '.vite'),
      configFile: false,
      logLevel: 'silent',
      plugins: [gleamProject(directory), {
        name: 'fixture-watcher-ready',
        configureServer(server) {
          watcherReady = new Promise(resolve => server.watcher.once('ready', resolve))
        },
      }],
    })
    server = await createServer({ ...config(), server: { middlewareMode: true, fs: { allow: [directory] }, watch: { usePolling: true, interval: 50 } } })
    await watcherReady
    const dev = await server.ssrLoadModule('/entry.mjs')
    assert.equal(dev.first(), 'first:source')
    assert.equal(dev.second(), 'nested/second:source')

    // Real source files, rather than the compiler's copied JS, must be watched.
    const helper = join(directory, 'src/nested/second/custom-helper.js')
    const changed = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Source edit was not watched')), 5000)
      server.watcher.on('change', file => {
        if (file === helper) { clearTimeout(timeout); resolve() }
      })
    })
    await writeFile(helper, 'export const suffix = ":edited"\n')
    await changed
    // Wait until Vite has processed the event and invalidated its module graph.
    await new Promise(resolve => setTimeout(resolve, 100))
    const edited = await server.ssrLoadModule('/entry.mjs')
    assert.equal(edited.second(), 'nested/second:edited')
    assert.equal(edited.first(), 'first:source')
    for (const [filename, source, expected] of [
      ['view.mjs', `import { decorate } from './effects.mjs'; export const describe = () => decorate('new view')`, 'new view'],
      ['effects.mjs', 'export const decorate = text => text + ":effect edited"', 'new view:effect edited'],
    ]) {
      const file = join(directory, 'src/nested/second', filename)
      const change = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${filename} edit was not watched`)), 5000)
        const handleChange = changed => {
          if (changed === file) {
            server.watcher.off('change', handleChange)
            clearTimeout(timeout)
            resolve()
          }
        }
        server.watcher.on('change', handleChange)
      })
      await writeFile(file, source)
      await change
      await new Promise(resolve => setTimeout(resolve, 100))
      const refreshed = await server.ssrLoadModule('/entry.mjs')
      assert.equal(refreshed.second(), expected)
      assert.equal(refreshed.first(), 'first:source')
    }
    await server.close()
    server = undefined

    await build({ ...config(), build: {
      outDir: join(directory, 'dist'),
      emptyOutDir: true,
      lib: { entry: join(directory, 'site/entry.mjs'), formats: ['es'], fileName: () => 'apps.mjs' },
      minify: false,
    } })
    const production = await import(pathToFileURL(join(directory, 'dist/apps.mjs')).href)
    assert.equal(production.first(), 'first:source')
    assert.equal(production.second(), 'new view:effect edited')
  } finally {
    if (server) await server.close()
    await rm(directory, { recursive: true, force: true })
  }
})
