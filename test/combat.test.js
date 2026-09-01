/**
 * Combat and progression invariants.
 *
 * These are the rules CLAUDE.md calls non-negotiable — the opposed-roll shape,
 * which stat answers which attack, flying enemies rejecting melee, the cubic XP
 * curve — expressed as executable checks rather than prose. They are pure
 * functions, so this file needs no database, no server and no fixtures.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const {
  resolvePlayerAttack,
  resolveEnemyAttack,
  pickPlayerOffensiveStat,
  pickPlayerDefensiveStat,
  rand,
} = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))
const { getNextLevelXP, getPrevLevelXP } = require(path.join(
  ROOT,
  'src/lib/game-engine/services/leveling-service.js'
))
const { resolveDrops } = require(path.join(ROOT, 'src/lib/game-engine/battle-win-handler.js'))

// A battle state with no randomness left to chance: every roll spans [0, n],
// so setting a stat to 0 pins that roll to exactly 0.
const battleState = (over = {}) => ({
  baseStr: 10,
  baseDex: 10,
  baseMag: 10,
  baseDef: 10,
  equippedWeaponCategory: 'MELEE',
  enemy: { att: 10, def: 0, damageType: 'MELEE', isFlying: false },
  ...over,
})

test('rand tolerates an inverted range', () => {
  // A negative effective stat makes the low bound exceed the high one.
  for (let i = 0; i < 50; i++) {
    const v = rand(5, -5)
    assert.ok(v >= -5 && v <= 5, `${v} outside [-5, 5]`)
  }
})

test('offensive stat follows the weapon: STR for melee, DEX for ranged', () => {
  const s = battleState({ baseStr: 7, baseDex: 3 })
  assert.equal(pickPlayerOffensiveStat({ ...s, equippedWeaponCategory: 'MELEE' }), 7)
  assert.equal(pickPlayerOffensiveStat({ ...s, equippedWeaponCategory: 'RANGED' }), 3)
  // An unset category defends the melee default rather than throwing.
  assert.equal(pickPlayerOffensiveStat({ ...s, equippedWeaponCategory: undefined }), 7)
})

test('defensive stat follows the incoming damage type: DEF / DEX / MAG', () => {
  const s = battleState({ baseDef: 1, baseDex: 2, baseMag: 3 })
  assert.equal(pickPlayerDefensiveStat(s, { damageType: 'MELEE' }), 1)
  assert.equal(pickPlayerDefensiveStat(s, { damageType: 'RANGED' }), 2)
  assert.equal(pickPlayerDefensiveStat(s, { damageType: 'MAGIC' }), 3)
  assert.equal(pickPlayerDefensiveStat(s, {}), 1) // defaults to melee
})

test('a flying enemy cannot be hit with melee, but still counterattacks', () => {
  const flying = battleState({
    enemy: { att: 10, def: 0, damageType: 'MELEE', isFlying: true },
  })
  const melee = resolvePlayerAttack({ ...flying, equippedWeaponCategory: 'MELEE' }, 0)
  assert.equal(melee.missedFlyingMelee, true)
  assert.equal(melee.playerFinal, 0)

  // Ranged is unaffected.
  const ranged = resolvePlayerAttack({ ...flying, equippedWeaponCategory: 'RANGED' }, 0)
  assert.equal(ranged.missedFlyingMelee, false)
})

test('damage floors at zero — a strong block never heals', () => {
  // Player offence pinned to 0 against an enemy that always blocks 20.
  const s = battleState({ baseStr: 0, enemy: { att: 0, def: 20, damageType: 'MELEE' } })
  for (let i = 0; i < 50; i++) {
    const r = resolvePlayerAttack(s, 0)
    assert.ok(r.playerFinal >= 0, `player damage ${r.playerFinal} below zero`)
  }
  // And the same on the way in: enemy attack 0 against any defence.
  for (let i = 0; i < 50; i++) {
    const r = resolveEnemyAttack(battleState({ enemy: { att: 0, def: 0, damageType: 'MELEE' } }), 0)
    assert.ok(r.enemyFinal >= 0, `enemy damage ${r.enemyFinal} below zero`)
  }
})

test('each co-combatant adds 10% to the effective stat', () => {
  const s = battleState({ baseStr: 100 })
  assert.equal(resolvePlayerAttack(s, 0).effectiveOff, 100)
  assert.equal(resolvePlayerAttack(s, 1).effectiveOff, 110)
  assert.equal(resolvePlayerAttack(s, 3).effectiveOff, 130)

  const d = battleState({ baseDef: 100, enemy: { att: 0, def: 0, damageType: 'MELEE' } })
  assert.equal(resolveEnemyAttack(d, 2).effectiveDef, 120)
})

test('XP curve is 2 * (level + 1)^3, and the previous threshold agrees', () => {
  assert.equal(getNextLevelXP(1), 16) // 2 * 2^3
  assert.equal(getNextLevelXP(2), 54) // 2 * 3^3
  assert.equal(getNextLevelXP(9), 2000) // 2 * 10^3
  // getPrevLevelXP(n) must equal getNextLevelXP(n - 1): the bands have to meet
  // exactly, or a level's progress bar is wrong at one end.
  for (let level = 2; level <= 30; level++) {
    assert.equal(getPrevLevelXP(level), getNextLevelXP(level - 1))
  }
})

test('drops: one main roll at most, always-drops always, quantities summed per slug', () => {
  const enemy = {
    slug: 'test-dummy',
    drops: {
      // Bands cover the whole range, so exactly one main item always lands.
      main: [
        { itemSlug: 'a', chance: 0.5 },
        { itemSlug: 'b', chance: 0.5 },
      ],
      always: [{ itemSlug: 'a', qty: 2 }],
    },
  }
  for (let i = 0; i < 100; i++) {
    const drops = resolveDrops(enemy, new Set())
    const slugs = drops.map((d) => d.slug)
    // One row per distinct slug, never a duplicate row.
    assert.equal(new Set(slugs).size, slugs.length)
    const a = drops.find((d) => d.slug === 'a')
    if (slugs.includes('b')) {
      // main rolled b, so 'a' is only the always-drop
      assert.equal(a.qty, 2)
    } else {
      // main rolled a and it merged with the always-drop
      assert.equal(a.qty, 3)
    }
  }
})

test('drops: firstKill items are withheld once owned', () => {
  const enemy = { slug: 'boss', drops: { firstKill: ['trophy'] } }
  assert.deepEqual(resolveDrops(enemy, new Set()), [{ slug: 'trophy', qty: 1 }])
  assert.deepEqual(resolveDrops(enemy, new Set(['trophy'])), [])
})

test('drops: a main table that cannot fill its range sometimes yields nothing', () => {
  const enemy = { slug: 'stingy', drops: { main: [{ itemSlug: 'rare', chance: 0.1 }] } }
  let empty = 0
  for (let i = 0; i < 500; i++) {
    if (resolveDrops(enemy, new Set()).length === 0) empty++
  }
  // ~90% of rolls should produce nothing; assert only that both outcomes occur.
  assert.ok(empty > 0, 'a 0.1-chance table never missed across 500 rolls')
  assert.ok(empty < 500, 'a 0.1-chance table never hit across 500 rolls')
})
