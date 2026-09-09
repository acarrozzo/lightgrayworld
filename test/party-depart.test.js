/**
 * Breaking away from a party alone.
 *
 * Escaping a fight — by Retreat or by teleporting out of one — is personal: the
 * party is not dragged along behind you, and you are not held in the room by
 * being in one. A member leaving simply leaves. A leader hands the party to
 * whoever has been in it longest, and dissolves it when there is nobody left to
 * lead. Ordinary travel is untouched: out of a fight the leader still takes the
 * party with them, and walking always does.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// The store emits through socket-utils; stub it so nothing needs a live io.
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

const partyStore = require(path.join(ROOT, 'src/lib/services/party-store.js'))
const { SOCKET_EVENTS } = realUtils

const who = (id) => ({ id, username: id.toUpperCase(), level: 5, uIcon: null, uIconColor: null })

/** Build a party led by `leader` with the given members, in order. */
const buildParty = (leader, members) => {
  for (const m of members) partyStore.follow(who(m), who(leader))
}

test.beforeEach(() => {
  // Parties live on globalThis; clear both maps between cases.
  global.__partyStore.parties.clear()
  global.__partyStore.memberToLeader.clear()
  emitted.length = 0
})

test('a member who breaks away just leaves; the party carries on without them', () => {
  buildParty('lead', ['m1', 'm2'])
  emitted.length = 0

  const { promotedId } = partyStore.departAlone('m1')

  assert.equal(promotedId, null, 'no handover — the leader never moved')
  assert.equal(partyStore.isMember('m1'), false)
  assert.equal(partyStore.isLeader('lead'), true)
  assert.deepEqual(partyStore.getLeaderMemberIds('lead'), ['m2'])
})

test('a leader who breaks away hands the party to the longest-standing member', () => {
  buildParty('lead', ['m1', 'm2', 'm3'])
  emitted.length = 0

  const { promotedId, promotedName } = partyStore.departAlone('lead')

  assert.equal(promotedId, 'm1', 'the first to join takes over')
  assert.equal(promotedName, 'M1')
  assert.equal(partyStore.isLeader('m1'), true)
  assert.equal(partyStore.isLeader('lead'), false)
  assert.equal(partyStore.isMember('lead'), false, 'the one who left is on their own')
  assert.deepEqual(partyStore.getLeaderMemberIds('m1').sort(), ['m2', 'm3'])

  // The one who left is told their party is gone; the rest see the new leader.
  const disbanded = emitted.filter((e) => e.event === SOCKET_EVENTS.PARTY_DISBANDED)
  assert.deepEqual(disbanded.map((e) => e.sid), ['sock:lead'])
  const updated = emitted.filter((e) => e.event === SOCKET_EVENTS.PARTY_UPDATED)
  assert.equal(updated.at(-1).payload.leaderId, 'm1')
  assert.equal(updated.at(-1).payload.size, 3)
})

test('a leader with one member behind them takes the party with them — one person is not a party', () => {
  buildParty('lead', ['m1'])
  emitted.length = 0

  const { promotedId } = partyStore.departAlone('lead')

  assert.equal(promotedId, null)
  assert.equal(partyStore.isLeader('lead'), false)
  assert.equal(partyStore.isLeader('m1'), false)
  assert.equal(partyStore.isMember('m1'), false)
  assert.equal(partyStore.getPartySnapshot('m1'), null)
})

test('breaking away solo is a no-op', () => {
  const { promotedId } = partyStore.departAlone('nobody')
  assert.equal(promotedId, null)
  assert.equal(partyStore.getPartySnapshot('nobody'), null)
})

test('the promoted leader can still be followed, and the party keeps working', () => {
  buildParty('lead', ['m1', 'm2', 'm3'])
  partyStore.departAlone('lead')

  partyStore.follow(who('m4'), who('m1'))
  assert.deepEqual(partyStore.getLeaderMemberIds('m1').sort(), ['m2', 'm3', 'm4'])
  assert.equal(partyStore.getParty('m4').leaderId, 'm1')
})
