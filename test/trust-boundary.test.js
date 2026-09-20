/**
 * What the server will and will not take from a client.
 *
 * Three holes closed together, each of which let any logged-in player reach
 * past the game with nothing but the browser console:
 *
 *  - an empty chat emit threw inside an async socket listener, and an unhandled
 *    rejection ends the Node process — one packet, the whole world down;
 *  - a battle action read `spell` / `skill` out of `action.data`, the half of an
 *    action the socket layer copies from the client, and charged MP on whatever
 *    `cost` it found there — a negative cost paid out;
 *  - a room's hand-authored handlers ran for a player who was not in the room.
 *
 * No database, no server: Prisma is stubbed before anything loads it.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// --- Prisma stub -------------------------------------------------------------
// Records every raw statement so a test can say "no MP statement ever ran".
const rawStatements = []
const player = { hp: 100, hpMax: 100, mp: 5, mpMax: 5 }
const dbPath = require.resolve(path.join(ROOT, 'src/lib/db-client.js'))
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    prisma: {
      user: {
        findUnique: async () => ({ level: 5, str: 10, dex: 10, mag: 10, def: 10, strMod: 0, dexMod: 0, magMod: 0, defMod: 0, ...player }),
        update: async () => ({}),
      },
      playerItem: { findMany: async () => [], findFirst: async () => null },
      $queryRawUnsafe: async (sql, ...params) => {
        rawStatements.push({ sql, params })
        // applyEnemyHit's RETURNING row; nothing else in these tests reads one.
        return [{ hp: player.hp, hpMax: player.hpMax, mp: player.mp, mpMax: player.mpMax, magicArmorAmount: 0, poisonClicks: 0, prevArmor: 0, prevPoison: 0 }]
      },
    },
  },
}

const servicePath = require.resolve(path.join(ROOT, 'src/lib/game-engine/services/present-enemy-service.js'))
require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: { savePresentEnemy: async () => {}, loadPresentEnemy: async () => null },
}

const { guardListener, readChatText } = require(path.join(ROOT, 'src/lib/socket-guards.js'))
const { CHAT_MESSAGE_MAX_LENGTH } = require(path.join(ROOT, 'src/lib/game-data/constants.js'))
const { executePlayerAttack } = require(path.join(ROOT, 'src/lib/game-engine/battle-action-handlers.js'))
const { BattleState } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))
const { RoomState } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))

const chargedMp = () => rawStatements.filter((s) => /SET mp = mp -/.test(s.sql))

// --- The socket listeners ----------------------------------------------------

test('a listener that throws — now or later — never escapes the guard', async () => {
  const errors = []
  const original = console.error
  console.error = (...args) => errors.push(args)
  try {
    await guardListener('sync', () => { throw new Error('sync boom') })()
    await guardListener('async', async () => { throw new Error('async boom') })()
    // The shape of the original crash: an async listener reading a property
    // off a payload the client never sent.
    await guardListener('chat', async (data) => data.message)()
  } finally {
    console.error = original
  }
  assert.equal(errors.length, 3)
})

test('a guarded listener still receives its arguments', async () => {
  let seen = null
  await guardListener('x', (a, b) => { seen = [a, b] })('one', 'two')
  assert.deepEqual(seen, ['one', 'two'])
})

test('chat text is read from anything a client can send without throwing', () => {
  for (const payload of [undefined, null, 0, 'text', [], {}, { message: null }, { message: 42 }, { message: {} }, { message: { toString: 1 } }]) {
    assert.equal(readChatText(payload), '', `payload ${JSON.stringify(payload)}`)
  }
  assert.equal(readChatText({ message: '  hello  ' }), 'hello')
})

test('chat text is capped, in the socket layer and in the engine alike', () => {
  const long = 'x'.repeat(CHAT_MESSAGE_MAX_LENGTH * 4)
  assert.equal(readChatText({ message: long }).length, CHAT_MESSAGE_MAX_LENGTH)

  // The engine's own chat action is reachable as a plain game action, which
  // never passes through readChatText — and its result goes to everyone.
  const room = new RoomState('001')
  room.addPlayer({ id: 'p1', username: 'a', hp: 10 })
  const result = room.executeChat({ type: 'chat', data: { message: long } }, 'p1')
  assert.equal(result.broadcastEvents[0].payload.message.length, CHAT_MESSAGE_MAX_LENGTH)

  const notText = room.executeChat({ type: 'chat', data: { message: { toString: 1 } } }, 'p1')
  assert.equal(notText.success, false)
})

test('the server and client chat limits agree', () => {
  const { MESSAGE_MAX_LENGTH } = require(path.join(ROOT, 'src/lib/sanitization.ts'))
  assert.equal(MESSAGE_MAX_LENGTH, CHAT_MESSAGE_MAX_LENGTH)
})

// --- Battle actions ----------------------------------------------------------

const fightingRoom = () => {
  const room = {
    roomId: '001',
    players: new Map([['p1', { id: 'p1', username: 'a', hp: 100, mp: 5 }]]),
    activeBattles: new Map(),
    updatePlayer: () => {},
    touchActivity: () => {},
    setPresentEnemy: () => {},
  }
  const enemy = { slug: 'dummy', name: 'Dummy', hp: 100000, att: 0, def: 0, damageType: 'MELEE', xpReward: 0, goldMin: 0, goldMax: 0 }
  const stats = { level: 5, str: 10, dex: 10, mag: 10, def: 10, strMod: 0, dexMod: 0, magMod: 0, defMod: 0, hp: 100, hpMax: 100 }
  room.activeBattles.set('p1', new BattleState({ playerId: 'p1', roomId: '001', enemy, playerStats: stats }))
  return room
}

test('a spell forged into action.data is ignored: no MP moves, the swing is a plain one', async () => {
  rawStatements.length = 0
  const room = fightingRoom()
  const forged = { cost: -9999, level: 99, def: { id: 'x', name: 'Free Lunch' } }

  const result = await executePlayerAttack({ type: 'player_attack', data: { spell: forged, skill: forged } }, 'p1', room)

  assert.equal(result.success, true)
  assert.equal(chargedMp().length, 0, 'no MP statement may run for a client-supplied spell')
  const turn = result.playerEvents.find((e) => e.event === 'battle:turn')?.payload
  assert.ok(turn, 'the turn still resolves, as a weapon swing')
  assert.equal(turn.spell, null)
  assert.equal(turn.skill, null)
  assert.equal(turn.playerMp, undefined)
})

test('a cost that is not a whole number of zero or more is never charged', async () => {
  // Server-side callers put the spell on the action itself. Even there, a cost
  // the statement would turn into a grant is refused before it reaches the row.
  for (const cost of [-1, -9999, 1.5, '3', null, undefined, NaN]) {
    rawStatements.length = 0
    const room = fightingRoom()
    const spell = { cost, level: 1, def: { id: 'x', name: 'Bad Cost', roll: () => ({ damage: 1 }) } }
    await assert.rejects(
      () => executePlayerAttack({ type: 'player_attack', spell }, 'p1', room),
      /invalid MP cost/,
      `cost ${String(cost)}`
    )
    assert.equal(chargedMp().length, 0)
  }
})

// --- Room actions ------------------------------------------------------------

test('no action of any kind runs for a player who is not in the room', async () => {
  // Room 210 is the Grand Square: a fountain, a workbench, a sign. Its craft
  // handler is a plain function that never checked who was asking.
  const room = new RoomState('210')
  for (const type of ['craft', 'read sign', 'rest at fountain', 'search', 'look', 'no such action']) {
    const result = await room.executeAction({ type, data: {} }, 'ghost', 0, 0)
    assert.equal(result.success, false, type)
    assert.match(result.playerEvents?.[0]?.payload?.message ?? result.message ?? '', /not found in this room/i, type)
  }
})
