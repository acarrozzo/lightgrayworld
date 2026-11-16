/**
 * Idle, on the server.
 *
 * Idle is a fact about a player, and it used to be stored as a fact about a
 * room: a "ghost" entry pinned to wherever they went quiet. So a follower
 * pulled along by their leader arrived looking awake, the room they left kept
 * a phantom of them, and a refresh (whose room list came from the database's
 * `isActive` column) forgot who was idle altogether. Four different pieces of
 * code built the list of who is in a room and no two of them agreed.
 *
 * These hold the replacement to it:
 *   - the sweep reports idle from the player's last activity, not from when it
 *     happened to notice, and writes nothing to the world feed;
 *   - idle lives on the presence entry and travels with the player;
 *   - one builder answers "who is here" for the socket and for both HTTP loads.
 *
 * The client half (labels, the Away tier, the "still here" throttle) is in
 * idle-labels.test.ts.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const { createIdleDetectionService } = require(path.join(ROOT, 'src/lib/services/idle-detection-service.js'))
const presence = require(path.join(ROOT, 'src/lib/services/presence-store.js'))
const ghosts = require(path.join(ROOT, 'src/lib/services/ghost-player-store.js'))
const { buildRoomOccupants, splitRoomOccupants, presenceFieldsFor } = require(
  path.join(ROOT, 'src/lib/services/room-occupants.js')
)

const MIN = 60 * 1000
const T0 = 1_800_000_000_000

function player(id, overrides = {}) {
  return {
    id,
    username: id.toUpperCase(),
    level: 5,
    hp: 30,
    hpMax: 40,
    mp: 10,
    mpMax: 12,
    currentRoom: '001',
    ...overrides,
  }
}

function resetStores() {
  presence.clearPresence()
  global.__ghostPlayerStore.clear()
}

// --- The sweep ---------------------------------------------------------------

test('idle is reported from the last activity, not from when the sweep noticed', async () => {
  let clock = T0
  const activePlayers = new Map([['s1', { ...player('ann'), lastActive: new Date(T0) }]])
  const seen = []
  const service = createIdleDetectionService({
    activePlayers,
    now: () => clock,
    onStateChange: (...args) => seen.push(args),
  })

  clock = T0 + 4 * MIN
  await service.runCheck()
  assert.deepEqual(seen, [], 'four minutes is not idle')

  // The sweep runs every 30 seconds, so it notices late. The time it reports
  // is still the moment the player went quiet.
  clock = T0 + 5 * MIN + 20_000
  await service.runCheck()
  assert.deepEqual(seen, [['ann', 'ANN', '001', true, T0]])

  await service.runCheck()
  assert.equal(seen.length, 1, 'staying idle is not a second transition')
})

test('an account is as active as its most recently used connection', async () => {
  let clock = T0
  const activePlayers = new Map([
    ['tab-1', { ...player('ann'), lastActive: new Date(T0) }],
    ['tab-2', { ...player('ann'), lastActive: new Date(T0 + 4 * MIN) }],
  ])
  const seen = []
  const service = createIdleDetectionService({ activePlayers, now: () => clock, onStateChange: (...a) => seen.push(a) })

  clock = T0 + 6 * MIN
  await service.runCheck()
  assert.deepEqual(seen, [], 'the second tab was used two minutes ago')
})

test('activity ends idle at once, and says it was idle exactly once', async () => {
  let clock = T0
  const live = { ...player('ann'), lastActive: new Date(T0) }
  const activePlayers = new Map([['s1', live]])
  const seen = []
  const service = createIdleDetectionService({ activePlayers, now: () => clock, onStateChange: (...a) => seen.push(a) })

  clock = T0 + 6 * MIN
  await service.runCheck()
  assert.equal(seen.length, 1)

  // What touchPlayerActivity does: stamp the player, then ask the sweep.
  live.lastActive = new Date(clock)
  assert.equal(service.markUserActive('ann'), true, 'the caller broadcasts the return itself')
  assert.equal(service.markUserActive('ann'), false, 'and only once')

  await service.runCheck()
  assert.equal(seen.length, 1, 'the sweep does not announce a return the caller already made')
})

test('the sweep writes nothing: no world feed line for idle or for coming back', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/lib/services/idle-detection-service.js'), 'utf8')
  assert.doesNotMatch(source, /require\(/, 'the idle service depends on nothing, the world feed included')

  const handlers = fs.readFileSync(path.join(ROOT, 'src/lib/socket-server-handlers.js'), 'utf8')
  assert.doesNotMatch(handlers, /eventType:\s*'(idle|return)'/, 'nothing posts an idle or return event')
})

// --- Idle belongs to the player ----------------------------------------------

test('a login is active; idle and its timestamp live on the presence entry', () => {
  resetStores()
  const entry = presence.setPresence(player('ann'))
  assert.equal(entry.status, 'active')
  assert.equal(entry.idleSince, null)

  presence.patchPresence('ann', { status: 'idle', idleSince: T0 })
  assert.deepEqual(presenceFieldsFor('ann'), { presenceStatus: 'idle', lastSeen: T0 })

  presence.patchPresence('ann', { status: 'active', idleSince: null })
  assert.deepEqual(presenceFieldsFor('ann'), { presenceStatus: 'active' })
})

test('an idle follower pulled to another room arrives idle and leaves no phantom', () => {
  resetStores()
  presence.setPresence(player('lead'))
  presence.setPresence(player('tail'))
  presence.patchPresence('tail', { status: 'idle', idleSince: T0 })

  // The leader walks; the follower is pulled. Only the room changes.
  presence.patchPresence('lead', { currentRoom: '002' })
  presence.patchPresence('tail', { currentRoom: '002' })

  assert.deepEqual(buildRoomOccupants('001'), [], 'nobody is left behind in the old room')

  const there = buildRoomOccupants('002')
  const tail = there.find((p) => p.id === 'tail')
  assert.equal(tail.presenceStatus, 'idle')
  assert.equal(tail.lastSeen, T0, 'still counted from when they went quiet')
  assert.equal(there.find((p) => p.id === 'lead').presenceStatus, 'active')
})

// --- One list of who is here -------------------------------------------------

test('the room list is the live players, then the ghosts of sessions that ended there', () => {
  resetStores()
  presence.setPresence(player('ann'))
  presence.setPresence(player('bob', { currentRoom: '009' }))
  presence.patchPresence('ann', { inBattle: true, battleEnemyName: 'Scorpion', partyLeaderId: 'ann' })
  ghosts.addGhost('001', player('cat'))

  const list = buildRoomOccupants('001', { detailOf: (id) => (id === 'ann' ? { str: 7, defMod: 2 } : null) })
  assert.deepEqual(list.map((p) => [p.id, p.presenceStatus]), [
    ['ann', 'active'],
    ['cat', 'disconnected'],
  ])

  const ann = list[0]
  assert.equal(ann.inBattle, true)
  assert.equal(ann.battleEnemyName, 'Scorpion')
  assert.equal(ann.partyLeaderId, 'ann')
  assert.equal(ann.str, 7, 'stat blocks come from the caller')
  assert.equal(ann.defMod, 2)
  assert.equal(ann.dex, null)

  const { players, roomGhosts } = splitRoomOccupants(list)
  assert.deepEqual(players.map((p) => p.id), ['ann'])
  assert.deepEqual(roomGhosts.map((p) => p.id), ['cat'])
})

test('somebody back in the room is shown once, live, not beside their own ghost', () => {
  resetStores()
  ghosts.addGhost('001', player('ann'))
  presence.setPresence(player('ann'))

  const list = buildRoomOccupants('001')
  assert.deepEqual(list.map((p) => [p.id, p.presenceStatus]), [['ann', 'active']])
})

test('a player walking in is listed before presence has caught up with the move', () => {
  resetStores()
  // Presence still has them in the room they are leaving.
  presence.setPresence(player('ann', { currentRoom: '001' }))
  presence.patchPresence('ann', { status: 'idle', idleSince: T0 })
  const arriving = player('ann', { currentRoom: '001', str: 9, activePet: 'hamster' })

  const list = buildRoomOccupants('002', { arriving })
  assert.equal(list.length, 1)
  assert.equal(list[0].currentRoom, '002')
  assert.equal(list[0].str, 9)
  assert.equal(list[0].pet, 'hamster')
  assert.equal(list[0].presenceStatus, 'idle', 'a pulled follower arrives as idle as they left')
})

test('both HTTP room loads and the socket move payload use the one builder', () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
  for (const file of [
    'src/app/api/game/room/current/route.ts',
    'src/app/api/game/room/[roomId]/route.ts',
    'src/lib/socket-server-handlers.js',
  ]) {
    assert.match(read(file), /buildRoomOccupants\(/, `${file} builds its room list with buildRoomOccupants`)
  }
  // The database's `isActive` column is not presence, and no room list reads it.
  assert.doesNotMatch(read('src/app/api/game/room/current/route.ts'), /isActive:\s*true/)
})

test('the ghost store only ever remembers sessions that ended', () => {
  resetStores()
  ghosts.addGhost('001', player('ann'))
  assert.equal(ghosts.getGhostsForRoom('001')[0].status, 'disconnected')

  const handlers = fs.readFileSync(path.join(ROOT, 'src/lib/socket-server-handlers.js'), 'utf8')
  assert.doesNotMatch(handlers, /addGhost\([^)]*'idle'/, 'idle is never written as a ghost')
})
