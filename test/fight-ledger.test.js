/**
 * The fight ledger: one structured row per turn.
 *
 * The row is the server's reading of a turn, kept so a fight can be read back
 * during it, right after it and from the Battle Log later. These checks pin
 * the projection — which kind each turn becomes, where the numbers land, what
 * is left out — and the battle state's bounded list behind it. Pure
 * functions, no database. Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const { compactTurn, pushLedgerTurn, LEDGER_CAP } = require(path.join(ROOT, 'src/lib/game-engine/fight-ledger.js'))
const { BattleState } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))

// A resolved weapon turn, as resolveTurn returns it: 9 raw − 2 block = 7 to
// the enemy, the enemy's 5 raw − 2 block = 3 back.
const swing = (over = {}) => ({
  playerDealtDamage: 7,
  enemyDealtDamage: 3,
  playerRaw: 9,
  enemyRaw: 5,
  playerBlocked: 2,
  enemyBlocked: 2,
  enemyAction: null,
  spell: null,
  skill: null,
  extraShot: null,
  companion: null,
  enemyEffects: {},
  extraHits: [],
  ...over,
})
const after = (over = {}) => ({ turn: 1, playerHp: 41, enemyHp: 23, ...over })

test('a plain swing: strike with raw, block and own damage; the enemy hit back', () => {
  const row = compactTurn(swing(), after())
  assert.equal(row.t, 1)
  assert.deepEqual(row.hp, { you: 41, foe: 23 })
  assert.equal(row.mp, null)
  assert.equal(row.you.kind, 'strike')
  assert.equal(row.you.name, null)
  assert.equal(row.you.dmg, 7)
  assert.equal(row.you.raw, 9)
  assert.equal(row.you.block, 2)
  assert.equal(row.you.cost, null)
  assert.equal(row.you.miss, null)
  assert.deepEqual(row.you.helpers, [])
  assert.equal(row.foe.kind, 'hit')
  assert.equal(row.foe.dmg, 3)
  assert.equal(row.foe.raw, 5)
  assert.equal(row.foe.block, 2)
  assert.deepEqual(row.foe.fx, [])
})

test('a skill strike keeps the weapon roll and the bonus apart, and charges its MP', () => {
  const row = compactTurn(
    swing({ playerDealtDamage: 11, playerRaw: 12, enemyBlocked: 1, skill: { name: 'Slice', cost: 2, weaponRaw: 8, bonus: 4, bonusMax: 5 } }),
    after({ playerMp: 18 })
  )
  assert.equal(row.you.kind, 'skill')
  assert.equal(row.you.name, 'Slice')
  assert.equal(row.you.raw, 8)
  assert.equal(row.you.bonus, 4)
  assert.equal(row.you.block, 1)
  assert.equal(row.you.cost, 2)
  assert.equal(row.you.dmg, 11)
  assert.equal(row.mp, 18)
})

test('a spell keeps its own breakdown; a fizzle on a magic-immune enemy charges nothing', () => {
  const cast = compactTurn(
    swing({ playerDealtDamage: 12, playerRaw: 12, spell: { name: 'Fireball', cost: 4, amount: 12, text: '2 + (9 × 1.10) = 12' } }),
    after()
  )
  assert.equal(cast.you.kind, 'spell')
  assert.equal(cast.you.name, 'Fireball')
  assert.equal(cast.you.raw, 12)
  assert.equal(cast.you.cost, 4)
  assert.equal(cast.you.calc, '2 + (9 × 1.10) = 12')

  const fizzle = compactTurn(
    swing({ playerDealtDamage: 0, playerRaw: null, immuneToMagic: true, spell: { name: 'Fireball', cost: 4, amount: 0, text: null } }),
    after()
  )
  assert.equal(fizzle.you.miss, 'immune-magic')
  assert.equal(fizzle.you.cost, null)
  assert.equal(fizzle.you.block, null)
})

test('the three ways a swing comes to nothing are named, and no block is shown for them', () => {
  assert.equal(compactTurn(swing({ playerDealtDamage: 0, missedFlyingMelee: true }), after()).you.miss, 'flying')
  assert.equal(compactTurn(swing({ playerDealtDamage: 0, immuneToWeapon: 'MELEE' }), after()).you.miss, 'immune-melee')
  assert.equal(compactTurn(swing({ playerDealtDamage: 0, immuneToWeapon: 'RANGED' }), after()).you.miss, 'immune-ranged')
  const dodged = compactTurn(swing({ playerDealtDamage: 0, playerRaw: null, enemyDodged: true }), after())
  assert.equal(dodged.you.kind, 'strike')
  assert.equal(dodged.you.miss, 'dodged')
  assert.equal(dodged.you.block, null)
  const blocked = compactTurn(swing({ playerDealtDamage: 0, enemyDodged: true, enemyEffects: { blocked: true } }), after())
  assert.equal(blocked.you.miss, 'blocked')
})

test('helpers are listed beside your own hit, never folded into it', () => {
  const row = compactTurn(
    swing({ extraShot: { roll: 6, block: 1, damage: 5 }, companion: { name: 'Ogre', damage: 9 } }),
    after()
  )
  assert.equal(row.you.dmg, 7)
  assert.deepEqual(row.you.helpers, [
    { name: 'Second arrow', dmg: 5 },
    { name: 'Ogre', dmg: 9 },
  ])
})

test('a support turn names what was used and its effect, and spends no roll', () => {
  const potion = compactTurn(
    { playerDealtDamage: 0, enemyDealtDamage: 0, playerRaw: null, enemyRaw: 4, playerBlocked: 4, enemyEffects: {}, extraHits: [] },
    after({ turn: 3, playerHp: 55, actionMeta: { kind: 'use_item', itemName: 'Red Capsule', effectText: '+20 HP', label: null, text: null } })
  )
  assert.equal(potion.you.kind, 'support')
  assert.equal(potion.you.name, 'Red Capsule')
  assert.equal(potion.you.verb, 'use_item')
  assert.equal(potion.you.effect, '+20 HP')
  assert.equal(potion.you.dmg, 0)
  assert.equal(potion.you.raw, null)
  // The enemy swung and was blocked: a hit for nothing, not a turn it sat out.
  assert.equal(potion.foe.kind, 'hit')
  assert.equal(potion.foe.dmg, 0)

  const mined = compactTurn(
    { playerDealtDamage: 0, enemyDealtDamage: 2, playerRaw: null, enemyRaw: 4, playerBlocked: 2, enemyEffects: {}, extraHits: [] },
    after({ actionMeta: { kind: 'room_action', itemName: null, label: 'Mine here', text: 'You mine some Coal.', effectText: null } })
  )
  assert.equal(mined.you.name, 'Mine here')
})

test('an ambush is a turn you did not take; the kill turn is one the enemy did not', () => {
  const ambush = compactTurn(
    { playerDealtDamage: 0, enemyDealtDamage: 4, playerRaw: null, enemyRaw: 6, playerBlocked: 2, enemyEffects: {}, extraHits: [] },
    after({ turn: 1 })
  )
  assert.equal(ambush.you.kind, 'none')
  assert.equal(ambush.foe.kind, 'hit')
  assert.equal(ambush.foe.dmg, 4)

  const kill = compactTurn(swing({ playerDealtDamage: 23 }), after({ enemyHp: 0, enemyActed: false }))
  assert.equal(kill.foe.kind, 'none')
  assert.equal(kill.foe.dmg, 0)
  assert.equal(kill.foe.raw, null)
  assert.equal(kill.hp.foe, 0)
})

test('a petrified turn is stone on your side while the enemy keeps swinging', () => {
  const row = compactTurn(swing({ playerDealtDamage: 0, playerRaw: null, petrified: true }), after())
  assert.equal(row.you.kind, 'stone')
  assert.equal(row.you.dmg, 0)
  assert.equal(row.foe.kind, 'hit')
})

test("the enemy's special names itself, lists its rolls and its hits after the first", () => {
  const row = compactTurn(
    swing({
      enemyDealtDamage: 6,
      enemyRaw: 3,
      playerBlocked: 0,
      enemyAction: { id: 'power-attack', name: 'Power Attack', rolls: [3, 2, 1] },
      extraHits: [
        { raw: 2, block: 0, damage: 2, dodged: false },
        { raw: 1, block: 0, damage: 1, dodged: false, action: { id: 'bite', name: 'Bite', rolls: [1] }, pack: true },
      ],
    }),
    after()
  )
  assert.equal(row.foe.kind, 'special')
  assert.equal(row.foe.name, 'Power Attack')
  assert.equal(row.foe.dmg, 6)
  assert.deepEqual(row.foe.rolls, [3, 2, 1])
  assert.deepEqual(row.foe.hits, [
    { dmg: 2, name: null, dodged: false, pack: false },
    { dmg: 1, name: 'Bite', dodged: false, pack: true },
  ])
})

test('what the enemy did beyond its hits becomes typed effects, zeros left out', () => {
  const row = compactTurn(
    swing({
      poisonApplied: { clicks: 12 },
      petrifyApplied: 2,
      enemyHealed: 5,
      enemyEffects: { hpDrained: 3, mpDrained: 0, stolen: 4, resurrected: true },
    }),
    after({ absorbed: 2 })
  )
  assert.deepEqual(row.foe.fx, [
    { k: 'rise' },
    { k: 'stone', n: 2 },
    { k: 'poison', n: 12 },
    { k: 'absorb', n: 5 },
    { k: 'drainHp', n: 3 },
    { k: 'steal', n: 4 },
    { k: 'armor', n: 2 },
  ])
  assert.equal(row.foe.dodged, false)
  assert.equal(compactTurn(swing({ enemyDealtDamage: 0, playerDodged: true }), after()).foe.dodged, true)
})

test("a healer's turn and a wind-up are their own kinds, with nothing dealt", () => {
  const heal = compactTurn(swing({ enemyDealtDamage: 0, enemyEffects: { healCast: 9 } }), after())
  assert.equal(heal.foe.kind, 'heal')
  assert.equal(heal.foe.dmg, 0)
  assert.deepEqual(heal.foe.fx, [{ k: 'heal', n: 9 }])

  const windUp = compactTurn(swing({ enemyDealtDamage: 0, enemyEffects: { windUp: { id: 'firebreath', name: 'Firebreath', line: 'inhales' } } }), after())
  assert.equal(windUp.foe.kind, 'windup')
  assert.equal(windUp.foe.name, 'Firebreath')
})

test('the list is bounded: past the cap the oldest go, the opening turn stays', () => {
  const turns = []
  for (let t = 1; t <= LEDGER_CAP + 25; t += 1) pushLedgerTurn(turns, { t })
  assert.equal(turns.length, LEDGER_CAP)
  assert.equal(turns[0].t, 1)
  assert.equal(turns[1].t, 27)
  assert.equal(turns[turns.length - 1].t, LEDGER_CAP + 25)
})

test('a battle state files rows and hands them back on resume', () => {
  const enemy = { slug: 'bunny', name: 'Bunny', hp: 20, level: 1, att: 3, def: 1, description: '' }
  const stats = { hp: 50, hpMax: 50, str: 5, dex: 5, mag: 5, def: 5, level: 2 }
  const state = new BattleState({ playerId: 'p1', roomId: '001', enemy, playerStats: stats })
  assert.deepEqual(state.turns, [])
  state.recordLedgerTurn({ t: 1 })
  state.recordLedgerTurn({ t: 2 })
  state.recordLedgerTurn(null)
  assert.deepEqual(state.turns.map((r) => r.t), [1, 2])
  const resume = state.getResumeSnapshot({ playerHp: 40, playerHpMax: 50 })
  assert.equal(resume.turns, state.turns)
})
