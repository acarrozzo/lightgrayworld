/**
 * Travelers: who moves, and where they are.
 *
 * Two promises are pinned here. A route traveler's room is a pure function of
 * the clock, so every process gives the same answer and a shop on wheels can be
 * trusted by the buy route. A wanderer moves only between adjacent rooms of its
 * range, announces both ends of the move, and a killed bunny is gone for
 * everyone until its respawn.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const travelers = require(path.join(ROOT, 'src/lib/game-data/travelers.js'))
const state = require(path.join(ROOT, 'src/lib/game-engine/traveler-state.js'))
const { getShopsAt } = require(path.join(ROOT, 'src/lib/game-data/shops.js'))
const { getEnemy } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))

const merchant = travelers.getTraveler('merchant')
const bunny = travelers.getTraveler('bunny')

// A fake socket server that records what went to which room.
function fakeIo() {
  const sent = []
  return {
    sent,
    to(room) {
      return { emit: (event, payload) => sent.push({ room, event, payload }) }
    },
  }
}

test.beforeEach(() => state.reset())

test('the merchant loop is anchored to the clock: same time, same room, on any process', () => {
  const period = travelers.routePeriodMs(merchant)
  const t = 1_800_000_000_000
  assert.equal(travelers.routeRoomAt(merchant, t), travelers.routeRoomAt(merchant, t + period))
  assert.equal(travelers.routeRoomAt(merchant, t), travelers.routeRoomAt(merchant, t + 3 * period))
  // Walk one full period a second at a time and collect the stops in order.
  const seen = []
  for (let now = 0; now < period; now += 1000) {
    const room = travelers.routeRoomAt(merchant, now)
    if (seen.at(-1) !== room) seen.push(room)
  }
  assert.deepEqual(seen, merchant.movement.stops.map((s) => s.roomId))
})

test('the cart trades wherever the merchant stands, with the region wares added', () => {
  const inForest = merchant.movement.stops.findIndex((s) => s.region === 'forest')
  let now = 0
  for (let i = 0; i < inForest; i += 1) now += merchant.movement.stops[i].dwellMs
  const room = travelers.routeRoomAt(merchant, now)
  const shops = getShopsAt(room, now)
  assert.equal(shops.length, 1)
  assert.equal(shops[0].name, "Wendell's Cart")
  assert.ok(shops[0].stock.includes('wood'), 'forest wares on the cart in the forest')
  assert.ok(!shops[0].stock.includes('veggies'), 'red town wares stay in red town')
  // The General Store keeps trading when he is not there, and both trade when he is.
  assert.deepEqual(getShopsAt('006', now).map((s) => s.name), ['General Store'])
  const at006 = merchant.movement.stops[0].dwellMs // right after the first stop
  assert.deepEqual(getShopsAt('006', at006).map((s) => s.name), ['General Store', "Wendell's Cart"])
})

test('a wanderer is seeded inside its range and moves only to an adjacent room of it', () => {
  const io = fakeIo()
  state.start({ io, now: 0, timer: false })
  const start = state.roomIdOf('bunny', 0)
  assert.ok(bunny.movement.rooms.includes(start))
  // Long after any move is due, one tick moves it once.
  state.tick(10 * 60 * 1000)
  const after = state.roomIdOf('bunny', 10 * 60 * 1000)
  assert.ok(bunny.movement.rooms.includes(after))
  assert.notEqual(after, start)
  const neighbours = travelers.wanderExits(bunny, start).map((e) => e.to)
  assert.ok(neighbours.includes(after), `${after} is next to ${start}`)
  // Both rooms heard about it, each with the room's fresh list.
  const rooms = io.sent.filter((m) => m.event === state.ROOM_TRAVELERS_EVENT).map((m) => m.room)
  assert.ok(rooms.includes(`room-${start}`) && rooms.includes(`room-${after}`))
  const arrival = io.sent.find((m) => m.room === `room-${after}` && m.payload.travelers.some((v) => v.id === 'bunny'))
  assert.ok(arrival, 'the destination list now has the bunny')
  assert.match(arrival.payload.line.message, /from the (north|south|east|west|northeast|northwest|southeast|southwest)/)
})

test('a killed bunny is gone for everyone until it respawns, and a second kill changes nothing', () => {
  const io = fakeIo()
  state.start({ io, now: 0, timer: false })
  const room = state.roomIdOf('bunny', 0)
  assert.equal(state.onTravelerKilled('bunny', room, 1000), true)
  assert.equal(state.roomIdOf('bunny', 1000), null)
  assert.equal(state.isTravelerInRoom('bunny', room, 1000), false)
  assert.equal(state.onTravelerKilled('bunny', room, 2000), false)
  const gone = io.sent.find((m) => m.room === `room-${room}`)
  assert.equal(gone.payload.travelers.some((v) => v.id === 'bunny'), false)
  // Not back one second early; back at the respawn time, somewhere in range.
  state.tick(1000 + bunny.respawnMs - 1000)
  assert.equal(state.roomIdOf('bunny', 1000 + bunny.respawnMs - 1000), null)
  state.tick(1000 + bunny.respawnMs)
  const back = state.roomIdOf('bunny', 1000 + bunny.respawnMs)
  assert.ok(bunny.movement.rooms.includes(back))
})

test('the bunny is a real, neutral enemy that no room table places', () => {
  const enemy = getEnemy('bunny')
  assert.ok(enemy)
  assert.equal(enemy.isAggressive, false)
  const { ROOM_ENEMIES } = require(path.join(ROOT, 'src/lib/game-data/room-enemies.js'))
  for (const [roomId, config] of Object.entries(ROOM_ENEMIES)) {
    const slugs = config.enemies.map((e) => (typeof e === 'string' ? e : e.slug))
    assert.ok(!slugs.includes('bunny'), `${roomId} should not place the bunny`)
  }
})

test('a traveler view carries the enemy card numbers and the actions', () => {
  state.start({ now: 0, timer: false })
  const room = state.roomIdOf('bunny', 0)
  const [view] = state.listTravelersInRoom(room, 0).filter((v) => v.id === 'bunny')
  assert.equal(view.enemy.slug, 'bunny')
  assert.deepEqual(view.actions.map((a) => a.action), ['watch bunny'])
  const merchantView = state.buildTravelerView(merchant, travelers.routeRoomAt(merchant, 0), 0)
  assert.ok(merchantView.leavesAt > 0)
  assert.equal(merchantView.enemy, null)
})

test('a kill heard in the fight room even after the bunny hopped on', () => {
  const io = fakeIo()
  state.start({ io, now: 0, timer: false })
  const fightRoom = state.roomIdOf('bunny', 0)
  state.tick(10 * 60 * 1000) // it has moved since the fight began
  const nowRoom = state.roomIdOf('bunny', 10 * 60 * 1000)
  assert.notEqual(nowRoom, fightRoom)
  io.sent.length = 0
  assert.equal(state.onTravelerKilled('bunny', fightRoom, 10 * 60 * 1000 + 1), true)
  const rooms = io.sent.map((m) => m.room)
  assert.ok(rooms.includes(`room-${fightRoom}`), 'the fight room hears it')
  assert.ok(rooms.includes(`room-${nowRoom}`), 'and so does where it was')
})

test('Sherman leaves within seconds of a fight starting in his room', () => {
  const io = fakeIo()
  state.start({ io, now: 0, timer: false })
  const sherman = travelers.getTraveler('sherman')
  const room = state.roomIdOf('sherman', 0)
  // Normally he has minutes; a fight brings that down to his flee delay.
  state.onBattleStarted(room, 0)
  state.tick(sherman.fleeDelayMs[1] + 1)
  assert.notEqual(state.roomIdOf('sherman', sherman.fleeDelayMs[1] + 1), room)
  const left = io.sent.find((m) => m.room === `room-${room}` && m.payload.line)
  assert.ok(sherman.lines.flee.some((l) => left.payload.line.message.startsWith(l.split('{')[0])), 'uses a flee line')
  // A fight somewhere else does not move him.
  state.reset()
  state.start({ io, now: 0, timer: false })
  const stay = state.roomIdOf('sherman', 0)
  state.onBattleStarted(stay === '001' ? '002' : '001', 0)
  state.tick(sherman.fleeDelayMs[1] + 1)
  assert.equal(state.roomIdOf('sherman', sherman.fleeDelayMs[1] + 1), stay)
})

test('a sign can promise when the cart is due', () => {
  const first = merchant.movement.stops[0]
  // Standing at the Crossroads at the start of the loop.
  const here = travelers.routeNextArrivalAt(merchant, '001', 1000)
  assert.equal(here.here, true)
  assert.equal(here.leavesAt, first.dwellMs)
  // One stop later, it is due back one full loop after it left.
  const away = travelers.routeNextArrivalAt(merchant, '001', first.dwellMs + 1000)
  assert.equal(away.here, false)
  assert.equal(away.arrivesAt, travelers.routePeriodMs(merchant))
  assert.equal(travelers.routeNextArrivalAt(merchant, '999', 0), null)
})
