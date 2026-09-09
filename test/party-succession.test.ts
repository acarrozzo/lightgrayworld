/**
 * The sentence the confirmation shows before someone leaves their party.
 *
 * `describePartyDeparture` is a client-side mirror of `partyStore.departAlone`,
 * which is the authority. A mirror is only worth having while it agrees, so the
 * two are checked against each other here rather than each being trusted on its
 * own: the preview names the successor the store actually promotes, and
 * predicts a disband exactly where the store disbands.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describePartyDeparture, partyDepartureWarning } from '../src/lib/party-succession'

const require_ = createRequire(import.meta.url)

// The store broadcasts through socket-utils; stub it before the store loads.
const utilsPath = require_.resolve('../src/lib/socket-utils.js')
const realUtils = require_(utilsPath)
require_.cache[utilsPath] = {
  id: utilsPath,
  filename: utilsPath,
  loaded: true,
  exports: {
    ...realUtils,
    getSocketIO: () => ({ to: () => ({ emit: () => {} }) }),
    getSocketIdsForUser: (playerId: string) => [`sock:${playerId}`],
  },
} as never

const partyStore = require_('../src/lib/services/party-store.js')

const who = (id: string) => ({ id, username: id.toUpperCase(), level: 5, uIcon: null, uIconColor: null })
const buildParty = (leader: string, members: string[]) => {
  for (const m of members) partyStore.follow(who(m), who(leader))
}

test.beforeEach(() => {
  ;(globalThis as never as { __partyStore: { parties: Map<string, unknown>; memberToLeader: Map<string, unknown> } }).__partyStore.parties.clear()
  ;(globalThis as never as { __partyStore: { parties: Map<string, unknown>; memberToLeader: Map<string, unknown> } }).__partyStore.memberToLeader.clear()
})

test('the preview names the successor the store actually promotes', () => {
  buildParty('lead', ['m1', 'm2', 'm3'])
  const preview = describePartyDeparture(partyStore.getPartySnapshot('lead'), 'lead')

  assert.equal(preview.kind, 'handoff')
  assert.equal(partyStore.departAlone('lead').promotedName, (preview as { successorName: string }).successorName)
})

test('the preview predicts a disband exactly where the store disbands', () => {
  buildParty('lead', ['m1'])
  assert.deepEqual(describePartyDeparture(partyStore.getPartySnapshot('lead'), 'lead'), { kind: 'disband' })
  assert.equal(partyStore.departAlone('lead').promotedId, null)
})

test('a member is told they leave, and someone with no party is told nothing', () => {
  buildParty('lead', ['m1', 'm2'])
  assert.deepEqual(describePartyDeparture(partyStore.getPartySnapshot('m1'), 'm1'), { kind: 'member' })
  assert.equal(describePartyDeparture(null, 'solo').kind, 'none')
  assert.equal(partyDepartureWarning({ kind: 'none' }), null, 'nothing to warn about, so no dialog')
})

test('every warning that is shown names what happens to the party', () => {
  for (const departure of [
    { kind: 'handoff', successorName: 'M1' } as const,
    { kind: 'disband' } as const,
    { kind: 'member' } as const,
  ]) {
    const warning = partyDepartureWarning(departure)
    assert.ok(warning && /party/i.test(warning), `${departure.kind} says what happens to the party`)
    assert.ok(/alone/i.test(warning), `${departure.kind} says you go alone`)
  }
})
