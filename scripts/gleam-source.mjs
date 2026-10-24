import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

// Bridge only this project's source and generated files. Dependencies keep
// their normal resolution, and the Gleam loader handles compilation and HMR.
export function gleamSource() {
  let sourceRoot
  let generatedRoot

  const within = (root, file) => {
    const path = relative(root, file)
    return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
  }

  return {
    name: 'glimlit-gleam-source',
    enforce: 'pre',
    configResolved(config) {
      const manifest = readFileSync(resolve(config.root, 'gleam.toml'), 'utf8')
      const name = manifest.match(/^[ \t]*name[ \t]*=[ \t]*["']([a-z][a-z0-9_]*)["']/m)?.[1]
      if (!name) throw new Error('Could not read the package name from gleam.toml')
      sourceRoot = resolve(config.root, 'src')
      generatedRoot = resolve(config.root, 'build/dev/javascript', name)
    },
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return
      const [, path, suffix] = source.match(/^([^?#]*)(.*)$/)
      if (!path.endsWith('.mjs') && !path.endsWith('.js')) return
      const target = resolve(dirname(importer.split(/[?#]/)[0]), path)

      if (within(generatedRoot, target)) {
        const original = resolve(sourceRoot, relative(generatedRoot, target))
        // Generated Gleam modules must stay generated. Only redirect copied JS.
        const compiledGleam = path.endsWith('.mjs') && existsSync(original.slice(0, -4) + '.gleam')
        if (!compiledGleam && existsSync(original)) {
          return original + suffix
        }
      } else if (within(sourceRoot, target)) {
        // Real JS wins. A missing sibling .mjs can refer to a Gleam module.
        if (path.endsWith('.mjs') && !existsSync(target) && existsSync(target.slice(0, -4) + '.gleam')) {
          return resolve(generatedRoot, relative(sourceRoot, target)) + suffix
        }
      }
    },
  }
}
