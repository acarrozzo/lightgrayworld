/**
 * A greyed-out button that goes through anyway.
 *
 * The battle deck greys a cast short of MP, a strike with the wrong weapon in
 * hand and a potion at full HP, and they stay grey. If one gets through
 * anyway (typed, or clicked while the store is a beat behind), the server
 * refuses it and, in a fight, the refusal costs the turn: the enemy answers
 * (Oct 31 2026). Out of a fight the same refusal is free.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// ── stubs, before anything that loads them ───────────────────────────────────

const db = { vitals: null, spellState: null, skillState: null, inventory: [], drunk: 0 }
const battleCalls = { supportTurn: [] }

const stub = (rel, exports) => {
  const p = require.resolve(path.join(ROOT, rel))
  require.cache[p] = { id: p, filename: p, loaded: true, exports }
}

stub('src/lib/db-client.js', {
  prisma: {
    user: {
      findUnique: async () => db.vitals,
      update: async () => ({}),
    },
    $transaction: async () => {
      db.drunk += 1
    },
  },
})
stub('src/lib/game-engine/services/present-enemy-service.js', {
  savePresentEnemy: async () => {},
  loadPresentEnemy: async () => null,
})
stub('src/lib/game-engine/battle-action-handlers.js', {
  executeStartBattle: async () => ({ success: true, action: 'start_battle', playerEvents: [] }),
  resolveSupportTurn: async (playerId, roomState, meta) => {
    battleCalls.supportTurn.push({ playerId, meta })
    return { playerEvents: [{ event: 'battle:turn', payload: { actionMeta: meta } }] }
  },
  executePlayerAttack: async () => ({ success: true }),
  executePlayerFlee: async () => ({ success: true }),
  // Bare hands: no strike that wants a weapon fits.
  fetchEquippedWeapon: async () => null,
  readAmmo: async () => null,
  ammoDisplayName: async (slug) => slug,
})

// Only the reads the refusals stand on are replaced; the refusals are the real ones.
const spellService = require(path.join(ROOT, 'src/lib/game-engine/services/spell-service.js'))
spellService.getSpellState = async () => db.spellState
const skillService = require(path.join(ROOT, 'src/lib/game-engine/services/skill-service.js'))
skillService.getSkillState = async () => db.skillState
const inventoryService = require(path.join(ROOT, 'src/lib/game-engine/services/inventory-service.js'))
inventoryService.getPlayerInventory = async () => db.inventory

const { RoomState } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))

/** A probabilistic room deep in the mine: 40% a turn, everything in it hostile. */
const MINE = '311-07'

const RED_POTION = {
  id: 'pi-red',
  quantity: 3,
  template: {
    slug: 'red-potion',
    name: 'Red Potion',
    metadata: { icon: 'red-potion', consumable: { stat: 'hp', amount: 100, verb: 'drink' } },
  },
}

const roomWith = (fighting) => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 100 })
  if (fighting) room.activeBattles.set('p1', { isActive: true, enemyName: 'Iron Golem', end() {} })
  return room
}

test.beforeEach(() => {
  db.vitals = { hp: 100, hpMax: 100, mp: 0, mpMax: 50 }
  db.spellState = { spells: { fireball: 1 }, mp: 0, effectiveMag: 10 }
  db.skillState = { skills: { slice: 1, magicStrike: 1 }, mp: 0 }
  db.inventory = [RED_POTION]
  db.drunk = 0
  battleCalls.supportTurn.length = 0
})

test('a cast short of MP is refused in a fight, and the enemy answers, button or typed', async () => {
  const room = roomWith(true)

  const clicked = await room.executeAction({ type: 'cast_spell', data: { spellId: 'fireball' } }, 'p1')
  assert.equal(clicked.success, false)
  assert.equal(battleCalls.supportTurn.length, 1)
  assert.equal(battleCalls.supportTurn[0].meta.label, 'Refused')
  assert.match(battleCalls.supportTurn[0].meta.text, /enough MP to cast Fireball/)

  const typed = await room.executeAction({ type: 'cast fireball' }, 'p1')
  assert.equal(typed.success, false)
  assert.equal(battleCalls.supportTurn.length, 2)
})

test('a strike with the wrong weapon in hand is refused in a fight, and the enemy answers', async () => {
  const room = roomWith(true)

  const result = await room.executeAction({ type: 'use_skill', data: { skillId: 'slice' } }, 'p1')
  assert.equal(result.success, false)
  assert.equal(battleCalls.supportTurn.length, 1)
  assert.equal(battleCalls.supportTurn[0].meta.label, 'Refused')
  assert.match(battleCalls.supportTurn[0].meta.text, /Needs a one-handed weapon to Slice/)
})

test('a strike short of MP is refused in a fight, and the enemy answers', async () => {
  const room = roomWith(true)

  const result = await room.executeAction({ type: 'magic strike' }, 'p1')
  assert.equal(result.success, false)
  assert.equal(battleCalls.supportTurn.length, 1)
  assert.match(battleCalls.supportTurn[0].meta.text, /enough MP to Magic Strike/)
})

test('a potion at full HP is refused in a fight: nothing is drunk, and the enemy answers', async () => {
  const room = roomWith(true)

  const result = await room.executeAction({ type: 'use_item', data: { playerItemId: 'pi-red', action: 'drink' } }, 'p1')
  assert.equal(result.success, false)
  assert.equal(db.drunk, 0)
  assert.equal(battleCalls.supportTurn.length, 1)
  assert.equal(battleCalls.supportTurn[0].meta.label, 'Refused')
  assert.match(battleCalls.supportTurn[0].meta.text, /HP is already full/)
  // Charged once, not again by the dispatcher's turn tail.
  assert.equal(result.turnResolved, true)
})

test('out of a fight the same refusals stay free', async () => {
  const room = roomWith(false)

  await room.executeAction({ type: 'cast_spell', data: { spellId: 'fireball' } }, 'p1')
  await room.executeAction({ type: 'use_skill', data: { skillId: 'slice' } }, 'p1')
  await room.executeAction({ type: 'use_item', data: { playerItemId: 'pi-red', action: 'drink' } }, 'p1')
  assert.equal(battleCalls.supportTurn.length, 0)
  assert.equal(db.drunk, 0)
})
