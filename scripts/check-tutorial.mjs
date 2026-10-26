import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const workspace = await mkdtemp(join(tmpdir(), 'glimlit-tutorial-'))
try {
  for (const filename of ['gleam.toml', 'manifest.toml', 'package.json']) {
    await cp(join(root, filename), join(workspace, filename))
  }
  await mkdir(join(workspace, 'src'), { recursive: true })
  await mkdir(join(workspace, 'build'), { recursive: true })
  await cp(join(root, 'src/runtime'), join(workspace, 'src/runtime'), { recursive: true })
  await symlink(join(root, 'build/packages'), join(workspace, 'build/packages'), 'dir')
  await symlink(join(root, 'node_modules'), join(workspace, 'node_modules'), 'dir')
  const checkpoints = (await readdir(join(root, 'docs/tutorial'))).filter(name => /^\d\d-/.test(name)).sort()
  assert.equal(checkpoints.length, 6)
  for (const [index, checkpoint] of checkpoints.entries()) {
    await rm(join(workspace, 'src/tutorial'), { recursive: true, force: true })
    await rm(join(workspace, 'build/dev'), { recursive: true, force: true })
    await cp(join(root, 'docs/tutorial', checkpoint), join(workspace, 'src/tutorial'), { recursive: true })
    execFileSync('gleam', ['build'], { cwd: workspace, stdio: 'pipe' })
    // A separate process also verifies every compiled view's JavaScript imports.
    const entry = pathToFileURL(join(workspace, 'build/dev/javascript/glimlit/tutorial/tutorial.mjs')).href
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { from_list as toArray } from ${JSON.stringify(pathToFileURL(join(workspace, 'build/dev/javascript/gleam_javascript/gleam/javascript/array.mjs')).href)};
      const app = await import(${JSON.stringify(entry)});
      let [model, effects] = app.init();
      assert.equal(typeof model.title, 'string');
      assert.deepEqual(toArray(effects), []);
      if (${index} >= 1) {
        [model, effects] = app.update(model, app.Msg$UserChangedTitle('My postcard'));
        assert.equal(model.title, 'My postcard');
        assert.deepEqual(toArray(effects), []);
      }
      if (${index} >= 2) {
        [model, effects] = app.update(model, app.Msg$UserSelectedTheme(app.Theme$Ocean()));
        assert.equal(app.theme_name(model.theme), 'ocean');
        assert.deepEqual(toArray(effects), []);
      }
      if (${index} >= 3) {
        [, effects] = app.update(model, app.Msg$UserClickedSave());
        assert.equal(toArray(effects).length, 1);
        assert.equal(typeof toArray(effects)[0].perform, 'function');
      }
    `], { cwd: workspace, stdio: 'pipe' })
    console.log(`✓ ${checkpoint}: compiles, links, and behaves as described`)
  }
} finally {
  await rm(workspace, { recursive: true, force: true })
}
