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
  reachesFlyingEnemy,
  rand,
} = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))
const { BattleState, playerIsFlying } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))
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

test('a flying player can melee a flying enemy — the original exempted $_SESSION[flying]', () => {
  const flying = battleState({
    baseStr: 0, // pins the swing to exactly 0 so the roll shape, not luck, is under test
    enemy: { att: 10, def: 0, damageType: 'MELEE', isFlying: true },
  })
  // On wings or a flying mount the melee swing is a normal, rolled attack.
  const airborne = resolvePlayerAttack({ ...flying, isFlying: true }, 0)
  assert.equal(airborne.missedFlyingMelee, false)
  assert.equal(airborne.playerRaw, 0)
  // Grounded again (wings ran out mid-fight), the same swing misses.
  const grounded = resolvePlayerAttack({ ...flying, isFlying: false }, 0)
  assert.equal(grounded.missedFlyingMelee, true)
})

test('reachesFlyingEnemy: a ranged weapon, or an airborne player', () => {
  assert.equal(reachesFlyingEnemy('MELEE', false), false)
  assert.equal(reachesFlyingEnemy('MELEE', true), true)
  assert.equal(reachesFlyingEnemy('RANGED', false), true)
  assert.equal(reachesFlyingEnemy(null, false), false) // bare hands are melee
  assert.equal(reachesFlyingEnemy(undefined, true), true)
})

test('BattleState.isFlying reads wings off the row or a flying mount off the gear', () => {
  const stats = { level: 1, str: 1, dex: 1, mag: 1, def: 1, hp: 10, hpMax: 10 }
  const enemy = { slug: 'bat', name: 'Bat', hp: 5, att: 1, def: 0, damageType: 'MELEE', isFlying: true }
  const walking = new BattleState({ playerId: 'p', roomId: '001', enemy, playerStats: stats, gear: { weaponCategory: 'MELEE' } })
  assert.equal(walking.isFlying, false)
  const winged = new BattleState({ playerId: 'p', roomId: '001', enemy, playerStats: { ...stats, wings: 3 }, gear: { weaponCategory: 'MELEE' } })
  assert.equal(winged.isFlying, true)
  const mounted = new BattleState({ playerId: 'p', roomId: '001', enemy, playerStats: stats, gear: { weaponCategory: 'MELEE', flyingMount: true } })
  assert.equal(mounted.isFlying, true)
  // Wings lapsing mid-fight is picked up by the next re-read of the row.
  winged.updateStats({ ...stats, wings: 0 })
  assert.equal(winged.isFlying, false)
  assert.equal(playerIsFlying({ wings: 1 }, null), true)
  assert.equal(playerIsFlying({ wings: 0 }, { flyingMount: false }), false)
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

// ─── Standing enemy behaviours (the Despair port, 2026-10-02) ────────────────

const { getEnemyBehaviours, selectEnemySpecial, ENEMY_SPECIALS } = require(path.join(ROOT, 'src/lib/game-data/enemy-specials.js'))
const { getEnemyTraits } = require(path.join(ROOT, 'src/lib/game-data/enemy-traits.js'))
const { rollEnemyDodge, resolveTurn } = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))

test('getEnemyBehaviours clamps and defaults', () => {
  // Every standing behaviour is off unless the definition turns it on. The
  // second block of fields came with the 2026-10-03 enemy perk port (2dad58e).
  assert.deepEqual(getEnemyBehaviours({}), {
    multiHitChance: 0, extraHits: 0, dodgeChance: 0, absorbsHp: false, meltsMelee: false,
    packChance: 0, heals: false, steals: false, pureDefense: false,
    blockChance: 0, hpDrain: 0, mpDrain: 0, resurrectChance: 0,
  })
  assert.deepEqual(
    getEnemyBehaviours({
      multiHitChance: 7, extraHits: 99, dodgeChance: -1, absorbsHp: 'yes', meltsMelee: true,
      packChance: 3, heals: 'yes', steals: true, pureDefense: 1,
      blockChance: -0.5, hpDrain: 9, mpDrain: 1.9, resurrectChance: 2,
    }),
    {
      multiHitChance: 1, extraHits: 6, dodgeChance: 0, absorbsHp: false, meltsMelee: true,
      packChance: 1, heals: false, steals: true, pureDefense: false,
      blockChance: 0, hpDrain: 2, mpDrain: 1, resurrectChance: 1,
    },
  )
})

test('Double / Triple Hit always follow the first hit, each blocked on its own', () => {
  // ATT 10, DEF 0: every roll lands as rolled.
  const s = battleState({ baseDef: 0, enemy: { att: 10, def: 0, damageType: 'MELEE', extraHits: 2 } })
  const atk = resolveEnemyAttack(s, 0)
  assert.equal(atk.extraHits.length, 2)
  const extra = atk.extraHits.reduce((sum, h) => sum + h.damage, 0)
  assert.equal(atk.enemyFinal, Math.max(0, atk.enemyRaw - atk.playerBlock) + extra)
})

test('multi-hit chains while the roll keeps hitting and is capped', () => {
  const always = battleState({ baseDef: 0, enemy: { att: 10, def: 0, damageType: 'MELEE', multiHitChance: 1 } })
  assert.equal(resolveEnemyAttack(always, 0).extraHits.length, 6)
  const never = battleState({ baseDef: 0, enemy: { att: 10, def: 0, damageType: 'MELEE', multiHitChance: 0 } })
  assert.equal(resolveEnemyAttack(never, 0).extraHits.length, 0)
})

test('an enemy dodge makes the attack nothing and still leaves the enemy its swing', () => {
  const enemy = { att: 10, def: 0, damageType: 'MELEE', dodgeChance: 1 }
  // The roll says which way the attack came to nothing: 'dodge' or 'block'
  // (2dad58e added Block to the same roll), and false when it lands.
  assert.equal(rollEnemyDodge(enemy), 'dodge')
  assert.equal(rollEnemyDodge({ ...enemy, dodgeChance: 0 }), false)
  assert.equal(rollEnemyDodge({ ...enemy, dodgeChance: 0, blockChance: 1 }), 'block')
  // Dodge is rolled first, so an enemy with both dodges.
  assert.equal(rollEnemyDodge({ ...enemy, blockChance: 1 }), 'dodge')
  const s = battleState({ enemy, baseStr: 50 })
  const turn = resolveTurn(s, 0, { enemyDodged: true })
  assert.equal(turn.enemyDodged, true)
  assert.equal(turn.playerDealtDamage, 0)
  assert.equal(turn.playerRaw, 0)
  // The companion waits too.
  assert.equal(turn.companion, null)
  assert.equal(turn.enemyEffects.blocked, undefined)
  // A block is the same nothing, and the turn record says it was a block.
  const blocked = resolveTurn(s, 0, { enemyDodged: 'block' })
  assert.equal(blocked.enemyDodged, true)
  assert.equal(blocked.playerDealtDamage, 0)
  assert.equal(blocked.enemyEffects.blocked, true)
  // The spell record survives so the panel can name what was dodged.
  const cast = resolveTurn(s, 0, { enemyDodged: true, spell: { def: { id: 'fireball', name: 'Fireball', icon: 'f', hue: 'red' }, level: 1, cost: 7 } })
  assert.equal(cast.spell.name, 'Fireball')
  assert.equal(cast.spell.amount, 0)
})

test('Melt halves a melee blow and its strike, never a shot or a spell', () => {
  // STR 10 vs DEF 0: raw is rand(0,10); force it with a huge STR so final > 1.
  const enemy = { att: 0, def: 0, damageType: 'MELEE', meltsMelee: true }
  const melee = resolvePlayerAttack(battleState({ enemy, baseStr: 1000 }), 0)
  assert.equal(melee.melted, melee.playerFinal > 0 || melee.playerRaw > 0 ? true : false)
  assert.equal(melee.playerFinal, Math.floor(Math.max(0, melee.playerRaw - melee.enemyBlock) / 2))
  const ranged = resolvePlayerAttack(battleState({ enemy, baseDex: 1000, equippedWeaponCategory: 'RANGED' }), 0)
  assert.equal(ranged.melted, false)
  assert.equal(ranged.playerFinal, Math.max(0, ranged.playerRaw - ranged.enemyBlock))
})

test('stone: the player swings at nothing, and the gaze is only offered while they can be turned', () => {
  const enemy = { att: 10, def: 0, damageType: 'MELEE', specials: ['petrify'] }
  const stone = resolveTurn(battleState({ enemy, baseStr: 50, petrifiedTurns: 1 }), 0)
  assert.equal(stone.petrified, true)
  assert.equal(stone.playerDealtDamage, 0)
  assert.equal(stone.companion, null)
  // rand(1, 5) === 1 procs it; already stone, it is never offered.
  const always = () => 1
  assert.equal(selectEnemySpecial(enemy, always, { canPetrify: true })?.id, 'petrify')
  assert.equal(selectEnemySpecial(enemy, always, { canPetrify: false }), null)
  assert.ok(ENEMY_SPECIALS.petrify.rollPetrify(rand) >= 1 && ENEMY_SPECIALS.petrify.rollPetrify(rand) <= 2)
})

test('BattleState: stone ticks down, HP Absorb heals only a living enemy and only to full', () => {
  const enemy = { slug: 'succubus', name: 'Succubus', hp: 100, att: 10, def: 0, damageType: 'MELEE', absorbsHp: true }
  const stats = { str: 1, dex: 1, mag: 1, def: 1, level: 1 }
  const b = new BattleState({ playerId: 'p', roomId: '906', enemy, playerStats: stats, gear: { weaponCategory: 'MELEE' } })
  b.petrify(2)
  assert.equal(b.isPetrified, true)
  b.tickPetrify(); b.tickPetrify()
  assert.equal(b.isPetrified, false)
  b.applyDamageToEnemy(30)
  assert.equal(b.healEnemy(50), 30)
  assert.equal(b.enemyCurrentHp, 100)
  b.applyDamageToEnemy(100)
  assert.equal(b.healEnemy(50), 0)
  assert.equal(b.getSnapshot().petrifiedTurns, 0)
})

test('the HUD tags name the standing behaviours', () => {
  const labels = getEnemyTraits({ extraHits: 1, multiHitChance: 0.3, dodgeChance: 0.2, absorbsHp: true, meltsMelee: true }).map((t) => t.id)
  assert.deepEqual(labels, ['extra-hits', 'multi-hit', 'enemy-dodge', 'absorb', 'melt'])
})

test('Multi Arrow looses a second plain shot at 100%, never without the skill, and never from an empty quiver', () => {
  const { resolveTurn, totalDamageToEnemy } = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))
  const bow = (over = {}) => battleState({ equippedWeaponCategory: 'RANGED', baseDex: 50, multiArrowChance: 100, ...over })
  const shot = resolvePlayerAttack(bow(), 0)
  assert.ok(shot.extraShot, 'a second arrow flew')
  assert.equal(shot.extraShot.damage, shot.extraShot.roll - shot.extraShot.block)
  assert.equal(resolvePlayerAttack(bow({ multiArrowChance: 0 }), 0).extraShot, null)
  assert.equal(resolvePlayerAttack(bow(), 0, { canMultiShot: false }).extraShot, null)
  assert.equal(resolvePlayerAttack(bow({ equippedWeaponCategory: 'MELEE' }), 0).extraShot, null)
  const turn = resolveTurn(bow({ enemyCurrentHp: 100, enemyMaxHp: 100 }), 0)
  assert.equal(totalDamageToEnemy(turn), turn.playerDealtDamage + turn.extraShot.damage)
})

test("the companion's share of the fight is kept for the victory card", () => {
  const enemy = { att: 10, def: 0, damageType: 'MELEE' }
  const stats = { level: 1, str: 1, dex: 1, mag: 1, def: 1, hp: 10, hpMax: 10 }
  const b = new BattleState({ playerId: 'p', roomId: '001', enemy, playerStats: stats, gear: { weaponCategory: 'MELEE' }, companion: { name: 'Ogre', damageMin: 5, damageMax: 25 } })
  b.recordTurn(20, 0, false, { playerDealtDamage: 12, companion: { name: 'Ogre', roll: 9, block: 1, damage: 8 } })
  b.recordTurn(7, 0, false, { playerDealtDamage: 7, companion: null })
  assert.equal(b.totalDamageDealt, 27)
  assert.equal(b.companionDamageDealt, 8)
})
