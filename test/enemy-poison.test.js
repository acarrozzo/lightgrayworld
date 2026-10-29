/**
 * Poison on the enemy — Poison Dart.
 *
 * The dart is Fireball's hit, then a share of the player's MAG burned off the
 * enemy every turn for five turns, past its DEF: the shape settled on in the
 * October 2026 magic rebalance in place of the original's dwindling count.
 * The poison lives on the fight: a second dart while it runs is the hit
 * alone, a resurrected enemy stands up clean, the burn counts as the player's
 * damage and can be the blow that kills, and it ticks on a turn spent
 * drinking too. Pure over a BattleState, no database. Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'

const spells = require(path.join(ROOT, 'src/lib/game-data/spells.js'))
const { BattleState } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))
const { resolvePlayerAttack } = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))
const { compactTurn } = require(path.join(ROOT, 'src/lib/game-engine/fight-ledger.js'))
const { settleEnemyPoison, describeEnemyPoison, poisonDamage } = require(path.join(ROOT, 'src/lib/game-engine/battle-action-handlers.js'))

const dart = spells.getSpell('poison-dart')
const fireball = spells.getSpell('fireball')

const enemy = (over = {}) => ({ slug: 'rat', name: 'Rat', hp: 100, att: 0, def: 0, level: 1, damageType: 'MELEE', ...over })
const stats = (over = {}) => ({ str: 10, dex: 10, mag: 100, def: 10, level: 10, hp: 50, hpMax: 50, ...over })
const fight = (over = {}) => new BattleState({ playerId: 'p1', roomId: '001', enemy: enemy(over), playerStats: stats() })
const cast = (def, level, mag = 100) => ({ def, level, cost: def.castCost(level, mag) })

test('the dart is castable, keeps Fireball’s hit, and prices itself above it', () => {
  assert.equal(spells.isCastable(dart), true)
  assert.equal(dart.castCost(3, 100), 14)
  assert.equal(fireball.castCost(3, 100), 11)
  const fixed = () => 9
  assert.equal(spells.rollSpell(dart, 2, 10, fixed).amount, spells.rollSpell(fireball, 2, 10, fixed).amount)
})

test('the poison is (5 + lvl) ÷ 2 percent of MAG a turn for five turns, rounded up, never less than 1', () => {
  assert.deepEqual(spells.poisonDartDot(1, 100), { amount: 3, turns: 5, pct: 3 })
  assert.deepEqual(spells.poisonDartDot(15, 2000), { amount: 200, turns: 5, pct: 10 })
  assert.equal(spells.poisonDartDot(5, 1).amount, 1)
  assert.equal(spells.poisonDartDot(10, 0).amount, 1)
  assert.equal(spells.POISON_DART_TURNS, 5)
  assert.match(spells.previewSpell(dart, 3, 20).text, /then poison 1 a turn for 5 turns/)
})

test('a landed dart carries its poison on the cast record; a dodged or fizzled one carries none', () => {
  const landed = resolvePlayerAttack(fight(), 0, { spell: cast(dart, 5) })
  assert.deepEqual(landed.spell.dot, { amount: 5, turns: 5, pct: 5 })
  // The group bonus scales the poison with the hit.
  assert.equal(resolvePlayerAttack(fight(), 2, { spell: cast(dart, 5) }).spell.dot.amount, 6)
  assert.equal(resolvePlayerAttack(fight(), 0, { spell: cast(dart, 5), enemyDodged: true }).spell.dot, null)
  assert.equal(resolvePlayerAttack(fight({ isMagicImmune: true }), 0, { spell: cast(dart, 5) }).spell.dot, null)
  // Fireball leaves nothing.
  assert.equal(resolvePlayerAttack(fight(), 0, { spell: cast(fireball, 5) }).spell.dot, null)
})

test('the cast turn puts the poison on and burns once; four more turns finish it', () => {
  const b = fight()
  const turn = resolvePlayerAttack(b, 0, { spell: cast(dart, 5) })
  settleEnemyPoison(b, turn)
  assert.deepEqual(turn.enemyPoisoned, { perTurn: 5, turns: 5 })
  assert.equal(turn.poisonRefused, undefined)
  assert.deepEqual(turn.poisonTick, { amount: 5, left: 4, killed: false, source: 'Poison Dart' })
  assert.deepEqual(b.getSnapshot().enemyPoison, { perTurn: 5, turnsLeft: 4, source: 'Poison Dart' })
  assert.equal(b.enemyCurrentHp, 95)
  assert.equal(poisonDamage(turn), 5)

  // A potion turn burns too.
  const sip = {}
  settleEnemyPoison(b, sip)
  assert.deepEqual(sip.poisonTick, { amount: 5, left: 3, killed: false, source: 'Poison Dart' })
  for (const left of [2, 1, 0]) {
    const t = {}
    settleEnemyPoison(b, t)
    assert.equal(t.poisonTick.left, left)
  }
  assert.equal(b.enemyPoison, null)
  assert.equal(b.getSnapshot().enemyPoison, null)
  const quiet = {}
  settleEnemyPoison(b, quiet)
  assert.equal(quiet.poisonTick, null)
})

test('a second dart while the poison runs is the hit alone: no refresh, no stack, and the turn says so', () => {
  const b = fight()
  settleEnemyPoison(b, resolvePlayerAttack(b, 0, { spell: cast(dart, 5) }))
  const again = resolvePlayerAttack(b, 0, { spell: cast(dart, 15) })
  settleEnemyPoison(b, again)
  assert.equal(again.enemyPoisoned, undefined)
  assert.equal(again.poisonRefused, true)
  assert.equal(b.enemyPoison.perTurn, 5, 'the stronger dart did not replace it')
  assert.equal(again.poisonTick.left, 3, 'the running count kept counting down')
  assert.match(describeEnemyPoison('Rat', again), /already poisoned; the dart adds nothing/)
})

test('the burn can be the blow that kills, and is said so', () => {
  const b = fight({ hp: 100 })
  b.enemyCurrentHp = 3
  const turn = resolvePlayerAttack(b, 0, { spell: cast(dart, 5) })
  // The hit itself may have finished it; set the scene so only the poison does.
  b.enemyCurrentHp = 3
  b.enemyPoison = null
  settleEnemyPoison(b, turn)
  assert.equal(turn.poisonTick.amount, 3)
  assert.equal(turn.poisonTick.killed, true)
  assert.equal(b.isEnemyDead(), true)
  assert.match(describeEnemyPoison('Rat', turn), /takes its last 3 HP/)
})

test('a dead enemy takes no poison, and a resurrected one stands up clean', () => {
  const b = fight()
  settleEnemyPoison(b, resolvePlayerAttack(b, 0, { spell: cast(dart, 5) }))
  assert.ok(b.enemyPoison)
  b.reviveEnemy()
  assert.equal(b.enemyPoison, null)
  b.enemyCurrentHp = 0
  assert.equal(b.poisonEnemy(5, 5, 'Poison Dart'), false)
  assert.equal(b.burnEnemyPoison(), null)
})

test('the ledger files the burn beside your hit, like a second arrow', () => {
  const row = compactTurn(
    { playerDealtDamage: 12, playerRaw: 12, enemyRaw: 0, enemyDealtDamage: 0, spell: { name: 'Poison Dart', cost: 20, amount: 12, text: '5 + 7 = 12' }, poisonTick: { amount: 5, left: 4, killed: false } },
    { turn: 2, playerHp: 40, enemyHp: 83 }
  )
  assert.equal(row.you.kind, 'spell')
  assert.deepEqual(row.you.helpers, [{ name: 'Poison', dmg: 5 }])
  const none = compactTurn({ playerDealtDamage: 7, playerRaw: 9, enemyRaw: 0, enemyDealtDamage: 0 }, { turn: 3, playerHp: 40, enemyHp: 76 })
  assert.deepEqual(none.you.helpers, [])
})

test('the feed line reads the cast, the burn and the end of it', () => {
  assert.equal(describeEnemyPoison('Rat', {}), '')
  assert.equal(
    describeEnemyPoison('Rat', { enemyPoisoned: { perTurn: 5, turns: 5 }, poisonTick: { amount: 5, left: 4, killed: false } }),
    ' The Rat is POISONED: 5 a turn for 5 turns. The poison burns the Rat for 5 (4 turns left).'
  )
  assert.equal(describeEnemyPoison('Rat', { poisonTick: { amount: 5, left: 1, killed: false } }), ' The poison burns the Rat for 5 (1 turn left).')
  assert.equal(describeEnemyPoison('Rat', { poisonTick: { amount: 5, left: 0, killed: false } }), ' The poison burns the Rat for 5 and wears off.')
})
