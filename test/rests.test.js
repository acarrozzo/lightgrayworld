/**
 * Rests: the plain Rest and the special ones a room adds.
 *
 * game-data/room-rests.js says what each gives; the server's applyRest and the
 * room's buttons both read it. A rest only ever raises HP and MP, and a rest
 * with nothing to raise is a free refusal the button already shows grey.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// ── stubs, before anything that loads them ───────────────────────────────────

const db = { row: null, updates: [], buffCalls: [], member: true, gloryClicks: 0 }

const stub = (rel, exports) => {
  const p = require.resolve(path.join(ROOT, rel))
  require.cache[p] = { id: p, filename: p, loaded: true, exports }
}

stub('src/lib/db-client.js', {
  prisma: {
    user: {
      findUnique: async ({ select }) => {
        if (select?.buffGloryClicks) return { buffGloryClicks: db.gloryClicks }
        return db.row
      },
      update: async (args) => {
        db.updates.push(args)
        return {}
      },
    },
    $queryRawUnsafe: async (sql, playerId, clicks) => {
      db.buffCalls.push({ sql, clicks })
      db.gloryClicks = Math.max(db.gloryClicks, clicks)
      return [{ value: db.gloryClicks }]
    },
  },
})
stub('src/lib/game-engine/services/present-enemy-service.js', {
  savePresentEnemy: async () => {},
  loadPresentEnemy: async () => null,
})
stub('src/lib/game-engine/services/faction-service.js', {
  isMember: async () => db.member,
  isMemberOfAny: async () => db.member,
  makeMemberCheck: () => async () => db.member,
  getPlayerStandings: async () => [],
  getPlayerTitles: async () => [],
  factionByMembershipQuest: () => null,
})
const battleCalls = { startBattle: 0 }
stub('src/lib/game-engine/battle-action-handlers.js', {
  executeStartBattle: async () => {
    battleCalls.startBattle += 1
    return { success: true, action: 'start_battle', playerEvents: [] }
  },
  resolveSupportTurn: async () => ({ playerEvents: [] }),
  executePlayerAttack: async () => ({ success: true }),
  executePlayerFlee: async () => ({ success: true }),
  fetchEquippedWeapon: async () => null,
  readAmmo: async () => null,
  ammoDisplayName: async (slug) => slug,
})

const { ROOM_RESTS, getRoomRest, restOutcome, isRestSettled, restSettledMessage } = require(path.join(ROOT, 'src/lib/game-data/room-rests.js'))
const { RoomState } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))
const { ROOM_ACTIONS: SERVER_ACTIONS } = require(path.join(ROOT, 'src/lib/game-engine/room-action-handlers.js'))
const { getRoomActions } = require(path.join(ROOT, 'src/lib/room-actions.ts'))
const { restLook } = require(path.join(ROOT, 'src/lib/rest-look.ts'))

/** A probabilistic room deep in the mine: 40% a turn, everything in it hostile. */
const MINE = '311-07'

const withRandom = async (value, fn) => {
  const original = Math.random
  Math.random = () => value
  try {
    return await fn()
  } finally {
    Math.random = original
  }
}

const vitals = (hp, mp, extra = {}) => ({ hp, mp, hpMax: 100, mpMax: 50, physicalTraining: 5, mentalTraining: 3, ...extra })

test.beforeEach(() => {
  db.row = null
  db.updates.length = 0
  db.buffCalls.length = 0
  db.member = true
  db.gloryClicks = 0
  battleCalls.startBattle = 0
})

// ── the table ────────────────────────────────────────────────────────────────

test('every rest in the table has a server handler and a button', () => {
  for (const [roomId, rests] of Object.entries(ROOM_RESTS)) {
    for (const action of Object.keys(rests)) {
      assert.equal(typeof SERVER_ACTIONS[roomId]?.[action], 'function', `server handler ${roomId}/${action}`)
      assert.ok(
        getRoomActions(roomId).some((a) => a.action === action),
        `client button ${roomId}/${action}`
      )
    }
  }
})

test('every "rest at/on/in/by" button is in the table', () => {
  const { ROOM_ACTIONS } = require(path.join(ROOT, 'src/lib/room-actions.ts'))
  for (const [roomId, actions] of Object.entries(ROOM_ACTIONS)) {
    for (const { action } of actions) {
      if (/^rest (at|on|in|by) /.test(action)) assert.ok(getRoomRest(roomId, action), `${roomId}/${action}`)
    }
  }
})

test('a guild fire names its guild and what a non-member is told', () => {
  for (const rests of Object.values(ROOM_RESTS)) {
    for (const rest of Object.values(rests)) {
      if (rest.requiresMembership) assert.ok(rest.lockedMessage)
    }
  }
})

// ── what a rest gives ────────────────────────────────────────────────────────

test('an overcharge rest raises both vitals to the max plus its bonus', () => {
  const fire = getRoomRest('506', 'rest at the tree hut')
  assert.deepEqual(restOutcome(vitals(40, 10), fire), { hp: 175, mp: 125, hpGain: 135, mpGain: 115 })
})

test('a rest never lowers an overcharge from a bigger one', () => {
  // Fresh out of the Master Temple (+100), past the Grand Square fountain (+25).
  const fountain = getRoomRest('210', 'rest at fountain')
  assert.deepEqual(restOutcome(vitals(200, 150), fountain), { hp: 200, mp: 150, hpGain: 0, mpGain: 0 })
  // Above the line on one side, below on the other: raise the one, keep the other.
  assert.deepEqual(restOutcome(vitals(200, 20), fountain), { hp: 200, mp: 75, hpGain: 0, mpGain: 55 })
})

test('a full restore fills to the max and keeps an overcharge', () => {
  const oasis = getRoomRest('232x', 'rest at oasis')
  assert.deepEqual(restOutcome(vitals(30, 10), oasis), { hp: 100, mp: 50, hpGain: 70, mpGain: 40 })
  assert.deepEqual(restOutcome(vitals(130, 60), oasis), { hp: 130, mp: 60, hpGain: 0, mpGain: 0 })
})

test('the plain Rest recovers the training amounts, up to the max', () => {
  assert.deepEqual(restOutcome(vitals(40, 10), null), { hp: 45, mp: 13, hpGain: 5, mpGain: 3 })
  assert.deepEqual(restOutcome(vitals(98, 49), null), { hp: 100, mp: 50, hpGain: 2, mpGain: 1 })
  assert.deepEqual(restOutcome(vitals(130, 60), null), { hp: 130, mp: 60, hpGain: 0, mpGain: 0 })
})

test('with no Mental Training, a plain Rest at full HP has nothing to give', () => {
  const v = vitals(100, 10, { mentalTraining: 0 })
  assert.equal(isRestSettled(v, null), true)
  assert.match(restSettledMessage(v, null), /Mental Training/)
})

test('Bathe in Glory is settled only when the glory buff is also full', () => {
  const glory = getRoomRest('425', 'bathe in glory')
  const charged = vitals(200, 150)
  assert.equal(isRestSettled(charged, glory, { buffGloryClicks: 100 }), true)
  assert.equal(isRestSettled(charged, glory, { buffGloryClicks: 99 }), false)
  assert.equal(isRestSettled(charged, glory, {}), false)
  assert.equal(isRestSettled(vitals(40, 150), glory, { buffGloryClicks: 100 }), false)
})

// ── the button ───────────────────────────────────────────────────────────────

test('the button: open, settled, or locked for a non-member', () => {
  const fire = getRoomRest('225', 'rest at wizard fire')
  const member = () => true
  const stranger = () => false
  assert.equal(restLook(vitals(40, 10), fire, member).kind, 'open')
  assert.equal(restLook(vitals(200, 150), fire, member).kind, 'settled')
  assert.equal(restLook(vitals(200, 150), fire, stranger).kind, 'locked')
  // Quests not hydrated yet: the fire reads open, and the server decides.
  assert.equal(restLook(vitals(40, 10), fire, null).kind, 'open')
  assert.equal(restLook(null, fire, member).kind, 'open')
  assert.equal(restLook(vitals(100, 50), null, null).kind, 'settled')
})

// ── the server ───────────────────────────────────────────────────────────────

function roomWithPlayer() {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
  return room
}

test('a rest that lands writes the raised vitals and costs a turn', async () => {
  db.row = vitals(40, 10)
  const room = roomWithPlayer()
  const result = await room.applyRest('p1', 'rest at the tree hut', getRoomRest('506', 'rest at the tree hut'))

  assert.equal(result.success, true)
  assert.equal(result.noTurn, undefined)
  assert.deepEqual(db.updates[0].data, { hp: 175, mp: 125 })

  await withRandom(0, () => room.resolveTurn(result, 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle, 1)
})

test('a rest with nothing to raise writes nothing and costs no turn', async () => {
  db.row = vitals(200, 150)
  const room = roomWithPlayer()
  const result = await room.applyRest('p1', 'rest at fountain', getRoomRest('210', 'rest at fountain'))

  assert.equal(result.success, true)
  assert.equal(result.noTurn, true)
  assert.equal(db.updates.length, 0)
  const payload = result.playerEvents[0].payload
  assert.equal(payload.data.hp, 200)
  assert.equal(payload.data.mp, 150)

  await withRandom(0, () => room.resolveTurn(result, 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle, 0)
})

test('the plain Rest at full is a free refusal too', async () => {
  db.row = vitals(100, 50)
  const room = roomWithPlayer()
  const result = await room.executeRest('p1')
  assert.equal(result.noTurn, true)
  assert.equal(db.updates.length, 0)
})

test('a non-member at a guild fire is turned away free, vitals untouched', async () => {
  db.member = false
  db.row = vitals(40, 10)
  const room = roomWithPlayer()
  const result = await SERVER_ACTIONS['225']['rest at wizard fire']('p1', room)

  assert.equal(result.noTurn, true)
  assert.equal(db.updates.length, 0)
  assert.match(result.playerEvents[0].payload.message, /Wizard’s Guild/)
})

test('Bathe in Glory: rest and buff, buff alone, or a free refusal', async () => {
  const bathe = SERVER_ACTIONS['425']['bathe in glory']

  // Both: the rest lands and the glory starts.
  db.row = vitals(40, 10)
  let result = await bathe('p1', roomWithPlayer())
  assert.equal(result.noTurn, undefined)
  assert.deepEqual(db.updates[0].data, { hp: 200, mp: 150 })
  assert.equal(db.buffCalls.length, 1)
  assert.equal(result.playerEvents.length, 2)

  // Already charged, glory running down: the bath is the buff alone, and a turn.
  db.updates.length = 0
  db.buffCalls.length = 0
  db.row = vitals(200, 150)
  db.gloryClicks = 40
  result = await bathe('p1', roomWithPlayer())
  assert.equal(result.noTurn, undefined)
  assert.equal(db.updates.length, 0)
  assert.equal(db.buffCalls.length, 1)
  assert.equal(result.playerEvents.length, 1)
  assert.doesNotMatch(result.playerEvents[0].payload.data.modalContent.message, /REST/)

  // Charged and a full glory: nothing to raise, free.
  db.buffCalls.length = 0
  db.gloryClicks = 100
  result = await bathe('p1', roomWithPlayer())
  assert.equal(result.noTurn, true)
  assert.equal(db.buffCalls.length, 0)
})
