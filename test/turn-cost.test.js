/**
 * What costs a turn.
 *
 * The original spent a turn on every input, because a turn *was* a page load:
 * the room script rolled its encounter table before it had even looked at what
 * you typed, and `battle.php`, once included, ran its enemy-attack loop whether
 * you had attacked, mined, searched or mistyped. That is why standing in a mine
 * swinging a pickaxe was exactly as dangerous as standing there doing nothing.
 *
 * Here a turn is deliberate: RoomState.resolveTurn is the one place that spends
 * one, room actions are classified by isTurnCostingRoomAction, and the actions
 * that are only ever information stay free.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// Stub the database before RoomState loads it — no Postgres is touched. Leaving
// a room mid-fight clears the player's `inFight` flag through Prisma, and the
// proxy in db-client throws on first property access when DATABASE_URL is unset
// (as it is in CI), so this has to be in place before the require below.
const userUpdates = []
const dbPath = require.resolve(path.join(ROOT, 'src/lib/db-client.js'))
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    prisma: {
      user: {
        update: async (args) => {
          userUpdates.push(args)
          return {}
        },
      },
    },
  },
}

// Stub persistence before RoomState loads it — no database is touched.
const servicePath = require.resolve(path.join(ROOT, 'src/lib/game-engine/services/present-enemy-service.js'))
require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: { savePresentEnemy: async () => {}, loadPresentEnemy: async () => null },
}

// Stub the battle handlers so a spawn and a support turn can be observed
// without a fight, a player row, or a database behind either.
const battleCalls = { startBattle: [], supportTurn: [] }
const battlePath = require.resolve(path.join(ROOT, 'src/lib/game-engine/battle-action-handlers.js'))
require.cache[battlePath] = {
  id: battlePath,
  filename: battlePath,
  loaded: true,
  exports: {
    executeStartBattle: async (action, playerId) => {
      battleCalls.startBattle.push({ playerId, data: action.data })
      return { success: true, action: 'start_battle', playerEvents: [{ event: 'battle:start', payload: {} }] }
    },
    resolveSupportTurn: async (playerId, roomState, meta) => {
      battleCalls.supportTurn.push({ playerId, roomId: roomState.roomId, meta })
      return { playerEvents: [{ event: 'battle:turn', payload: { actionMeta: meta } }] }
    },
    executePlayerAttack: async () => ({ success: true }),
    executePlayerFlee: async () => ({ success: true }),
    fetchEquippedWeapon: async () => null,
  },
}

const { RoomState } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))
const { isTurnCostingRoomAction, ROOM_ACTIONS } = require(path.join(ROOT, 'src/lib/game-engine/room-action-handlers.js'))

/** A probabilistic room deep in the mine: 40% a turn, everything in it hostile. */
const MINE = '311-07'

// Holds the stub for the whole of an async body — restoring it when `fn()`
// merely returns its promise would leave the roll itself running on the real
// Math.random, and the test passing or failing by luck.
const withRandom = async (value, fn) => {
  const original = Math.random
  Math.random = () => value
  try {
    return await fn()
  } finally {
    Math.random = original
  }
}

const ok = (extra = {}) => ({ success: true, action: 'mine here', playerEvents: [], ...extra })

test.beforeEach(() => {
  battleCalls.startBattle.length = 0
  battleCalls.supportTurn.length = 0
})

// ── classification ───────────────────────────────────────────────────────────

test('a room action that changes the world costs a turn', () => {
  assert.equal(isTurnCostingRoomAction(MINE, 'mine here'), true)
  assert.equal(isTurnCostingRoomAction('117', 'chop wood'), true)
  assert.equal(isTurnCostingRoomAction('016', 'shovel sand'), true)
  assert.equal(isTurnCostingRoomAction('119', 'open gold chest'), true)
  assert.equal(isTurnCostingRoomAction('511', 'flip lever'), true)
  assert.equal(isTurnCostingRoomAction('020', 'rest at waterfall'), true)
})

test('reading, talking, examining and shopping stay free', () => {
  assert.equal(isTurnCostingRoomAction('001', 'read sign'), false)
  assert.equal(isTurnCostingRoomAction('210', 'read sign'), false)
  assert.equal(isTurnCostingRoomAction('021', 'talk to old man'), false)
  assert.equal(isTurnCostingRoomAction('216', 'view shop'), false)
  assert.equal(isTurnCostingRoomAction('524', 'peer into the despair'), false)
})

test('a summon button and a guild teleport are not turns — one is the fight, one is a step', () => {
  assert.equal(isTurnCostingRoomAction('523', 'challenge the troll king'), false)
  assert.equal(isTurnCostingRoomAction('504', 'fight highwayman'), false)
  assert.equal(isTurnCostingRoomAction('225', 'teleport to kobold lair'), false)
})

test('every room action is classified, and an unknown one is not a turn', () => {
  for (const [roomId, actions] of Object.entries(ROOM_ACTIONS)) {
    for (const name of Object.keys(actions)) {
      assert.equal(typeof isTurnCostingRoomAction(roomId, name), 'boolean', `${roomId}/${name}`)
    }
  }
  assert.equal(isTurnCostingRoomAction(MINE, 'polish the walls'), false)
  assert.equal(isTurnCostingRoomAction('no-such-room', 'mine here'), false)
})

// ── spending the turn, out of battle ─────────────────────────────────────────

test('a turn action in a probabilistic room rolls, and a hostile roll engages', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  const result = await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))

  assert.equal(result.turnResolved, true)
  assert.equal(battleCalls.startBattle.length, 1)
  // Caught mid-swing: a freshly rolled enemy gets the ambush hit.
  assert.equal(battleCalls.startBattle[0].data.isAutoInitiated, true)
  assert.ok(room.getPresentEnemy('p1'))
})

test('a roll that comes up empty leaves the room empty', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  await withRandom(0.99, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))

  assert.equal(battleCalls.startBattle.length, 0)
  assert.equal(room.getPresentEnemy('p1'), null)
})

test('a failed action and a no-op action both cost nothing', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  const failed = await withRandom(0, () => room.resolveTurn(ok({ success: false }), 'p1', {}))
  const noOp = await withRandom(0, () => room.resolveTurn(ok({ noTurn: true }), 'p1', {}))

  assert.equal(failed.turnResolved, undefined)
  assert.equal(noOp.turnResolved, undefined)
  assert.equal(battleCalls.startBattle.length, 0)
  assert.equal(room.getPresentEnemy('p1'), null)
})

test('a turn is spent once — a handler that already resolved is not charged again', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  const first = await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'use_item' }))
  const again = await withRandom(0, () => room.resolveTurn(first, 'p1', { kind: 'use_item' }))

  assert.equal(again, first)
  assert.equal(battleCalls.startBattle.length, 1)
})

// ── the post-win grace turn (the original's `endfight`) ───────────────────────

test('the turn after a win is safe, and the one after that is not', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  // What the battle-win teardown does: the slot is emptied, with grace.
  room.setPresentEnemy('p1', null, { grace: true })

  // One safe swing — a roll that would otherwise have succeeded rolls nothing.
  await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle.length, 0)
  assert.equal(room.getPresentEnemy('p1'), null)

  // And it is spent: the next one is exposed again.
  await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle.length, 1)
})

test('grace does not travel — leaving the room drops it', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
  room.setPresentEnemy('p1', null, { grace: true })

  room.removePlayer('p1')
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle.length, 1)
})

// ── spending the turn, in battle ─────────────────────────────────────────────

test('in a fight the enemy answers, and the room rolls nothing', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
  room.activeBattles.set('p1', { isActive: true })

  const mined = {
    success: true,
    action: 'mine here',
    playerEvents: [{ event: 'action:feedback', payload: { message: 'You mine some Coal.' } }],
  }
  const result = await withRandom(0, () =>
    room.resolveTurn(mined, 'p1', { kind: 'room_action', label: 'Mine here', text: 'You mine some Coal.' })
  )

  assert.equal(battleCalls.supportTurn.length, 1)
  assert.equal(battleCalls.supportTurn[0].meta.text, 'You mine some Coal.')
  // No second enemy called out of the dark while one is already swinging.
  assert.equal(battleCalls.startBattle.length, 0)
  // The action's own feedback survives alongside the enemy's answer.
  assert.equal(result.playerEvents.length, 2)
  assert.equal(result.playerEvents[1].event, 'battle:turn')
})

// ── leaving a fight ──────────────────────────────────────────────────────────
//
// A step is still refused mid-fight, but a teleport is not: it was the
// original's escape hatch (`function-teleport.php` cleared `infight`
// unconditionally, and the Spider Cave's sign says to use it), and Retreat is
// a teleport too. What you run from stays standing in the room.

const moveAction = (toRoom, extra = {}) => ({ type: 'move', data: { toRoom }, ...extra })

test('a step out of a fight is refused; a teleport is not', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
  room.activeBattles.set('p1', { isActive: true, enemyName: 'Iron Golem', end() {} })

  const walked = await room.executeMove(moveAction('311-06'), 'p1')
  assert.equal(walked.success, false)

  const teleported = await room.executeMove(moveAction('001', { authorizedMove: true }), 'p1')
  assert.equal(teleported.success, true)
})

test('a hostile pins you in the room, but never against a teleport', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
  room.setPresentEnemy('p1', 'iron-golem')
  assert.equal(room.hasHostileEnemy('p1'), true)

  const walked = await room.executeMove(moveAction('311-06'), 'p1')
  assert.equal(walked.success, false)

  const teleported = await room.executeMove(moveAction('001', { authorizedMove: true }), 'p1')
  assert.equal(teleported.success, true)
})

test('teleporting out of a fight carries the enemy back to the room, and closes the deck', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
  room.setPresentEnemy('p1', 'iron-golem')
  room.activeBattles.set('p1', { isActive: true, enemyName: 'Iron Golem', end() { this.isActive = false } })

  const result = await room.executeMove(moveAction('001', { authorizedMove: true }), 'p1')

  // The enemy rides along on the transfer, so returning finds it standing there.
  assert.equal(result.transfer.fromRoomEnemy, 'iron-golem')
  // And the client is told to close the fight — nothing else on the move path does.
  const fled = result.playerEvents.find((e) => e.event === 'battle:fled')
  assert.ok(fled, 'a teleport out of a fight emits battle:fled')
  // No return trip: this move *is* the escape.
  assert.equal(fled.payload.returnRoomId, null)
  // The fight itself is over — in memory and on the player's row, so a refresh
  // does not come back still flagged as fighting.
  assert.equal(room.activeBattles.has('p1'), false)
  const cleared = userUpdates.find((u) => u.where?.id === 'p1' && u.data?.inFight === false)
  assert.ok(cleared, 'leaving a fight clears inFight')
})

test('an ordinary teleport out of an empty room says nothing about a fight', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  const result = await room.executeMove(moveAction('001', { authorizedMove: true }), 'p1')
  assert.equal(result.playerEvents.some((e) => e.event === 'battle:fled'), false)
})

test('retreat is open on the first turn, and the enemy it left is still there at full HP', () => {
  const { BattleState } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))
  const { getEnemy } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
  const enemy = getEnemy('iron-golem')
  const stats = { str: 10, dex: 10, mag: 10, def: 10, hp: 50, hpMax: 50, level: 10 }

  const first = new BattleState({ playerId: 'p1', roomId: MINE, enemy, playerStats: stats })
  assert.equal(first.canFlee, true, 'no three-turn lock on retreat')

  // Whatever was knocked off it is not carried into the next fight: every
  // BattleState is built from the enemy definition.
  first.applyDamageToEnemy(enemy.hp - 1)
  assert.equal(first.enemyCurrentHp, 1)

  const rematch = new BattleState({ playerId: 'p1', roomId: MINE, enemy, playerStats: stats })
  assert.equal(rematch.enemyCurrentHp, enemy.hp)
})

// ── the retreat's far end ────────────────────────────────────────────────────
//
// The original's retreat set `endfight = 1` along with the room change, so the
// room you fell back into printed "This room is safe." and rolled nothing.
// Falling out of one ambush straight into another is what makes retreating
// pointless, so that grace crosses with the player.

test('a grace turn can be granted on arrival without disturbing what is standing there', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
  room.setPresentEnemy('p1', 'iron-rat')

  room.grantGraceTurn('p1')
  assert.equal(room.getPresentEnemy('p1'), 'iron-rat', 'the room is unchanged; only the player is spared')

  // The first action after falling back is free...
  await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle.length, 0)

  // ...and the second is not: what was waiting engages.
  await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle.length, 1)
  assert.equal(battleCalls.startBattle[0].data.enemySlug, 'iron-rat')
  // Not an ambush: it was already there in plain sight, not sprung on arrival.
  assert.equal(battleCalls.startBattle[0].data.isAutoInitiated, false)
})

test('grace can be granted to a player the room has never rolled for', async () => {
  const room = new RoomState(MINE)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  room.grantGraceTurn('p1')
  await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))
  assert.equal(battleCalls.startBattle.length, 0)
  assert.equal(room.getPresentEnemy('p1'), null, 'nothing was rolled into the empty slot')
})

test('a retreat grant is single-use, room-specific, and carries its safe arrival', () => {
  const grants = require(path.join(ROOT, 'src/lib/game-engine/teleport-grants.js'))

  grants.grantTeleport('p1', '311-06', { safeArrival: true })
  assert.equal(grants.consumeTeleportGrant('p1', '311-07'), null, 'a different room does not claim it')
  const claimed = grants.consumeTeleportGrant('p1', '311-06')
  assert.deepEqual(claimed, { roomId: '311-06', safeArrival: true })
  assert.equal(grants.consumeTeleportGrant('p1', '311-06'), null, 'and it is spent')

  // A guild lair or a respawn is a grant too, but it says nothing about arriving.
  grants.grantTeleport('p2', '225')
  assert.deepEqual(grants.consumeTeleportGrant('p2', '225'), { roomId: '225', safeArrival: false })
})
