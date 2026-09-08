/**
 * Regen and status-effect invariants.
 *
 * The per-click trickle as the original's function-statuseffects.php summed
 * it (gear + tea + Regenerate), the buff spells as function-magic.php rolled
 * them, poison as battle.php applied it, and Iron Skin / Magic Armor where
 * they meet an enemy's swing. Pure functions, no database.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const regen = require(path.join(ROOT, 'src/lib/game-data/regen.js'))
const spells = require(path.join(ROOT, 'src/lib/game-data/spells.js'))
const specials = require(path.join(ROOT, 'src/lib/game-data/enemy-specials.js'))
const { getEnemyTraits } = require(path.join(ROOT, 'src/lib/game-data/enemy-traits.js'))
const buffs = require(path.join(ROOT, 'src/lib/game-engine/services/buff-service.js'))
const { resolveEnemyAttack } = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))
const { BattleState } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))

const maxRand = (_a, b) => b
const minRand = (a) => a

// ─── regen ───────────────────────────────────────────────────────────────────

test('gear regen sums every equipped item that declares metadata.regen', () => {
  const total = regen.sumGearRegen([
    { regen: { hp: 3 } },
    { regen: { mp: 5 }, statMods: { mag: 5 } },
    { statMods: { str: 2 } },
    null,
    { regen: 'nonsense' },
  ])
  assert.deepEqual(total, { hp: 3, mp: 5 })
})

test('tea adds +5/+5 while it runs and Regenerate adds its locked amount, flat', () => {
  const gear = { hp: 1, mp: 2 }
  const quiet = regen.regenSummary({ gear, buffs: {} })
  assert.deepEqual([quiet.hpMin, quiet.hpMax, quiet.mp], [1, 1, 2])

  const tea = regen.regenSummary({ gear, buffs: { buffTeaClicks: 1 } })
  assert.deepEqual([tea.hpMin, tea.hpMax, tea.mp], [6, 6, 7])

  const spell = regen.regenSummary({ gear, buffs: { buffTeaClicks: 1, regenerateClicks: 3, regenerateAmount: 7 } })
  assert.deepEqual([spell.hpMin, spell.hpMax, spell.mp], [13, 13, 7])
  assert.deepEqual(regen.rollRegen(spell), { hp: 13, mp: 7 })
})

test('a Regenerate amount only counts while its countdown runs', () => {
  const s = regen.regenSummary({ gear: { hp: 0, mp: 0 }, buffs: { regenerateClicks: 0, regenerateAmount: 9 } })
  assert.equal(s.any, false)
  assert.deepEqual(regen.rollRegen(s), { hp: 0, mp: 0 })
})

test('describeRegen reads as the original\'s "+N hp / click"', () => {
  assert.equal(regen.describeRegen({ hp: 3 }), '+3 HP / click')
  assert.equal(regen.describeRegen({ hp: 3, mp: 5 }), '+3 HP · +5 MP / click')
  assert.equal(regen.describeRegen({ hpMin: 2, hpMax: 4 }), '+2–4 HP / click')
  assert.equal(regen.describeRegen({}), '')
})

// ─── buff registry ───────────────────────────────────────────────────────────

test('the status countdowns tick with the rest and the amounts ride beside them', () => {
  for (const field of ['buffTeaClicks', 'regenerateClicks', 'ironSkinClicks', 'poisonClicks', 'poisonImmuneClicks']) {
    assert.ok(buffs.BUFF_FIELDS.includes(field), `${field} ticks`)
    assert.ok(buffs.BUFF_SELECT[field], `${field} selected`)
  }
  for (const field of ['regenerateAmount', 'ironSkinAmount', 'magicArmorAmount']) {
    assert.ok(!buffs.BUFF_FIELDS.includes(field), `${field} never decrements`)
    assert.ok(buffs.BUFF_SELECT[field], `${field} selected`)
  }
  const view = buffs.projectBuffState({ poisonClicks: 3, ironSkinAmount: 12, magicArmorAmount: 0, silverAura: true })
  assert.equal(view.buffs.poisonClicks, 3)
  assert.equal(view.buffs.ironSkinAmount, 12)
  assert.equal(view.buffs.magicArmorAmount, 0)
  assert.equal(view.buffs.silverAura, 1)
})

test('Iron Skin is a locked DEF bonus while its countdown runs; the other status effects are not stats', () => {
  const running = buffs.getStatBuffBonuses({ buffTeaClicks: 50, ironSkinClicks: 5, ironSkinAmount: 20, poisonClicks: 4 })
  assert.deepEqual(running, { str: 0, dex: 0, mag: 0, def: 20 })
  const ended = buffs.getStatBuffBonuses({ ironSkinClicks: 0, ironSkinAmount: 20 })
  assert.deepEqual(ended, { str: 0, dex: 0, mag: 0, def: 0 })
})

// ─── buff spells ─────────────────────────────────────────────────────────────

test('the four buff spells are castable and roll the original\'s numbers', () => {
  const ctx = { mag: 12, magCore: 5 }
  for (const id of ['regenerate', 'antidote', 'magic-armor', 'iron-skin']) {
    assert.ok(spells.isCastable(spells.getSpell(id)), `${id} castable`)
  }
  // Regenerate: rand(lvl, 2lvl) HP locked at cast, for rand(mag core, mag) clicks, 20 × lvl MP.
  const rg = spells.getSpell('regenerate')
  assert.equal(rg.castCost(3), 60)
  assert.deepEqual([spells.castBuff(rg, 3, ctx, minRand).amount, spells.castBuff(rg, 3, ctx, minRand).clicks], [3, 5])
  assert.deepEqual([spells.castBuff(rg, 3, ctx, maxRand).amount, spells.castBuff(rg, 3, ctx, maxRand).clicks], [6, 12])
  // Iron Skin: rand(2lvl, 4lvl) block for rand(mag core, mag) clicks, 10 × lvl MP.
  const is = spells.getSpell('iron-skin')
  assert.equal(is.castCost(3), 30)
  assert.deepEqual([spells.castBuff(is, 3, ctx, minRand).amount, spells.castBuff(is, 3, ctx, maxRand).amount], [6, 12])
  // Magic Armor: lvl rolls of rand(1, mag), summed.
  const ma = spells.getSpell('magic-armor')
  const cast = spells.castBuff(ma, 3, ctx, maxRand)
  assert.deepEqual(cast.rolls, [12, 12, 12])
  assert.equal(cast.amount, 36)
  assert.equal(spells.castBuff(ma, 3, ctx, minRand).amount, 3)
  // Antidote: lvl × 20 clicks of immunity, lvl × 2 MP.
  const an = spells.getSpell('antidote')
  assert.equal(an.castCost(4), 8)
  assert.equal(spells.castBuff(an, 4, ctx, maxRand).clicks, 80)
})

test('wings and gills stay uncastable until they have a handler', () => {
  assert.equal(spells.isCastable(spells.getSpell('wings')), false)
  assert.equal(spells.isCastable(spells.getSpell('gills')), false)
})

// ─── poison ──────────────────────────────────────────────────────────────────

test('poison is offered on every hit while the player can be poisoned, and never otherwise', () => {
  const enemy = { att: 10, specials: ['venom'] }
  assert.equal(specials.selectEnemySpecial(enemy, maxRand, { canPoison: true })?.id, 'venom')
  assert.equal(specials.selectEnemySpecial(enemy, minRand, { canPoison: true })?.id, 'venom')
  assert.equal(specials.selectEnemySpecial(enemy, maxRand, { canPoison: false }), null)
})

test('poison scales with the PLAYER level: rand(1, lvl/2) or rand(1, lvl)', () => {
  const p = specials.ENEMY_SPECIALS.poison
  const v = specials.ENEMY_SPECIALS.venom
  assert.equal(p.rollPoison(10, maxRand), 5)
  assert.equal(v.rollPoison(10, maxRand), 10)
  assert.equal(p.rollPoison(1, maxRand), 1) // never rand(1, 0)
  assert.equal(p.rollPoison(10, minRand), 1)
})

test('a poisoning hit is an ordinary blocked hit that leaves poison behind, unless dodged', () => {
  const state = new BattleState({
    playerId: 'p', roomId: 'r', enemy: { slug: 'e', name: 'E', hp: 10, att: 10, def: 0, damageType: 'MELEE', specials: ['poison'] },
    playerStats: { level: 8, str: 0, dex: 0, mag: 0, def: 0 },
  })
  const turn = resolveEnemyAttack(state, 0)
  assert.equal(turn.enemyAction.id, 'poison')
  assert.ok(turn.poisonApplied && turn.poisonApplied.clicks >= 1 && turn.poisonApplied.clicks <= 4, JSON.stringify(turn.poisonApplied))
  assert.equal(turn.playerBlock, 0) // DEF 0 rolls a 0 block; the hit is still blockable

  const poisoned = new BattleState({
    playerId: 'p', roomId: 'r', enemy: { slug: 'e', name: 'E', hp: 10, att: 10, def: 0, damageType: 'MELEE', specials: ['poison'] },
    playerStats: { level: 8, str: 0, dex: 0, mag: 0, def: 0, poisonClicks: 3 },
  })
  const plain = resolveEnemyAttack(poisoned, 0)
  assert.equal(plain.enemyAction, null)
  assert.equal(plain.poisonApplied, null)

  const immune = new BattleState({
    playerId: 'p', roomId: 'r', enemy: { slug: 'e', name: 'E', hp: 10, att: 10, def: 0, damageType: 'MELEE', specials: ['poison'] },
    playerStats: { level: 8, str: 0, dex: 0, mag: 0, def: 0, poisonImmuneClicks: 20 },
  })
  assert.equal(resolveEnemyAttack(immune, 0).poisonApplied, null)
})

test('poison enemies wear a poison-toned tag', () => {
  const traits = getEnemyTraits({ specials: ['venom'] })
  assert.deepEqual(traits.map((t) => [t.id, t.tone]), [['venom', 'poison']])
})

// ─── iron skin ───────────────────────────────────────────────────────────────

test('Iron Skin stands as DEF for the fight while it runs, like any other DEF', () => {
  const mk = (over, enemyOver = {}) =>
    new BattleState({
      playerId: 'p', roomId: 'r',
      enemy: { slug: 'e', name: 'E', hp: 10, att: 10, def: 0, damageType: 'MELEE', ...enemyOver },
      playerStats: { level: 1, str: 0, dex: 0, mag: 0, def: 3, ...over },
    })
  assert.equal(mk({ ironSkinClicks: 5, ironSkinAmount: 4 }).baseDef, 7)
  assert.equal(resolveEnemyAttack(mk({ ironSkinClicks: 5, ironSkinAmount: 4 }), 0).effectiveDef, 7)
  // Expired (clicks 0) means no bonus, whatever the stale amount says.
  assert.equal(mk({ ironSkinClicks: 0, ironSkinAmount: 4 }).baseDef, 3)
  // Pure damage ignores the whole block, Iron Skin included.
  const pure = resolveEnemyAttack(mk({ ironSkinClicks: 5, ironSkinAmount: 4 }, { specials: ['pure'] }), 0)
  assert.equal(pure.playerBlock, 0)
})

// ─── expiry copy ─────────────────────────────────────────────────────────────

test('every countdown has an expiry line', () => {
  for (const field of buffs.BUFF_FIELDS) {
    assert.ok(buffs.expiryMessage(field).length > 0, field)
  }
  assert.equal(buffs.expiryMessage('poisonClicks'), 'The poison has run its course.')
})
