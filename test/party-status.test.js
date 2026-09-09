/**
 * What the party store knows about itself.
 *
 * A party has a stable id that survives a change of leader, a leader can close
 * it to new followers, a member who cannot follow is cut loose rather than left
 * stranded and unable to walk, and every one of those moments produces a line
 * somebody reads — the party list quietly getting shorter is not an event a
 * player can notice.
 *
 * The client half of the same feature is in party-squad.test.ts.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// The store emits through socket-utils and reads names from presence; stub both
// so nothing needs a live io or a live roster.
const emitted = []
const utilsPath = require.resolve(path.join(ROOT, 'src/lib/socket-utils.js'))
const realUtils = require(utilsPath)
require.cache[utilsPath] = {
  id: utilsPath,
  filename: utilsPath,
  loaded: true,
  exports: {
    ...realUtils,
    getSocketIO: () => ({
      to: (sid) => ({ emit: (event, payload) => emitted.push({ sid, event, payload }) }),
    }),
    getSocketIdsForUser: (playerId) => [`sock:${playerId}`],
  },
}

const presence = new Map()
const presencePath = require.resolve(path.join(ROOT, 'src/lib/services/presence-store.js'))
const realPresence = require(presencePath)
require.cache[presencePath] = {
  id: presencePath,
  filename: presencePath,
  loaded: true,
  exports: {
    ...realPresence,
    getPresence: (id) => presence.get(id) ?? null,
  },
}

const partyStore = require(path.join(ROOT, 'src/lib/services/party-store.js'))
const { SOCKET_EVENTS } = realUtils

const who = (id, level = 5) => ({ id, username: id.toUpperCase(), level, uIcon: null, uIconColor: null })
const buildParty = (leader, members) => {
  for (const m of members) partyStore.follow(who(m), who(leader))
}
const noticesFor = (id) =>
  emitted
    .filter((e) => e.event === SOCKET_EVENTS.PARTY_NOTICE && e.sid === `sock:${id}`)
    .map((e) => e.payload)

test.beforeEach(() => {
  global.__partyStore.parties.clear()
  global.__partyStore.memberToLeader.clear()
  presence.clear()
  emitted.length = 0
})

// ─── Server: the party's own state ──────────────────────────────────────────

test('a party keeps its id when the leader escapes and hands it on', () => {
  buildParty('lead', ['m1', 'm2'])
  const before = partyStore.getPartyId('m1')
  assert.ok(before, 'a formed party has an id')

  partyStore.departAlone('lead')

  assert.equal(partyStore.getLeaderId('m1'), 'm1', 'the longest-standing member leads now')
  assert.equal(partyStore.getPartyId('m2'), before, 'the party chat history stays reachable')
})

test('a closed party refuses new followers by name, and reopening lets them in', () => {
  buildParty('lead', ['m1'])
  presence.set('lead', { id: 'lead', username: 'LEAD', level: 5 })

  assert.equal(partyStore.setClosed('lead', true).ok, true)
  const refused = partyStore.follow(who('m2'), who('lead'))
  assert.equal(refused.ok, false)
  assert.match(refused.error, /LEAD/, 'the refusal names who to ask')
  assert.equal(partyStore.getLeaderId('m2'), null)

  partyStore.setClosed('lead', false)
  assert.equal(partyStore.follow(who('m2'), who('lead')).ok, true)
  assert.equal(partyStore.getLeaderId('m2'), 'lead')
})

test('only the leader can close the party', () => {
  buildParty('lead', ['m1'])
  const res = partyStore.setClosed('m1', true)
  assert.equal(res.ok, false)
  assert.equal(partyStore.getPartySnapshot('m1').closed, false)
})

test('the snapshot reports the level a member has now, not the one they joined at', () => {
  buildParty('lead', ['m1'])
  presence.set('m1', { id: 'm1', username: 'M1', level: 12 })

  const snapshot = partyStore.getPartySnapshot('lead')
  assert.equal(snapshot.members[0].level, 12, 'a level earned mid-crawl shows immediately')
})

test('a member who cannot follow is cut loose, and both sides are told', () => {
  buildParty('lead', ['m1', 'm2'])
  presence.set('m1', { id: 'm1', username: 'M1', level: 5 })
  emitted.length = 0

  assert.equal(partyStore.leaveBehind('m1', { destinationName: 'Rocky Flats' }), true)

  assert.equal(partyStore.getLeaderId('m1'), null, 'never left pinned to a leader they are not with')
  assert.equal(partyStore.getLeaderId('m2'), 'lead', 'the rest of the party carries on')
  assert.match(noticesFor('lead')[0].message, /M1 could not follow the party to Rocky Flats/)
  assert.match(noticesFor('m1')[0].message, /travelling alone again/)
})

test('a death tells the survivors who fell', () => {
  buildParty('lead', ['m1', 'm2'])
  presence.set('m1', { id: 'm1', username: 'M1', level: 5 })
  emitted.length = 0

  partyStore.onDeath('m1')

  assert.equal(noticesFor('lead')[0].kind, 'fallen')
  assert.match(noticesFor('lead')[0].message, /M1 has fallen/)
  assert.equal(partyStore.getLeaderId('m1'), null)
})

test('following someone tells them they are leading a party now', () => {
  const res = partyStore.follow(who('m1'), who('lead'))
  assert.equal(res.ok, true)
  const notices = noticesFor('lead')
  assert.equal(notices.length, 1)
  assert.match(notices[0].message, /M1 is following you/)
})
