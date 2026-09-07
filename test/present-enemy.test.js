/**
 * One enemy per room per player.
 *
 * The original only ever had one enemy in front of you. RoomState keeps that as
 * a single per-player slot: a probabilistic room rolls for one enemy when the
 * slot is empty and never rolls again while something is there; a hostile one
 * blocks leaving, a neutral one does not; a win, flee or death empties the slot
 * and the persisted row with it.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// Stub the persistence service before RoomState loads it, so no database is
// touched and every write can be inspected.
const saves = []
const servicePath = require.resolve(path.join(ROOT, 'src/lib/game-engine/services/present-enemy-service.js'))
require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: {
    savePresentEnemy: async (userId, roomId, slug) => {
      saves.push({ userId, roomId, slug })
    },
    loadPresentEnemy: async () => null,
  },
}

const { RoomState } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))
const { getEnemy } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
const { getRoomEnemies, isProbabilistic } = require(path.join(ROOT, 'src/lib/game-data/room-enemies.js'))

const withRandom = (value, fn) => {
  const original = Math.random
  Math.random = () => value
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

test.beforeEach(() => {
  saves.length = 0
})

test('no room table lists more than one always-present enemy, and no table carries wave fields', () => {
  const { ROOM_ENEMIES } = require(path.join(ROOT, 'src/lib/game-data/room-enemies.js'))
  for (const [roomId, config] of Object.entries(ROOM_ENEMIES)) {
    assert.equal('maxEnemies' in config, false, `${roomId} still declares maxEnemies`)
    assert.equal('guaranteed' in config, false, `${roomId} still declares guaranteed`)
    assert.equal('priority' in config, false, `${roomId} still declares priority`)
    if (!config.probabilistic) {
      assert.equal(config.enemies.length, 1, `${roomId} is static but lists ${config.enemies.length} enemies`)
    }
  }
})

test('a static room never rolls; its enemy is simply there', () => {
  assert.equal(isProbabilistic('019'), false)
  const room = new RoomState('019')
  assert.equal(room.maybeSpawnEnemy('p1'), null)
  assert.equal(room.getPresentEnemy('p1'), null)
  assert.deepEqual(saves, [])
})

test('a probabilistic room rolls one enemy and holds it until it is gone', () => {
  const room = new RoomState('003b')
  const pool = getRoomEnemies('003b').enemies.map((e) => e.slug)

  // Math.random = 0 passes the spawn roll and picks the first pool entry.
  const spawned = withRandom(0, () => room.maybeSpawnEnemy('p1'))
  assert.equal(spawned, pool[0])
  assert.equal(room.getPresentEnemy('p1'), pool[0])
  assert.deepEqual(saves, [{ userId: 'p1', roomId: '003b', slug: pool[0] }])

  // Something is here: no second roll, even one that would succeed.
  assert.equal(withRandom(0, () => room.maybeSpawnEnemy('p1')), null)
  assert.equal(room.getPresentEnemy('p1'), pool[0])
  assert.equal(saves.length, 1)

  // A failed roll leaves the slot empty and writes nothing.
  const other = new RoomState('003b')
  assert.equal(withRandom(0.99, () => other.maybeSpawnEnemy('p2')), null)
  assert.equal(other.getPresentEnemy('p2'), null)
  assert.equal(saves.length, 1)
})

test('only a hostile present enemy blocks leaving', () => {
  const room = new RoomState('013')
  const neutral = getEnemy('rat')
  const hostile = getEnemy('gator')
  assert.equal(neutral.isAggressive, false)
  assert.equal(hostile.isAggressive, true)

  room.setPresentEnemy('p1', 'rat')
  assert.equal(room.hasHostileEnemy('p1'), false)

  room.setPresentEnemy('p1', 'gator')
  assert.equal(room.hasHostileEnemy('p1'), true)

  // Nothing present, nothing blocks.
  assert.equal(room.hasHostileEnemy('nobody'), false)
})

test('emptying the slot deletes the persisted row', () => {
  const room = new RoomState('013')
  room.setPresentEnemy('p1', 'gator')
  room.setPresentEnemy('p1', null)
  assert.equal(room.getPresentEnemy('p1'), null)
  assert.deepEqual(saves.at(-1), { userId: 'p1', roomId: '013', slug: null })

  room.setPresentEnemy('p1', 'gator')
  room.clearPlayerEnemyState('p1')
  assert.equal(room.getPresentEnemy('p1'), null)
  assert.deepEqual(saves.at(-1), { userId: 'p1', roomId: '013', slug: null })
})

test('a disconnect keeps the row so the enemy is restored on the next login', () => {
  const room = new RoomState('013')
  room.addPlayer({ id: 'p1', username: 'a' })
  room.setPresentEnemy('p1', 'gator')
  saves.length = 0
  room.removePlayer('p1')
  assert.equal(room.getPresentEnemy('p1'), null)
  assert.deepEqual(saves, [])
})
