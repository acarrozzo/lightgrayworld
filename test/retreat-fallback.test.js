/**
 * Where a retreat falls back to.
 *
 * A retreat falls back through a walked exit and nothing else. `previousRoom`,
 * the only thing the flee handler reads for its destination, is written by a
 * directional step and cleared by every other way of arriving: a teleport, a
 * rise from death, a retreat's own fall-back. Before this, a teleport wrote it
 * too, and retreating from an ambush in a lair you had just teleported into was
 * a free, uncharged teleport back to wherever you came from.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// Nothing here touches a database; the module's dependencies only need a
// prisma-shaped export to load. The world-feed service is stubbed because its
// TypeScript mirror requires its own JavaScript twin by name, which under tsx
// resolves back to the mirror and trips on itself.
const stub = (rel, exports) => {
  const file = require.resolve(path.join(ROOT, rel))
  require.cache[file] = { id: file, filename: file, loaded: true, exports }
}
stub('src/lib/db-client.js', { prisma: {} })
stub('src/lib/services/world-feed-event-service.js', { createWorldFeedEvent: async () => {}, WORLD_FEED_EVENT_TYPES: [] })

const { createTransitionPlayerRoom } = require(path.join(ROOT, 'src/lib/socket-server-handlers.js'))

function harness() {
  const updates = []
  const prisma = {
    user: {
      update: async ({ data }) => {
        updates.push(data)
        return {}
      },
    },
  }
  const sink = { emit: () => {} }
  const io = { to: () => sink, emit: () => {}, sockets: { sockets: new Map() } }
  const socket = { id: 'sock:p1', join: () => {}, leave: () => {}, to: () => sink }
  const transition = createTransitionPlayerRoom(io, prisma, socket, new Map(), new Map(), null)
  const player = { id: 'p1', username: 'P1', level: 3, currentRoom: '001', previousRoom: null }
  return { transition, player, updates }
}

test('a walked step records the room stepped from', async () => {
  const { transition, player, updates } = harness()
  await transition({ player, fromRoom: '001', toRoom: '002', exitDirection: 'north', entryDirection: 'south', walked: true })
  assert.equal(player.currentRoom, '002')
  assert.equal(player.previousRoom, '001')
  assert.deepEqual(updates.at(-1), { currentRoom: '002', previousRoom: '001' })
})

test('a teleport forgets the room it left, so a retreat cannot fall back across the world', async () => {
  const { transition, player, updates } = harness()
  await transition({ player, fromRoom: '001', toRoom: '002', exitDirection: 'north', entryDirection: 'south', walked: true })
  await transition({ player, fromRoom: '002', toRoom: '507', exitDirection: null, entryDirection: null, isTeleport: true })
  assert.equal(player.currentRoom, '507')
  assert.equal(player.previousRoom, null)
  assert.deepEqual(updates.at(-1), { currentRoom: '507', previousRoom: null })
})

test("a retreat's own fall-back is not a walk, so two retreats cannot bounce back into the first fight", async () => {
  const { transition, player } = harness()
  // Walked 104 -> 105, got jumped, retreated to 104: next door, but by grant.
  await transition({ player, fromRoom: '104', toRoom: '105', exitDirection: 'east', entryDirection: 'west', walked: true })
  await transition({ player, fromRoom: '105', toRoom: '104', exitDirection: 'west', entryDirection: 'east', walked: false })
  assert.equal(player.currentRoom, '104')
  assert.equal(player.previousRoom, null)
})

test('the live record and the durable write agree either way', async () => {
  const { transition, player, updates } = harness()
  await transition({ player, fromRoom: '001', toRoom: '999', exitDirection: null, entryDirection: null, isTeleport: true })
  assert.equal(updates.at(-1).previousRoom, player.previousRoom)
  await transition({ player, fromRoom: '999', toRoom: '001', exitDirection: 'down', entryDirection: 'up', walked: true })
  assert.equal(updates.at(-1).previousRoom, player.previousRoom)
  assert.equal(player.previousRoom, '999')
})
