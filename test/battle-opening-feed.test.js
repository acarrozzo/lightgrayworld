/**
 * One feed row for a fight's opening.
 *
 * Walking into an ogre used to write four rows: the spawn line, the room's
 * third-person broadcast (which the actor's own socket also receives), a
 * client-made "You engage" line, and the first turn. The first turn is the
 * one BATTLE row now. The server marks the other two so the client can keep
 * their data and drop their words: a spawn says `engages` when a fight's own
 * events follow it, and a room broadcast about a player's fight is signed with
 * that player's id. The article in front of the enemy's name is decided in
 * one helper, so "A Ogre" cannot come back.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

const dbPath = require.resolve(path.join(ROOT, 'src/lib/db-client.js'))
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { prisma: { user: { update: async () => ({}) } } },
}
const servicePath = require.resolve(path.join(ROOT, 'src/lib/game-engine/services/present-enemy-service.js'))
require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: { savePresentEnemy: async () => {}, loadPresentEnemy: async () => null },
}
const battlePath = require.resolve(path.join(ROOT, 'src/lib/game-engine/battle-action-handlers.js'))
require.cache[battlePath] = {
  id: battlePath,
  filename: battlePath,
  loaded: true,
  exports: {
    executeStartBattle: async () => ({ success: true, action: 'start_battle', playerEvents: [{ event: 'battle:started', payload: {} }] }),
    resolveSupportTurn: async () => ({ playerEvents: [] }),
    executePlayerAttack: async () => ({ success: true }),
    executePlayerFlee: async () => ({ success: true }),
    fetchEquippedWeapon: async () => null,
    readAmmo: async () => null,
    ammoDisplayName: async (slug) => slug,
  },
}

const { withArticle } = require(path.join(ROOT, 'src/lib/game-data/grammar.js'))
const { RoomState } = require(path.join(ROOT, 'src/lib/game-data/../game-engine/room-state.js'))
const { getEnemy } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
const { getRoomEnemies, isProbabilistic } = require(path.join(ROOT, 'src/lib/game-data/room-enemies.js'))

const withRandom = async (value, fn) => {
  const original = Math.random
  Math.random = () => value
  try {
    return await fn()
  } finally {
    Math.random = original
  }
}

const ok = (extra = {}) => ({ success: true, action: 'search', playerEvents: [], ...extra })

/**
 * Spend a turn in each probabilistic room with the dice pinned at 0 until one
 * hostile and one neutral spawn have been seen; the data decides which rooms.
 */
async function rollBothTemperaments() {
  const { ROOM_ENEMIES } = require(path.join(ROOT, 'src/lib/game-data/room-enemies.js'))
  const seen = { hostile: null, neutral: null }
  for (const roomId of Object.keys(ROOM_ENEMIES)) {
    if (!isProbabilistic(roomId)) continue
    const room = new RoomState(roomId)
    room.addPlayer({ id: 'p1', username: 'a', hp: 50 })
    // The turn itself, with a stub action result in front of it, as turn-cost does.
    const result = await withRandom(0, () => room.resolveTurn(ok(), 'p1', { kind: 'room_action' }))
    const spawn = (result.playerEvents ?? []).find((e) => e.payload?.action === 'enemy_spawn')
    if (!spawn) continue
    const key = spawn.payload.data.enemy.isAggressive ? 'hostile' : 'neutral'
    if (!seen[key]) seen[key] = { roomId, spawn }
    if (seen.hostile && seen.neutral) break
  }
  return seen
}

test('the article follows the name', () => {
  assert.equal(withArticle('Ogre'), 'an Ogre')
  assert.equal(withArticle('Fox'), 'a Fox')
  assert.equal(withArticle('Ice Elemental', { cap: true }), 'An Ice Elemental')
  assert.equal(withArticle('Bandit', { cap: true }), 'A Bandit')
})

test('a turn’s roll marks the spawn by temperament: hostile engages, neutral does not', async () => {
  const { hostile, neutral } = await rollBothTemperaments()
  assert.ok(hostile && neutral, 'both temperaments roll somewhere in the data')

  assert.equal(hostile.spawn.payload.data.engages, true, `${hostile.roomId}: a hostile spawn attacks, so the turn is the feed row`)
  assert.equal(neutral.spawn.payload.data.engages, false, `${neutral.roomId}: a neutral spawn is the only line, so it stays`)
  for (const { spawn } of [hostile, neutral]) {
    assert.match(spawn.payload.message, /^An? [A-Z]/, 'the line opens with the article and the name')
    assert.doesNotMatch(spawn.payload.message, /\bA [AEIOUaeiou]/, 'no "A Ogre"')
    assert.ok(spawn.payload.data.enemy, 'the room card still gets the enemy')
  }
})

test('a hunt’s spawn always says a fight follows', async () => {
  const { hostile, neutral } = await rollBothTemperaments()
  const roomId = (neutral ?? hostile).roomId
  const room = new RoomState(roomId)
  room.addPlayer({ id: 'p1', username: 'a', hp: 50 })

  const result = await withRandom(0, () => room.executeAttack('p1'))
  const spawn = result.playerEvents.find((e) => e.payload?.action === 'enemy_spawn')
  assert.ok(spawn, 'the client is told what came out')
  assert.equal(spawn.payload.data.engages, true, 'the player swings at whatever answers, hostile or not')
  assert.equal(spawn.payload.data.enemy.slug, room.getPresentEnemy('p1'))
})
