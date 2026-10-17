/**
 * Crafting recipe invariants, with the steel and mithril tiers as the worked
 * example.
 *
 * The recipe file is the one source the sheet, the server handler, the World
 * Tool and the validator all read, so the rules that keep a tier honest are
 * checked here as data: which quest opens it, which hammer works it, where it
 * is forged, and what it costs relative to the iron tier it copies. No
 * database; the handler's own re-checks are exercised through the same helpers
 * it calls.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const recipes = require(path.join(ROOT, 'src/lib/game-data/crafting-recipes.js'))
const {
  CRAFTING_RECIPES,
  CRAFTING_FAMILIES,
  CRAFTING_ROOMS,
  getRecipeById,
  getRecipesForRoom,
  isRecipeAvailableInRoom,
  whereToCraft,
  getRecipesUsing,
  describeCraft,
} = recipes

const byFamily = (family) => CRAFTING_RECIPES.filter((r) => r.family === family)
const steel = byFamily('steel')
const mithril = byFamily('mithril')
const tools = byFamily('tools')

test('recipe ids are unique and every family a recipe names exists', () => {
  const ids = new Set()
  const families = new Set(CRAFTING_FAMILIES.map((f) => f.id))
  for (const recipe of CRAFTING_RECIPES) {
    assert.ok(!ids.has(recipe.id), `duplicate recipe id ${recipe.id}`)
    ids.add(recipe.id)
    assert.ok(families.has(recipe.family), `${recipe.id} names unknown family ${recipe.family}`)
  }
})

test('the sheet lists the families in the original craft screen order, with the two new tiers after iron', () => {
  assert.deepEqual(
    CRAFTING_FAMILIES.map((f) => f.id),
    ['cook', 'potions', 'wood', 'leather', 'iron', 'steel', 'mithril', 'tools', 'rings']
  )
})

test('steel opens with the smelt and the Cyclops quest, mithril with the Minotaur quest, both turned in', () => {
  const smelt = getRecipeById('smelt-steel')
  assert.ok(smelt, 'smelt-steel exists')
  assert.equal(smelt.family, 'steel')
  assert.equal(smelt.batch, 'all', 'a stack of ore smelts in one tap')
  assert.deepEqual(
    smelt.inputs.map((i) => [i.slug, i.qty]),
    [['iron', 1], ['coal', 1]]
  )
  assert.deepEqual([smelt.output.slug, smelt.output.qty], ['steel', 1])
  assert.equal(smelt.tool, undefined, 'the forge does the smelting, no hammer asked for')

  for (const recipe of steel) {
    assert.equal(recipe.unlock?.questId, 'quest_miningguild_002', `${recipe.id} unlock`)
    assert.equal(recipe.unlock?.requireCompleted, true, `${recipe.id} waits for the turn-in`)
  }
  for (const recipe of mithril) {
    assert.equal(recipe.unlock?.questId, 'quest_miningguild_003', `${recipe.id} unlock`)
    assert.equal(recipe.unlock?.requireCompleted, true, `${recipe.id} waits for the turn-in`)
  }
})

test('the hammer ladder steps up one rung: mithril stands in for steel, nothing stands in for mithril', () => {
  for (const recipe of steel.filter((r) => r.id !== 'smelt-steel')) {
    assert.equal(recipe.tool?.slug, 'steel-hammer', `${recipe.id} wants the steel hammer`)
    assert.deepEqual(recipe.tool?.anyOf, ['mithril-hammer'], `${recipe.id} accepts the mithril hammer`)
  }
  for (const recipe of mithril) {
    assert.equal(recipe.tool?.slug, 'mithril-hammer', `${recipe.id} wants the mithril hammer`)
    assert.equal(recipe.tool?.anyOf, undefined, `${recipe.id} accepts nothing else`)
  }
  // The iron tier's own rule, still intact: any better hammer works iron.
  assert.deepEqual(getRecipeById('iron-sword').tool.anyOf, ['steel-hammer', 'mithril-hammer'])
})

test('every steel and mithril piece costs what its iron twin costs, in its own metal', () => {
  const unitsOf = (recipe, metal) => recipe.inputs.find((i) => i.slug === metal)?.qty
  const binderOf = (recipe, metal) => recipe.inputs.filter((i) => i.slug !== metal).map((i) => [i.slug, i.qty])

  for (const metal of ['steel', 'mithril']) {
    const gear = byFamily(metal).filter((r) => r.id !== 'smelt-steel')
    assert.equal(gear.length, 19, `${metal} tier has the iron tier's 19 pieces minus the maul`)
    for (const recipe of gear) {
      const ironId = recipe.id.replace(`${metal}-`, 'iron-')
      const iron = getRecipeById(ironId)
      assert.ok(iron, `${recipe.id} has an iron twin ${ironId}`)
      assert.equal(unitsOf(recipe, metal), unitsOf(iron, 'iron'), `${recipe.id} unit count`)
      assert.deepEqual(binderOf(recipe, metal), binderOf(iron, 'iron'), `${recipe.id} binder`)
      assert.equal(recipe.output.slug, recipe.id, `${recipe.id} makes itself`)
      assert.equal(recipe.batch, 'one', `${recipe.id} crafts one at a time`)
    }
    assert.equal(getRecipeById(`${metal}-maul`), null, `no ${metal} maul: neither game has the template`)
  }
})

test('the two tiers and their tools are forged at the Mining Guild and nowhere else', () => {
  const forgeOnly = [...steel, ...mithril, ...tools.filter((r) => /^(steel|mithril)-/.test(r.id))]
  assert.ok(forgeOnly.length >= 43, 'steel + mithril gear, the smelt, and four tools')
  for (const recipe of forgeOnly) {
    assert.equal(recipe.station, 'forge', `${recipe.id} needs a forge`)
    const rooms = CRAFTING_ROOMS.filter((roomId) => isRecipeAvailableInRoom(recipe, roomId))
    assert.deepEqual(rooms, ['308'], `${recipe.id} is made at 308 only`)
    assert.equal(whereToCraft(recipe), 'Forged at the Mining Guild forge.')
  }
  // The Grand Square works most families but has no forge, so the server
  // refuses a steel craft sent from there with the same pointer the sheet shows.
  assert.equal(isRecipeAvailableInRoom(getRecipeById('steel-sword'), '210'), false)
  assert.ok(getRecipesForRoom('308').some((r) => r.id === 'mithril-2h-sword'))
})

test('the tiered picks and hammers mirror the iron tools, and a hammer never needs itself', () => {
  for (const [metal, hammer] of [['steel', 'steel-hammer'], ['mithril', 'mithril-hammer']]) {
    const pick = getRecipeById(`${metal}-pickaxe`)
    const ham = getRecipeById(hammer)
    assert.ok(pick && ham, `${metal} pick and hammer recipes exist`)
    for (const recipe of [pick, ham]) {
      assert.equal(recipe.family, 'tools')
      assert.deepEqual(
        recipe.inputs.map((i) => [i.slug, i.qty]),
        [[metal, 3], ['wood', 1]],
        `${recipe.id} costs 3 ${metal} + 1 wood like the iron tools`
      )
    }
    assert.equal(pick.tool.slug, hammer, `${metal} pick is hammered`)
    assert.equal(ham.tool, undefined, `${hammer} asks for no hammer, so a lost one is replaceable`)
  }
})

test('the bag can say what coal, steel and mithril make', () => {
  const uses = (slug) => getRecipesUsing(slug).map((r) => r.id)
  assert.deepEqual(uses('coal'), ['smelt-steel'], 'coal is only ever smelted')
  assert.ok(uses('steel').includes('steel-sword') && uses('steel').includes('steel-pickaxe'))
  assert.ok(uses('mithril').includes('mithril-armor') && uses('mithril').includes('mithril-hammer'))
  assert.ok(uses('mithril-hammer').includes('steel-sword'), 'the mithril hammer is listed as working steel')
  assert.ok(!uses('coal').includes('mithril-sword'), 'mithril is worked raw, coal is not its fuel')
})

test('the feed line counts steel and mithril as mass nouns', () => {
  const smelt = getRecipeById('smelt-steel')
  assert.equal(
    describeCraft(smelt, 'Steel', 10, 10, [{ name: 'Iron', qty: 1 }, { name: 'Coal', qty: 1 }]),
    'You craft 10 Steel from 10 Iron and 10 Coal.'
  )
  const sword = getRecipeById('mithril-sword')
  assert.equal(
    describeCraft(sword, 'Mithril Sword', 1, 1, [{ name: 'Mithril', qty: 7 }, { name: 'Wood', qty: 1 }]),
    'You craft 1 Mithril Sword from 7 Mithril and 1 Wood.'
  )
})
