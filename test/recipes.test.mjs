import test from 'node:test'
import assert from 'node:assert/strict'
import { from_list as toArray } from '#gleam/array'
import * as app from '../build/dev/javascript/glimlit/recipes/recipes.mjs'
import * as route from '../build/dev/javascript/glimlit/recipes/route.mjs'
import * as editor from '../build/dev/javascript/glimlit/recipes/editor.mjs'
import * as recipeJson from '../build/dev/javascript/glimlit/recipes/recipe_json.mjs'
import * as recipe from '../build/dev/javascript/glimlit/recipes/recipe.mjs'
import { run } from '../src/runtime/runner.mjs'
import { load, save, fetchSamples, storageKey } from '../build/dev/javascript/glimlit/recipes/effects.mjs'
import { hashRoute } from '../build/dev/javascript/glimlit/recipes/subscriptions.mjs'

const ready = () => app.update(app.init()[0], new app.StorageEmpty())[0]
const update = (model, message) => app.update(model, message)[0]
const samples = () => recipeJson.encode_collection(recipe.starters())

test('recipe routes round-trip, support deep links, and reject unknown addresses', () => {
  for (const [hash, type, id] of [['#/',route.Collection],['#/new',route.New],['#/recipe/2',route.Detail,2],['#/recipe/2/edit',route.Edit,2]]) {
    const parsed = route.parse(hash)
    assert.ok(parsed instanceof type)
    assert.equal(route.path(parsed), hash)
    if (id) assert.equal(parsed[0], id)
  }
  for (const hash of ['#/unknown', '#/recipe/0', '#/recipe/-1', '#/recipe/nope', '#/recipe/1/extra']) assert.ok(route.parse(hash) instanceof route.NotFound)
})

test('recipe JSON validates versions, fields, unique IDs, and empty collections', () => {
  const source = samples()
  assert.deepEqual(toArray(recipeJson.decode_collection(source)[0]), toArray(recipe.starters()))
  assert.deepEqual(toArray(recipeJson.decode_collection('{"version":1,"recipes":[]}')[0]), [])
  const data = JSON.parse(source)
  for (const invalid of [null, {...data, version:2}, {...data, recipes:[data.recipes[0],data.recipes[0]]}, {...data, recipes:[{...data.recipes[0],minutes:0}]}, {...data, recipes:[{...data.recipes[0],title:'  '}]}, {...data, recipes:[{...data.recipes[0],favorite:'yes'}]}]) {
    assert.equal(recipeJson.decode_collection(JSON.stringify(invalid)).constructor.name, 'Error')
  }
})

test('child editor validation blocks submission and parent commits trimmed recipes', () => {
  let model = update(ready(), new app.RouteChanged('#/new'))
  const original = model
  const [invalid, effects] = app.update(model, new app.RecipeSubmitted())
  assert.equal(toArray(invalid.editor.errors).length,3)
  assert.equal(toArray(effects).length,1)
  assert.equal(toArray(original.editor.errors).length,0)
  model = invalid
  for (const message of [new editor.TitleChanged('  My soup  '), new editor.IngredientsChanged('  Carrots\nStock  '), new editor.InstructionsChanged('  Simmer.  '), new editor.MinutesChanged('25')]) model = update(model,new app.EditorChanged(message))
  const [saved, work] = app.update(model,new app.RecipeSubmitted())
  assert.ok(saved.route instanceof route.Detail)
  assert.equal(toArray(saved.recipes).length,4)
  assert.equal(toArray(saved.recipes).at(-1).title,'My soup')
  assert.equal(toArray(saved.recipes).at(-1).minutes,25)
  assert.ok(saved.saving instanceof app.Saving)
  assert.equal(toArray(work).length,2)
  assert.equal(toArray(recipe.starters()).length,3)
})

test('editing preserves IDs and favourites; filters and deletions share the parent collection', () => {
  let model = update(ready(),new app.RouteChanged('#/recipe/1/edit'))
  assert.equal(model.editor.title,toArray(model.recipes)[0].title)
  model = update(model,new app.EditorChanged(new editor.TitleChanged('Changed title')))
  model = update(model,new app.RecipeSubmitted())
  assert.equal(toArray(model.recipes)[0].id,1)
  assert.equal(toArray(model.recipes)[0].favorite,true)
  model=update(model,new app.QueryChanged(' TOMATO '))
  assert.equal(toArray(app.visible_recipes(model)).length,1)
  model=update(model,new app.FavoritesToggled())
  assert.equal(toArray(app.visible_recipes(model)).length,0)
  // The view sends a confirmed decision; a nonexistent recipe remains a no-op.
  assert.equal(update(model, new app.DeleteConfirmed(999)), model)
  model=update(model,new app.DeleteConfirmed(1))
  assert.equal(toArray(model.recipes).length,2)
  assert.ok(model.route instanceof route.Collection)
})

test('unreadable storage is not overwritten automatically and missing recipes cannot be edited', () => {
  const [initial] = app.init()
  const [broken,effects] = app.update(initial,new app.StorageReturned('broken JSON'))
  assert.ok(broken.storage instanceof app.LoadFailed)
  assert.deepEqual(toArray(effects),[])
  assert.equal(update(initial,new app.FavoriteToggled(1)),initial)
  const absent=update(ready(),new app.RouteChanged('#/recipe/999/edit'))
  const [same,work]=app.update(absent,new app.RecipeSubmitted())
  assert.equal(same,absent)
  assert.deepEqual(toArray(work),[])
})

test('late save messages and superseded or cancelled imports cannot change current state', () => {
  let model=update(ready(),new app.FavoriteToggled(1))
  const firstRevision=model.revision
  model=update(model,new app.FavoriteToggled(2))
  assert.equal(update(model,new app.CollectionSaveFailed(firstRevision,'old failure')),model)
  assert.equal(update(model,new app.CollectionSaved(firstRevision)),model)
  model=update(model,new app.CollectionSaveFailed(model.revision,'storage full'))
  assert.ok(model.saving instanceof app.SaveFailed)
  model=update(model,new app.RetrySave())
  assert.ok(model.saving instanceof app.Saving)
  model=update(model,new app.ImportRequested())
  const first=model.request
  model=update(model,new app.ImportRequested())
  assert.equal(update(model,new app.SamplesReturned(first,samples())),model)
  const cancelled=model.request
  model=update(model,new app.ImportCancelled())
  assert.equal(update(model,new app.SamplesReturned(cancelled,samples())),model)
  assert.equal(update(model,new app.SamplesFailed(cancelled,'old failure')),model)
  model=update(model,new app.ImportRequested())
  model=update(model,new app.SamplesReturned(model.request,samples()))
  assert.equal(toArray(model.recipes).length,3)
  assert.equal(toArray(model.recipes)[0].favorite,false)
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
  assert.ok(messages.at(-1) instanceof app.CollectionSaved)
  await run(load(),msg=>messages.push(msg))
  assert.equal(messages.at(-1)[0],'saved')
  globalThis.localStorage={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('denied')}}
  await run(save('new',8),msg=>messages.push(msg))
  assert.ok(messages.at(-1) instanceof app.CollectionSaveFailed)
  globalThis.fetch=async()=>({ok:false,status:503})
  await run(fetchSamples(2),msg=>messages.push(msg))
  assert.ok(messages.at(-1) instanceof app.SamplesFailed)
  globalThis.fetch=async()=>({ok:true,text:async()=>samples()})
  await run(fetchSamples(3),msg=>messages.push(msg))
  assert.ok(messages.at(-1) instanceof app.SamplesReturned)
  assert.equal(messages.at(-1)[0],3)
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
  const original = JSON.parse(recipeJson.encode_collection(model.recipes))
  const incoming = {
    version: 1,
    recipes: [
      { ...original.recipes[0], favorite: false },
      { ...original.recipes[1], id: 10, title: 'New soup' },
      { ...original.recipes[2], id: 11, title: 'New soup' },
      { ...original.recipes[2], id: 12, title: 'New stew' },
    ],
  }
  model = update(model, new app.ImportRequested())
  const before = model
  model = update(model, new app.SamplesReturned(model.request, JSON.stringify(incoming)))
  const recipes = toArray(model.recipes)
  assert.equal(recipes.length, 5)
  assert.deepEqual(recipes.slice(0, 3), toArray(before.recipes))
  assert.equal(recipes[0].favorite, true)
  assert.deepEqual(recipes.slice(3).map(r => [r.id, r.title]), [[4, 'New soup'], [5, 'New stew']])
  assert.equal(toArray(before.recipes).length, 3)
  assert.ok(model.saving instanceof app.Saving)
})


test('editor time validation rejects invalid input and accepts both duration boundaries', () => {
  let draft = editor.init()
  for (const message of [new editor.TitleChanged('Soup'), new editor.IngredientsChanged('Stock'), new editor.InstructionsChanged('Simmer')]) draft = editor.update(draft, message)
  for (const value of ['', 'nope', '1.5', '-1', '0', '1441']) {
    const invalid = editor.update(draft, new editor.MinutesChanged(value))
    const result = editor.validate(invalid, 1, false)
    assert.equal(result.constructor.name, 'Error', value)
    assert.equal(toArray(result[0]).length, 1)
  }
  for (const value of ['1', '1440']) {
    const valid = editor.update(draft, new editor.MinutesChanged(value))
    const result = editor.validate(valid, 1, false)
    assert.equal(result.constructor.name, 'Ok', value)
    assert.equal(result[0].minutes, Number(value))
  }
})
