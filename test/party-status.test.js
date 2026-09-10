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
  for (const pending of global.__partyStore.requests.values()) {
    for (const entry of pending.values()) clearTimeout(entry.timer)
  }
  global.__partyStore.requests.clear()
  presence.clear()
  emitted.length = 0
})

const requestsTo = (id) =>
  emitted
    .filter((e) => e.event === SOCKET_EVENTS.PARTY_FOLLOW_REQUEST && e.sid === `sock:${id}`)
    .map((e) => e.payload)

const resolvedFor = (id) =>
  emitted
    .filter((e) => e.event === SOCKET_EVENTS.PARTY_FOLLOW_RESOLVED && e.sid === `sock:${id}`)
    .map((e) => e.payload)

const pendingFor = (id) =>
  emitted
    .filter((e) => e.event === SOCKET_EVENTS.PARTY_FOLLOW_PENDING && e.sid === `sock:${id}`)
    .map((e) => e.payload)

// ─── Asking to follow, and being asked ──────────────────────────────────────

test('asking to follow joins nothing until the leader answers', () => {
  const res = partyStore.requestFollow(who('m1'), who('lead'))

  assert.equal(res.ok, true)
  assert.equal(res.pending, true)
  assert.equal(partyStore.getLeaderId('m1'), null, 'nobody is in a party yet')
  assert.equal(partyStore.getLeaderId('lead'), null, 'and nobody has been made a leader')

  const asks = requestsTo('lead')
  assert.equal(asks.length, 1)
  assert.equal(asks[0].requesterId, 'm1')
  assert.equal(asks[0].wouldBecomeLeader, true, 'this is the ask that makes them a leader')
})

test('saying yes is what forms the party', () => {
  partyStore.requestFollow(who('m1'), who('lead'))
  const res = partyStore.answerFollow('lead', 'm1', true)

  assert.equal(res.accepted, true)
  assert.equal(partyStore.getLeaderId('m1'), 'lead')
  assert.ok(res.partyId)
})

test('saying no leaves everyone where they were, and says so', () => {
  partyStore.requestFollow(who('m1'), who('lead'))
  emitted.length = 0

  const res = partyStore.answerFollow('lead', 'm1', false)

  assert.equal(res.ok, true)
  assert.equal(res.accepted, false)
  assert.equal(partyStore.getLeaderId('m1'), null)
  assert.equal(partyStore.getLeaderId('lead'), null)
  assert.match(noticesFor('m1')[0].message, /declined to lead you/)
})

test('a second ask to the same person is refused rather than queued twice', () => {
  partyStore.requestFollow(who('m1'), who('lead'))
  const again = partyStore.requestFollow(who('m1'), who('lead'))

  assert.equal(again.ok, false)
  assert.match(again.error, /has not answered yet/)
  assert.equal(requestsTo('lead').length, 1)
})

test('the asker is told their ask is pending, so the button can say so', () => {
  partyStore.requestFollow(who('m1'), who('lead'))

  const pending = pendingFor('m1')
  assert.equal(pending.length, 1)
  assert.equal(pending[0].targetId, 'lead')
  assert.ok(pending[0].expiresAt > Date.now(), 'and when it lapses on its own')
})

test('every ending tells both ends, so neither is left showing a stale state', () => {
  partyStore.requestFollow(who('m1'), who('lead'))
  emitted.length = 0

  partyStore.answerFollow('lead', 'm1', false)

  assert.equal(resolvedFor('lead')[0]?.outcome, 'declined', "the leader's prompt closes")
  assert.equal(resolvedFor('m1')[0]?.outcome, 'declined', "the asker's button comes back")
})

test('an asker who is no longer eligible cannot be accepted into the party', () => {
  partyStore.requestFollow(who('m1'), who('lead'))
  emitted.length = 0

  // The caller supplies what the store cannot see for itself — here, that the
  // asker has walked out of the room since.
  const res = partyStore.answerFollow('lead', 'm1', true, () => 'M1 is no longer in this room.')

  assert.equal(res.ok, false)
  assert.equal(partyStore.getLeaderId('m1'), null, 'never pinned to a leader they are not with')
  assert.equal(partyStore.getLeaderId('lead'), null, 'and nobody was made a leader of nobody')
  assert.equal(resolvedFor('lead')[0]?.outcome, 'cancelled')
  assert.match(noticesFor('m1')[0].message, /no longer in this room/)
})

test('a verify that passes lets the join through', () => {
  partyStore.requestFollow(who('m1'), who('lead'))
  const res = partyStore.answerFollow('lead', 'm1', true, () => null)

  assert.equal(res.accepted, true)
  assert.equal(partyStore.getLeaderId('m1'), 'lead')
})

test('walking out of the room ends the ask from either end', () => {
  partyStore.requestFollow(who('m1'), who('lead'))
  emitted.length = 0

  // The asker leaves.
  partyStore.cancelRequestsInvolving('m1', 'cancelled', 'They left the room.')

  assert.equal(resolvedFor('lead')[0]?.outcome, 'cancelled')
  assert.equal(resolvedFor('lead')[0]?.reason, 'They left the room.')
  assert.equal(partyStore.answerFollow('lead', 'm1', true).ok, false, 'accepting later does nothing')

  // And the same when the person being asked is the one who walks.
  emitted.length = 0
  partyStore.requestFollow(who('m2'), who('lead'))
  emitted.length = 0
  partyStore.cancelRequestsInvolving('lead', 'cancelled', 'They left the room.')
  assert.equal(resolvedFor('m2')[0]?.outcome, 'cancelled')
  assert.equal(partyStore.getLeaderId('m2'), null)
})

test('an ask to someone who already leads does not offer to make them a leader', () => {
  buildParty('lead', ['m1'])
  emitted.length = 0

  partyStore.requestFollow(who('m2'), who('lead'))
  assert.equal(requestsTo('lead')[0].wouldBecomeLeader, false)
})

test('answering an ask that is no longer waiting is refused, not silently applied', () => {
  const res = partyStore.answerFollow('lead', 'ghost', true)
  assert.equal(res.ok, false)
  assert.match(res.error, /no longer waiting/)
})

test('a member cannot answer for the party they merely belong to', () => {
  buildParty('lead', ['m1'])
  partyStore.requestFollow(who('m2'), who('m1'))

  // The ask goes to whoever leads, not to whoever was clicked.
  assert.equal(requestsTo('m1').length, 0)
  assert.equal(requestsTo('lead').length, 1)
})

test('closing the party turns away whoever was still waiting', () => {
  buildParty('lead', ['m1'])
  partyStore.requestFollow(who('m2'), who('lead'))
  emitted.length = 0

  partyStore.setClosed('lead', true)

  assert.match(noticesFor('m2')[0].message, /closed their party/)
  assert.equal(partyStore.answerFollow('lead', 'm2', true).ok, false, 'the ask is gone')
})

test('a party that filled up while the ask waited refuses it on the answer', () => {
  buildParty('lead', ['m1'])
  partyStore.requestFollow(who('late'), who('lead'))
  buildParty('lead', ['m2', 'm3', 'm4', 'm5'])
  emitted.length = 0

  const res = partyStore.answerFollow('lead', 'late', true)

  assert.equal(res.ok, false)
  assert.match(res.error, /full/)
  assert.equal(partyStore.getLeaderId('late'), null)
  assert.match(noticesFor('late')[0].message, /full/)
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

test('the leader can name the party, and the name survives a succession', () => {
  buildParty('lead', ['m1', 'm2'])

  assert.equal(partyStore.setName('lead', '  The   Unwashed  ').name, 'The Unwashed')
  assert.equal(partyStore.getPartySnapshot('m1').name, 'The Unwashed')

  partyStore.departAlone('lead')
  assert.equal(partyStore.getPartySnapshot('m2').name, 'The Unwashed', 'the name travels with the party')
})

test('a party name is trimmed to something printable, and can be cleared', () => {
  buildParty('lead', ['m1'])

  partyStore.setName('lead', `x${'y'.repeat(60)}`)
  assert.equal(partyStore.getPartySnapshot('lead').name.length, 24, 'capped, not rejected')

  partyStore.setName('lead', 'a\u0000b')
  assert.equal(partyStore.getPartySnapshot('lead').name, 'a b', 'control characters cannot break the pill')

  partyStore.setName('lead', '   ')
  assert.equal(partyStore.getPartySnapshot('lead').name, null, 'an empty name is just "Party" again')
})

test('only the leader can name the party', () => {
  buildParty('lead', ['m1'])
  assert.equal(partyStore.setName('m1', 'Mine Now').ok, false)
  assert.equal(partyStore.getPartySnapshot('lead').name, null)
})

test('following someone tells them they are leading a party now', () => {
  const res = partyStore.follow(who('m1'), who('lead'))
  assert.equal(res.ok, true)
  const notices = noticesFor('lead')
  assert.equal(notices.length, 1)
  assert.match(notices[0].message, /M1 is following you/)
})

test('a structured event reaches the rest of the party and nobody else', () => {
  buildParty('lead', ['a', 'b'])
  emitted.length = 0
  partyStore.emitToOthers('a', 'party:member-battle', { id: 'a', enemyHpPct: 50 })
  const got = emitted.filter((e) => e.event === 'party:member-battle').map((e) => e.sid).sort()
  assert.deepEqual(got, ['sock:b', 'sock:lead'])
  // Solo: nothing goes anywhere.
  emitted.length = 0
  partyStore.emitToOthers('nobody', 'party:member-battle', {})
  assert.equal(emitted.length, 0)
})
