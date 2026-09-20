/**
 * One process, two copies of a module, one state.
 *
 * The game engine loads src/lib through Node's own `require`. Next loads the
 * copy it bundled for its route handlers. Same file, two module instances — so
 * anything a module keeps at module level exists twice, and the HTTP room load
 * reads a copy the engine never wrote to. Levers, search reveals and wandering
 * travelers all did this: pull a lever, refresh, and the page drew it up again.
 *
 * Process-local state that a route reads has to live on `globalThis`. These
 * tests load each module twice, the way the two loaders do, and hold them to it.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

/** Load a module as a second, separate instance — what Next's bundle is to Node's. */
function loadTwice(relativePath) {
  const file = require.resolve(path.join(ROOT, relativePath))
  const first = require(file)
  delete require.cache[file]
  const second = require(file)
  assert.notEqual(first, second, 'the two loads must be distinct module instances')
  return [first, second]
}

test('a lever pulled in the engine is pulled for the room-load route', () => {
  const [engine, route] = loadTwice('src/lib/game-engine/lever-state.js')
  const lever = engine.KOBOLD_SWITCH
  assert.equal(route.isLeverPulled('p-lever', lever), false)

  engine.pullLever('p-lever', lever)
  assert.equal(route.isLeverPulled('p-lever', lever), true)

  engine.clearPlayerLevers('p-lever')
  assert.equal(route.isLeverPulled('p-lever', lever), false)
})

test('a passage revealed in the engine stays revealed for the room-load route', () => {
  const [engine, route] = loadTwice('src/lib/game-engine/search-reveal-state.js')
  const roomId = Object.keys(engine.REVEAL_DEFINITIONS).find((id) => !Array.isArray(engine.REVEAL_DEFINITIONS[id].stages))
  assert.ok(roomId, 'expected a single-exit reveal room to test with')

  // Hidden for everyone until found: the overlay masks the exit.
  assert.ok(route.getExitOverlay('p-reveal', roomId))

  engine.markRevealed('p-reveal', roomId)
  assert.equal(route.isRevealed('p-reveal', roomId), true)
  assert.equal(route.getExitOverlay('p-reveal', roomId), null)

  engine.clearPlayerReveals('p-reveal')
  assert.equal(route.isRevealed('p-reveal', roomId), false)
})

test('a wandering traveler is where the engine put it, for the room-load route too', () => {
  const [engine, route] = loadTwice('src/lib/game-engine/traveler-state.js')
  engine.reset()
  try {
    // Only the engine's copy is ever started; the route's copy only reads.
    engine.start({ io: null, now: 0, timer: false })
    const room = engine.roomIdOf('bunny', 0)
    assert.ok(room, 'the bunny should be somewhere once the engine has started')
    assert.equal(route.roomIdOf('bunny', 0), room)
    assert.ok(route.listTravelersInRoom(room, 0).some((t) => t.id === 'bunny'))
  } finally {
    engine.reset()
  }
})
