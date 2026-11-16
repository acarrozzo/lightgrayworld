/**
 * Idle, as the client reads it.
 *
 * The server says who is idle and since when. Everything the player sees about
 * it is derived from that one timestamp: the label, the Away tier, the warning
 * on a Follow button, and the line offering a follower the way out when their
 * leader has wandered off. The room card, the roster and the party rail used to
 * format it three ways; they share these now.
 *
 * Also here: the "still here" throttle, which is the rule that keeps a page
 * with a person at it from being called idle without turning every pointer
 * move into a message.
 *
 * The server half is in idle-presence.test.js.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Player } from '../src/lib/game-state'
import type { PartySnapshot, PresencePlayer } from '../src/lib/socket'
import {
  HEARTBEAT_MIN_MS,
  HEARTBEAT_RETRY_MS,
  IDLE_AWAY_MS,
  LEADER_IDLE_NUDGE_MS,
  idleFollowWarning,
  idleLabel,
  idleTier,
  nextHeartbeat,
  settleHeartbeat,
  shortAgo,
  shouldNudgeLeaderIdle,
  type HeartbeatState,
} from '../src/lib/presence/idle'
import { buildSquad } from '../src/lib/party/squad'
import { mergeRoster, type DirectoryPlayer } from '../src/lib/roster/merge-roster'

const MIN = 60 * 1000
const NOW = 1_800_000_000_000

test('idle is a duration from when they went quiet, with no "ago"', () => {
  assert.equal(idleLabel(NOW - 12 * MIN, NOW), 'Idle 12m')
  assert.equal(idleLabel(NOW - 45_000, NOW), 'Idle 45s')
  assert.equal(idleLabel(null, NOW), 'Idle', 'no timestamp, no made-up number')
  assert.equal(shortAgo(NOW - 3 * 60 * MIN, NOW), '3h')
  // A clock that disagrees with the server never produces a negative time.
  assert.equal(idleLabel(NOW + 5 * MIN, NOW), 'Idle 0s')
})

test('past half an hour, idle reads as away', () => {
  assert.equal(idleTier(NOW - (IDLE_AWAY_MS - 1), NOW), 'idle')
  assert.equal(idleTier(NOW - IDLE_AWAY_MS, NOW), 'away')
  assert.equal(idleLabel(NOW - 45 * MIN, NOW), 'Away 45m')
  assert.equal(idleLabel(NOW - 3 * 60 * MIN, NOW), 'Away 3h')
})

test('a Follow aimed at somebody idle says they may not answer', () => {
  assert.equal(idleFollowWarning('Mira', NOW - 12 * MIN, NOW), 'Mira is idle 12m and may not answer')
  assert.equal(idleFollowWarning('Mira', NOW - 50 * MIN, NOW), 'Mira is away 50m and may not answer')
})

test('a follower is nudged only once their leader has been idle a while', () => {
  const idleFor = (ms: number) => ({ presence: 'idle', lastSeen: NOW - ms })
  assert.equal(shouldNudgeLeaderIdle(idleFor(LEADER_IDLE_NUDGE_MS - 1), NOW), false, 'a few minutes is a coffee')
  assert.equal(shouldNudgeLeaderIdle(idleFor(LEADER_IDLE_NUDGE_MS), NOW), true)
  assert.equal(shouldNudgeLeaderIdle({ presence: 'active', lastSeen: NOW - 60 * MIN }, NOW), false)
  assert.equal(shouldNudgeLeaderIdle({ ...idleFor(60 * MIN), inBattle: true }, NOW), false, 'a fight is its own line')
  assert.equal(shouldNudgeLeaderIdle(null, NOW), false)
})

// --- The surfaces read the same timestamp --------------------------------------

function presenceOf(overrides: Partial<PresencePlayer> & { id: string; username: string }): PresencePlayer {
  return {
    level: 10,
    hp: 40,
    hpMax: 40,
    mp: 10,
    mpMax: 10,
    currentRoom: '001',
    status: 'active',
    inBattle: false,
    // Presence bumps `lastSeen` on every change, so it is recent even for
    // somebody long idle. It is not what idle is counted from.
    lastSeen: NOW - 5_000,
    ...overrides,
  }
}

test('the party rail counts idle from idleSince, not from the last presence change', () => {
  const party: PartySnapshot = {
    id: 'p1',
    leaderId: 'lead',
    leader: { id: 'lead', username: 'Tim', level: 10 },
    members: [{ id: 'me', username: 'Me', level: 9 }],
    size: 2,
    maxSize: 6,
  } as unknown as PartySnapshot
  const roomPlayers = [
    { id: 'lead', username: 'Tim', level: 10, hp: 40, hpMax: 40, currentRoom: '001' },
    { id: 'me', username: 'Me', level: 9, hp: 30, hpMax: 30, currentRoom: '001' },
  ] as unknown as Player[]

  const squad = buildSquad({
    party,
    roomPlayers,
    presenceById: {
      lead: presenceOf({ id: 'lead', username: 'Tim', status: 'idle', idleSince: NOW - 12 * MIN }),
      me: presenceOf({ id: 'me', username: 'Me' }),
    },
    currentPlayerId: 'me',
    now: NOW,
  })

  const lead = squad.find((m) => m.id === 'lead')!
  assert.equal(lead.state, 'idle')
  assert.equal(lead.lastSeen, NOW - 12 * MIN)
  assert.equal(lead.statusLabel, 'Idle 12m')
  assert.equal(shouldNudgeLeaderIdle(lead, NOW), true)
})

test('the roster counts idle from idleSince too', () => {
  const directory = [
    { id: 'a', username: 'Ann', level: 3, currentRoom: '001', lastActive: new Date(NOW - 90 * MIN).toISOString() },
  ] as unknown as DirectoryPlayer[]
  const [row] = mergeRoster({
    directory,
    presenceById: { a: presenceOf({ id: 'a', username: 'Ann', status: 'idle', idleSince: NOW - 40 * MIN }) },
    roomNames: {},
  })
  assert.equal(row.presence, 'idle')
  assert.equal(row.lastSeen, NOW - 40 * MIN)
  assert.equal(idleLabel(row.lastSeen, NOW), 'Away 40m')
})

// --- "Still here" ------------------------------------------------------------

test('the first input goes at once, then at most one a minute', () => {
  let state: HeartbeatState = { lastSentAt: 0, inFlight: false }

  const first = nextHeartbeat(state, NOW)
  assert.equal(first.send, true, 'coming back from idle is immediate')
  state = first.state

  assert.equal(nextHeartbeat(state, NOW + 10).send, false, 'never two in flight')

  state = settleHeartbeat(NOW, true)
  assert.equal(nextHeartbeat(state, NOW + HEARTBEAT_MIN_MS - 1).send, false)
  assert.equal(nextHeartbeat(state, NOW + HEARTBEAT_MIN_MS).send, true)
})

test('a ping that did not land is retried in seconds, not after the full minute', () => {
  // Sent before login finished: the server had no player to credit.
  const state = settleHeartbeat(NOW, false)
  assert.equal(nextHeartbeat(state, NOW + HEARTBEAT_RETRY_MS - 1).send, false, 'not on every pointer move')
  assert.equal(nextHeartbeat(state, NOW + HEARTBEAT_RETRY_MS).send, true)
})
