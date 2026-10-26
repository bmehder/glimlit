import test from 'node:test'
import assert from 'node:assert/strict'
import { from_list as toArray } from '#gleam/array'
import * as app from '../build/dev/javascript/glimlit/recipes/recipes.mjs'
import { run } from '../src/runtime/runner.mjs'
import { load, save, fetchSamples, storageKey } from '../build/dev/javascript/glimlit/recipes/effects.mjs'
import { hashRoute } from '../build/dev/javascript/glimlit/recipes/subscriptions.mjs'

const ready = () => app.update(app.init()[0], app.Msg$LocalStorageHadNoRecipes())[0]
const update = (model, message) => app.update(model, message)[0]
const samples = () => app.encode_collection(app.starter_recipes())

test('recipe routes round-trip, support deep links, and reject unknown addresses', () => {
  for (const [hash, matchesRoute, id] of [['#/',app.Route$isCollection],['#/new',app.Route$isNew],['#/recipe/2',app.Route$isDetail,2],['#/recipe/2/edit',app.Route$isEdit,2]]) {
    const parsed = app.parse_route(hash)
    assert.ok(matchesRoute(parsed))
    assert.equal(app.route_path(parsed), hash)
    if (id) {
      const recipeId = app.Route$isDetail(parsed)
        ? app.Route$Detail$id(parsed)
        : app.Route$Edit$id(parsed)
      assert.equal(recipeId, id)
    }
  }
  for (const hash of ['#/unknown', '#/recipe/0', '#/recipe/-1', '#/recipe/nope', '#/recipe/1/extra']) assert.ok(app.Route$isNotFound(app.parse_route(hash)))
})

test('recipe JSON validates versions, fields, unique IDs, and empty collections', () => {
  const source = samples()
  assert.deepEqual(toArray(app.decode_collection(source)[0]), toArray(app.starter_recipes()))
  assert.deepEqual(toArray(app.decode_collection('{"version":1,"recipes":[]}')[0]), [])
  const data = JSON.parse(source)
  for (const invalid of [null, {...data, version:2}, {...data, recipes:[data.recipes[0],data.recipes[0]]}, {...data, recipes:[{...data.recipes[0],minutes:0}]}, {...data, recipes:[{...data.recipes[0],title:'  '}]}, {...data, recipes:[{...data.recipes[0],favorite:'yes'}]}]) {
    assert.equal(app.decode_collection(JSON.stringify(invalid)).constructor.name, 'Error')
  }
})

test('editor validation blocks submission and update commits trimmed recipes', () => {
  let model = update(ready(), app.Msg$BrowserHashChanged('#/new'))
  const original = model
  const [invalid, effects] = app.update(model, app.Msg$UserSubmittedRecipe())
  assert.equal(toArray(invalid.editor.errors).length,3)
  assert.equal(toArray(effects).length,1)
  assert.equal(toArray(original.editor.errors).length,0)
  model = invalid
  for (const message of [app.Msg$UserChangedTitle('  My soup  '), app.Msg$UserChangedIngredients('  Carrots\nStock  '), app.Msg$UserChangedInstructions('  Simmer.  '), app.Msg$UserChangedMinutes('25')]) model = update(model,message)
  assert.equal(toArray(model.editor.errors).length, 0)
  assert.equal(toArray(invalid.editor.errors).length, 3)
  const [saved, work] = app.update(model,app.Msg$UserSubmittedRecipe())
  assert.ok(app.Route$isDetail(saved.route))
  assert.equal(toArray(saved.recipes).length,4)
  assert.equal(toArray(saved.recipes).at(-1).title,'My soup')
  assert.equal(toArray(saved.recipes).at(-1).minutes,25)
  assert.ok(app.SaveStatus$isSaving(saved.save_status))
  assert.equal(toArray(work).length,2)
  assert.equal(toArray(app.starter_recipes()).length,3)
})

test('editing preserves IDs and favourites; filters and deletions share the parent collection', () => {
  let model = update(ready(),app.Msg$BrowserHashChanged('#/recipe/1/edit'))
  assert.equal(model.editor.title,toArray(model.recipes)[0].title)
  model = update(model,app.Msg$UserChangedTitle('Changed title'))
  model = update(model,app.Msg$UserSubmittedRecipe())
  assert.equal(toArray(model.recipes)[0].id,1)
  assert.equal(toArray(model.recipes)[0].favorite, true)
  model=update(model,app.Msg$UserChangedQuery(' TOMATO '))
  assert.equal(toArray(app.visible_recipes(model)).length,1)
  model=update(model,app.Msg$UserToggledFavorites())
  assert.equal(toArray(app.visible_recipes(model)).length,0)
  // The view sends a confirmed decision; a nonexistent recipe remains a no-op.
  assert.equal(update(model, app.Msg$UserConfirmedDelete(999)), model)
  model=update(model,app.Msg$UserConfirmedDelete(1))
  assert.equal(toArray(model.recipes).length,2)
  assert.ok(app.Route$isCollection(model.route))
})

test('unreadable storage is not overwritten automatically and missing recipes cannot be edited', () => {
  const [initial] = app.init()
  const [broken,effects] = app.update(initial,app.Msg$LocalStorageReturnedRecipes('broken JSON'))
  assert.ok(app.Storage$isLoadFailed(broken.storage))
  assert.deepEqual(toArray(effects),[])
  assert.equal(update(initial,app.Msg$UserToggledFavorite(1)),initial)
  const absent=update(ready(),app.Msg$BrowserHashChanged('#/recipe/999/edit'))
  const [same,work]=app.update(absent,app.Msg$UserSubmittedRecipe())
  assert.equal(same,absent)
  assert.deepEqual(toArray(work),[])
})

test('late save messages and superseded or cancelled imports cannot change current state', () => {
  let model=update(ready(),app.Msg$UserToggledFavorite(1))
  const firstSaveId=model.save_id
  model=update(model,app.Msg$UserToggledFavorite(2))
  assert.equal(update(model,app.Msg$LocalStorageSaveFailed(firstSaveId,'old failure')),model)
  assert.equal(update(model,app.Msg$LocalStorageSavedRecipes(firstSaveId)),model)
  model=update(model,app.Msg$LocalStorageSaveFailed(model.save_id,'storage full'))
  assert.ok(app.SaveStatus$isSaveFailed(model.save_status))
  model=update(model,app.Msg$UserClickedRetrySave())
  assert.ok(app.SaveStatus$isSaving(model.save_status))
  model=update(model,app.Msg$UserClickedImportSamples())
  const first=model.import_request_id
  model=update(model,app.Msg$UserClickedImportSamples())
  assert.equal(update(model,app.Msg$HttpReturnedSamples(first,samples())),model)
  const cancelled=model.import_request_id
  model=update(model,app.Msg$UserCancelledImport())
  assert.equal(update(model,app.Msg$HttpReturnedSamples(cancelled,samples())),model)
  assert.equal(update(model,app.Msg$HttpSamplesRequestFailed(cancelled,'old failure')),model)
  model=update(model,app.Msg$UserClickedImportSamples())
  model=update(model,app.Msg$HttpReturnedSamples(model.import_request_id,samples()))
  assert.equal(toArray(model.recipes).length,3)
  assert.equal(toArray(model.recipes)[0].favorite, false)
})

test('storage and HTTP effects are deferred and report expected failures as messages', async t => {
  const oldStorage=globalThis.localStorage, oldFetch=globalThis.fetch
  t.after(()=>{if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;globalThis.fetch=oldFetch})
  const values=new Map(), messages=[]
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
  const work=save('saved',7)
  assert.equal(values.size,0)
  await run(work,msg=>messages.push(msg))
  assert.equal(values.get(storageKey),'saved')
  assert.ok(app.Msg$isLocalStorageSavedRecipes(messages.at(-1)))
  await run(load(),msg=>messages.push(msg))
  assert.equal(app.Msg$LocalStorageReturnedRecipes$json(messages.at(-1)), 'saved')
  globalThis.localStorage={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('denied')}}
  await run(save('new',8),msg=>messages.push(msg))
  assert.ok(app.Msg$isLocalStorageSaveFailed(messages.at(-1)))
  globalThis.fetch=async()=>({ok:false,status:503})
  await run(fetchSamples(2),msg=>messages.push(msg))
  assert.ok(app.Msg$isHttpSamplesRequestFailed(messages.at(-1)))
  globalThis.fetch=async()=>({ok:true,text:async()=>samples()})
  await run(fetchSamples(3),msg=>messages.push(msg))
  assert.ok(app.Msg$isHttpReturnedSamples(messages.at(-1)))
  assert.equal(app.Msg$HttpReturnedSamples$request(messages.at(-1)), 3)
})

test('route subscription emits initial and later hashes and removes its listener', t => {
  const oldWindow=globalThis.window
  t.after(()=>{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow})
  const listeners=new Map(), emitted=[]
  globalThis.window={location:{hash:'#/recipe/2'},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type)=>listeners.delete(type)}
  const cleanup=hashRoute(hash=>hash).start(hash=>emitted.push(hash))
  assert.deepEqual(emitted,['#/recipe/2'])
  window.location.hash='#/new';listeners.get('hashchange')()
  assert.deepEqual(emitted,['#/recipe/2','#/new'])
  cleanup();assert.equal(listeners.size,0)
})


test('sample imports keep local recipes, assign noncolliding IDs, and skip duplicate titles in order', () => {
  let model = ready()
  const original = JSON.parse(app.encode_collection(model.recipes))
  const incoming = {
    version: 1,
    recipes: [
      { ...original.recipes[0], favorite: false },
      { ...original.recipes[1], id: 10, title: 'New soup' },
      { ...original.recipes[2], id: 11, title: 'New soup' },
      { ...original.recipes[2], id: 12, title: 'New stew' },
    ],
  }
  model = update(model, app.Msg$UserClickedImportSamples())
  const before = model
  model = update(model, app.Msg$HttpReturnedSamples(model.import_request_id, JSON.stringify(incoming)))
  const recipes = toArray(model.recipes)
  assert.equal(recipes.length, 5)
  assert.deepEqual(recipes.slice(0, 3), toArray(before.recipes))
  assert.equal(recipes[0].favorite, true)
  assert.deepEqual(recipes.slice(3).map(r => [r.id, r.title]), [[4, 'New soup'], [5, 'New stew']])
  assert.equal(toArray(before.recipes).length, 3)
  assert.ok(app.SaveStatus$isSaving(model.save_status))
})


test('editor time validation rejects invalid input and accepts both duration boundaries', () => {
  let draft = ready()
  for (const message of [app.Msg$UserChangedTitle('Soup'), app.Msg$UserChangedIngredients('Stock'), app.Msg$UserChangedInstructions('Simmer')]) draft = update(draft, message)
  for (const value of ['', 'nope', '1.5', '-1', '0', '1441']) {
    const invalid = update(draft, app.Msg$UserChangedMinutes(value))
    const result = app.validate_editor(invalid.editor, 1, false)
    assert.equal(result.constructor.name, 'Error', value)
    assert.equal(toArray(result[0]).length, 1)
  }
  for (const value of ['1', '1440']) {
    const valid = update(draft, app.Msg$UserChangedMinutes(value))
    const result = app.validate_editor(valid.editor, 1, false)
    assert.equal(result.constructor.name, 'Ok', value)
    assert.equal(result[0].minutes, Number(value))
  }
})

test('screen selection resolves loading, recovery, routes, and missing recipes in Gleam', () => {
  const initial = app.init()[0]
  const deepLink = update(initial, app.Msg$BrowserHashChanged('#/recipe/1'))
  assert.ok(app.Screen$isScreenLoading(app.screen(deepLink)))
  assert.equal(app.can_import(deepLink), false)
  const failed = update(deepLink, app.Msg$LocalStorageLoadFailed('Storage unavailable'))
  assert.equal(app.Screen$ScreenRecovery$0(app.screen(failed)), 'Storage unavailable')
  assert.equal(app.can_import(failed), false)

  const model = update(deepLink, app.Msg$LocalStorageHadNoRecipes())
  assert.ok(app.Screen$isScreenDetail(app.screen(model)))
  assert.equal(app.Recipe$Recipe$id(app.Screen$ScreenDetail$0(app.screen(model))), 1)
  assert.equal(app.can_import(model), true)
  assert.ok(app.Screen$isScreenCollection(app.screen(ready())))
  const creating = update(model, app.Msg$BrowserHashChanged('#/new'))
  assert.deepEqual(app.Screen$ScreenNew$0(app.screen(creating)), creating.editor)
  const editing = update(model, app.Msg$BrowserHashChanged('#/recipe/1/edit'))
  assert.deepEqual(app.Screen$ScreenEdit$0(app.screen(editing)), editing.editor)
  assert.equal(app.Screen$ScreenEdit$1(app.screen(editing)), '#/recipe/1')
  for (const hash of ['#/recipe/999', '#/recipe/999/edit', '#/unknown']) {
    assert.ok(app.Screen$isScreenNotFound(app.screen(update(model, app.Msg$BrowserHashChanged(hash)))))
  }
  const removed = update(model, app.Msg$UserConfirmedDelete(1))
  const staleLink = update(removed, app.Msg$BrowserHashChanged('#/recipe/1'))
  assert.ok(app.Screen$isScreenNotFound(app.screen(staleLink)))
})

test('save presentation exposes the current message and retry availability', () => {
  const model = ready()
  assert.equal(app.can_retry_save(model), false)
  assert.equal(app.saving_message(model), 'Kept in this browser · No account needed')
  const saving = update(model, app.Msg$UserToggledFavorite(1))
  assert.equal(app.saving_message(saving), 'Saving in this browser…')
  assert.equal(app.can_retry_save(saving), false)
  const failed = update(saving, app.Msg$LocalStorageSaveFailed(saving.save_id, 'Storage full'))
  assert.equal(app.saving_message(failed), 'Storage full')
  assert.equal(app.can_retry_save(failed), true)
  const saved = update(failed, app.Msg$LocalStorageSavedRecipes(failed.save_id))
  assert.equal(app.can_retry_save(saved), false)
})

test('loading and failed storage block application messages without blocking routing or recovery', () => {
  const initial = app.init()[0]
  const failed = update(initial, app.Msg$LocalStorageLoadFailed('Storage unavailable'))
  const messages = [
    app.Msg$UserChangedQuery('lemon'),
    app.Msg$UserToggledFavorites(),
    app.Msg$UserToggledFavorite(1),
    app.Msg$UserChangedTitle('Changed'),
    app.Msg$UserChangedDescription('Description'),
    app.Msg$UserChangedMinutes('30'),
    app.Msg$UserChangedIngredients('Ingredients'),
    app.Msg$UserChangedInstructions('Instructions'),
    app.Msg$UserSubmittedRecipe(),
    app.Msg$UserConfirmedDelete(1),
    app.Msg$UserClickedRetrySave(),
    app.Msg$LocalStorageSavedRecipes(0),
    app.Msg$LocalStorageSaveFailed(0, 'Failed'),
    app.Msg$UserClickedImportSamples(),
    app.Msg$UserCancelledImport(),
    app.Msg$HttpReturnedSamples(0, samples()),
    app.Msg$HttpSamplesRequestFailed(0, 'Failed'),
  ]
  for (const model of [initial, failed]) {
    for (const message of messages) {
      const [next, effects] = app.update(model, message)
      assert.deepEqual(next, model)
      assert.deepEqual(toArray(effects), [])
    }
    const [routed, effects] = app.update(model, app.Msg$BrowserHashChanged('#/new'))
    assert.ok(app.Route$isNew(routed.route))
    assert.deepEqual(routed.storage, model.storage)
    assert.equal(toArray(effects).length, 1)
    assert.ok(app.Storage$isReady(update(model, app.Msg$LocalStorageHadNoRecipes()).storage))
  }
  const [retry, loadEffects] = app.update(failed, app.Msg$UserClickedRetryLoad())
  assert.ok(app.Storage$isLoading(retry.storage))
  assert.equal(toArray(loadEffects).length, 1)
  const [recovered, saveEffects] = app.update(failed, app.Msg$UserClickedUseStarters())
  assert.ok(app.Storage$isReady(recovered.storage))
  assert.ok(toArray(saveEffects).length > 0)
})

test('explicit recipe states retain boolean JSON compatibility and settle imports back to idle', () => {
  let model = ready()
  assert.ok(app.RecipeFilter$isAllRecipes(model.filter))
  assert.ok(app.SampleImportState$isImportIdle(model.sample_import))
  model = update(model, app.Msg$UserToggledFavorites())
  assert.ok(app.RecipeFilter$isFavoritesOnly(model.filter))
  model = update(model, app.Msg$UserToggledFavorites())
  assert.ok(app.RecipeFilter$isAllRecipes(model.filter))

  const encoded = app.encode_collection(model.recipes)
  assert.deepEqual(JSON.parse(encoded).recipes.map(recipe => recipe.favorite), [true, false, false])
  const restored = update(app.init()[0], app.Msg$LocalStorageReturnedRecipes(encoded))
  assert.deepEqual(toArray(restored.recipes), toArray(model.recipes))

  for (const outcome of ['success', 'network failure', 'invalid JSON', 'cancel']) {
    const importing = update(model, app.Msg$UserClickedImportSamples())
    assert.ok(app.SampleImportState$isImportInProgress(importing.sample_import))
    const messages = {
      success: app.Msg$HttpReturnedSamples(importing.import_request_id, encoded),
      'network failure': app.Msg$HttpSamplesRequestFailed(importing.import_request_id, 'Offline'),
      'invalid JSON': app.Msg$HttpReturnedSamples(importing.import_request_id, 'broken JSON'),
      cancel: app.Msg$UserCancelledImport(),
    }
    const settled = update(importing, messages[outcome])
    assert.ok(app.SampleImportState$isImportIdle(settled.sample_import), outcome)
  }
})
