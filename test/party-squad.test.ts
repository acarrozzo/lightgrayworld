/**
 * The merge behind every party surface.
 *
 * The party snapshot is identity frozen at the moment each person joined;
 * presence and the room list are what move. `buildSquad` is the one place the
 * two are put together, so the squad bar, its member sheet and the Players tab
 * cannot end up disagreeing about what a teammate is doing — which is exactly
 * how the old strip, the room card and the party panel each came to know a
 * different subset of the truth.
 *
 * `groupBonusPercent` is a mirror of `getOtherCombatantCount` in the battle
 * calculator, and a mirror is only worth having while it agrees, so the number
 * the bar prints is checked against the rule combat actually applies.
 *
 * The server half of the same feature is in party-status.test.js.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Player } from '../src/lib/game-state'
import type { PartySnapshot, PresencePlayer } from '../src/lib/socket'
import { buildSquad, followableHere, groupBonusPercent, LOW_HP_FRACTION } from '../src/lib/party/squad'

const NOW = Date.now()

const presenceOf = (over: Partial<PresencePlayer> & { id: string; username: string }): PresencePlayer => ({
  level: 1,
  hp: 10,
  hpMax: 10,
  mp: 5,
  mpMax: 5,
  currentRoom: 'r1',
  status: 'active',
  inBattle: false,
  lastSeen: NOW,
  ...over,
})

const roomOf = (over: Partial<Player> & { id: string; username: string }): Player => ({
  level: 1,
  hp: 10,
  hpMax: 10,
  mp: 5,
  mpMax: 5,
  currentRoom: 'r1',
  isActive: true,
  presenceStatus: 'active',
  ...over,
}) as Player

const PARTY: PartySnapshot = {
  id: 'p1',
  leaderId: 'lead',
  // The level here is stale on purpose: it is what Kaz was when the party formed.
  leader: { id: 'lead', username: 'Kaz', level: 9, uIcon: null, uIconColor: null },
  members: [
    { id: 'me', username: 'Vex', level: 14, uIcon: null, uIconColor: null },
    { id: 'hurt', username: 'Mira', level: 12, uIcon: null, uIconColor: null },
  ],
  size: 3,
  maxSize: 6,
  closed: false,
}

const PRESENCE: Record<string, PresencePlayer> = {
  lead: presenceOf({
    id: 'lead', username: 'Kaz', level: 16, hp: 53, hpMax: 60, mp: 12, mpMax: 30,
    inBattle: true, battleEnemyName: 'Scorpion',
  }),
  me: presenceOf({ id: 'me', username: 'Vex', level: 14, hp: 42, hpMax: 52, mp: 15, mpMax: 25 }),
  hurt: presenceOf({
    id: 'hurt', username: 'Mira', level: 12, hp: 9, hpMax: 41, mp: 18, mpMax: 23, status: 'idle',
  }),
  stranger: presenceOf({ id: 'stranger', username: 'Tam', level: 7, inBattle: true }),
}

const ROOM: Player[] = [
  roomOf({ id: 'lead', username: 'Kaz', level: 9 }),
  roomOf({ id: 'me', username: 'Vex', level: 14 }),
  roomOf({ id: 'hurt', username: 'Mira', level: 12 }),
  roomOf({ id: 'stranger', username: 'Tam', level: 7, inBattle: true }),
]

test('the squad is the leader first, then members in join order', () => {
  const squad = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me', self: null,
  })
  assert.deepEqual(squad.map((m) => m.id), ['lead', 'me', 'hurt'])
  assert.equal(squad[0].isLeader, true)
  assert.equal(squad[1].isSelf, true)
})

test('live presence outranks the level frozen into the party row', () => {
  const squad = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me', self: null,
  })
  assert.equal(squad[0].level, 16, 'a level earned mid-crawl shows without re-forming the party')
})

test('a tile names the enemy rather than just saying "in battle"', () => {
  const squad = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me', self: null,
  })
  assert.equal(squad[0].state, 'fighting')
  assert.equal(squad[0].statusLabel, 'Scorpion')
})

test('trouble outranks having gone quiet', () => {
  const squad = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me', self: null,
  })
  // Mira is both idle and at 22% HP. Idle is the older fact; the low HP is the
  // one somebody can still do something about.
  assert.equal(squad[2].state, 'hurt')
  assert.ok((squad[2].hpPct ?? 100) <= LOW_HP_FRACTION * 100)
})

test('the viewer sees their own numbers, not a feed that may lag them', () => {
  const self = roomOf({ id: 'me', username: 'Vex', level: 14, hp: 3, hpMax: 52, mp: 1, mpMax: 25 })
  const squad = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me', self,
  })
  assert.equal(squad[1].hp, 3, 'the store the header reads wins for your own row')
  assert.equal(squad[1].state, 'hurt')
})

test('a fallen member reads as down', () => {
  const presence = { ...PRESENCE, hurt: presenceOf({ id: 'hurt', username: 'Mira', level: 12, hp: 0, hpMax: 41 }) }
  const squad = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: presence, currentPlayerId: 'me', self: null,
  })
  assert.equal(squad[2].state, 'down')
  assert.equal(squad[2].statusLabel, 'Fallen')
})

test('knowing nothing about a member is not the same as them being dead', () => {
  const squad = buildSquad({
    party: PARTY, roomPlayers: [], presenceById: {}, currentPlayerId: 'me', self: null,
  })
  assert.equal(squad[2].hpPct, null, 'no vitals is null, never zero')
  assert.equal(squad[2].state, 'offline')
  assert.equal(squad[2].statusLabel, 'Offline')
})

test('the group bonus matches what the battle calculator counts', () => {
  // getOtherCombatantCount: every other player in the room with a battle of
  // their own (Tam), plus every party member standing here (Kaz, Mira). Three
  // at 10% each, counted once — Kaz is both and must not be counted twice.
  assert.equal(groupBonusPercent(ROOM, PARTY, 'me'), 30)
})

test('a solo player in an empty room fights at no bonus', () => {
  assert.equal(groupBonusPercent([ROOM[1]], null, 'me'), 0)
})

test('you can only follow a leader, and never someone already with you', () => {
  const withForeignMember = [
    ...ROOM,
    roomOf({ id: 'follower', username: 'Bo', level: 5, partyLeaderId: 'stranger' }),
    roomOf({ id: 'gone', username: 'Rell', level: 5, presenceStatus: 'disconnected' }),
  ]
  assert.deepEqual(
    followableHere(withForeignMember, PARTY, 'me').map((p) => p.id),
    ['stranger'],
    'not yourself, not your own party, not a rank-and-file member, not a ghost'
  )
})
