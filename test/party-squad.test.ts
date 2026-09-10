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
import {
  buildOutsiders,
  buildSquad,
  followableHere,
  groupBonusPercent,
  LOW_HP_FRACTION,
} from '../src/lib/party/squad'

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
  name: null,
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

test('a safe room reads green, and reads per member rather than per room', () => {
  // A danger-5 room: a stroll for Kaz at 16, even odds for a level-5 follower.
  const party: PartySnapshot = {
    ...PARTY,
    members: [{ id: 'green', username: 'Bo', level: 5, uIcon: null, uIconColor: null }],
  }
  const presence = {
    lead: presenceOf({ id: 'lead', username: 'Kaz', level: 16, hp: 60, hpMax: 60 }),
    green: presenceOf({ id: 'green', username: 'Bo', level: 5, hp: 30, hpMax: 30 }),
  }
  const squad = buildSquad({
    party, roomDanger: { dangerLevel: 5, isSafe: false }, roomPlayers: [],
    presenceById: presence, currentPlayerId: 'lead', self: null,
  })
  assert.equal(squad[0].state, 'safe', 'danger 5 is EASY at level 16')
  assert.equal(squad[1].state, 'ready', 'the same room is EVEN at level 5 — not green')
})

test('a flagged safe room is safe for everyone in it', () => {
  const squad = buildSquad({
    party: PARTY, roomDanger: { dangerLevel: 40, isSafe: true }, roomPlayers: ROOM,
    presenceById: { me: presenceOf({ id: 'me', username: 'Vex', level: 14, hp: 52, hpMax: 52 }) },
    currentPlayerId: 'me', self: null,
  })
  assert.equal(squad[1].state, 'safe', 'the flag beats the number')
})

test('a fight outranks a safe room and outranks being offline', () => {
  const squad = buildSquad({
    party: PARTY, roomDanger: { dangerLevel: 0, isSafe: true }, roomPlayers: ROOM,
    presenceById: PRESENCE, currentPlayerId: 'me', self: null,
  })
  // Kaz is fighting a Scorpion in a room flagged safe: the fight is the reading.
  assert.equal(squad[0].state, 'fighting')
})

test('the viewer in a fight reads as fighting, same as anybody else', () => {
  const presence = {
    ...PRESENCE,
    me: presenceOf({
      id: 'me', username: 'Vex', level: 14, hp: 42, hpMax: 52,
      inBattle: true, battleEnemyName: 'Giant Rat',
    }),
  }
  const squad = buildSquad({
    party: PARTY, roomDanger: { dangerLevel: 0, isSafe: true }, roomPlayers: ROOM,
    presenceById: presence, currentPlayerId: 'me', self: null,
  })
  assert.equal(squad[1].isSelf, true)
  assert.equal(squad[1].state, 'fighting', 'your own tile is not exempt from the red')
  assert.equal(squad[1].statusLabel, 'Giant Rat')
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

test('the people standing here are described the same way the party is', () => {
  const outsiders = buildOutsiders({
    party: PARTY,
    roomDanger: { dangerLevel: 30, isSafe: false },
    roomPlayers: ROOM,
    presenceById: PRESENCE,
    currentPlayerId: 'me',
  })

  assert.deepEqual(outsiders.map((m) => m.id), ['stranger'], 'only the followable ones')
  const tam = outsiders[0]
  // The whole point: you can read their state without joining them first.
  assert.equal(tam.inParty, false)
  assert.equal(tam.level, 7)
  assert.equal(tam.hpPct, 100)
  assert.equal(tam.state, 'fighting', 'Tam is mid-fight and the tile says so')
  assert.equal(tam.isLeader, false, '"Leader" means the leader of *your* party')
})

test('someone who leads a party of their own is flagged before you follow them', () => {
  const room = [
    ...ROOM,
    roomOf({ id: 'boss', username: 'Rell', level: 20, partyLeaderId: 'boss' }),
  ]
  const outsiders = buildOutsiders({
    party: null, roomPlayers: room, presenceById: PRESENCE, currentPlayerId: 'me',
  })
  const rell = outsiders.find((m) => m.id === 'boss')
  assert.ok(rell)
  assert.equal(rell.leadsOwnParty, true, 'following them joins their group, not yours')
  assert.equal(outsiders.find((m) => m.id === 'stranger')?.leadsOwnParty, false)
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

test('the party sees how a fight is going, not only that there is one', () => {
  const glance = {
    id: 'lead', enemyName: 'Scorpion', enemyLevel: 8, enemyHp: 7, enemyHpMax: 20, enemyHpPct: 35,
    lastHit: 5, lastTook: 2, turn: 3, ts: NOW,
  }
  const [lead] = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me',
    glanceById: { lead: glance },
  })
  assert.equal(lead.state, 'fighting')
  assert.equal(lead.battle?.enemyHpPct, 35)
  assert.equal(lead.battle?.enemyLevel, 8, 'the chip draws the enemy like a player, so it needs their level')
  assert.equal(lead.statusLabel, 'Scorpion 35%')
})

test('a glance that outlived its fight is dropped: presence decides whether there is a fight', () => {
  const stale = { id: 'me', enemyName: 'Bat', enemyLevel: 3, enemyHp: 1, enemyHpMax: 5, enemyHpPct: 20, lastHit: 1, lastTook: 0, turn: 9, ts: NOW }
  const me = buildSquad({
    party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me',
    glanceById: { me: stale },
  }).find((m) => m.isSelf)!
  assert.equal(me.state, 'ready')
  assert.equal(me.battle, null)
})

test("a healthy member's label is a word, not the HP the bars already carry", () => {
  const squad = buildSquad({ party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me' })
  const me = squad.find((m) => m.isSelf)!
  assert.equal(me.state, 'ready')
  assert.equal(me.statusLabel, 'Ready')
  // The hover line is the vitals plus this label. While the label *was* the HP,
  // that line read "42/52 HP, 15/25 MP, 42/52" — the numbers, then the numbers.
  assert.ok(!me.statusLabel.includes('/'), 'the label must not repeat a vital')
})

test('hurt and safe name themselves too', () => {
  const squad = buildSquad({ party: PARTY, roomPlayers: ROOM, presenceById: PRESENCE, currentPlayerId: 'me' })
  assert.equal(squad[2].state, 'hurt')
  assert.equal(squad[2].statusLabel, 'Hurt')

  const inASafeRoom = buildSquad({
    party: PARTY,
    roomPlayers: ROOM,
    presenceById: PRESENCE,
    currentPlayerId: 'me',
    roomDanger: { dangerLevel: 1, isSafe: true },
  })
  const me = inASafeRoom.find((m) => m.isSelf)!
  assert.equal(me.state, 'safe')
  assert.equal(me.statusLabel, 'Safe')
  assert.ok(!me.statusLabel.includes('/'))
})

test('no state labels itself with the numbers the bars already draw', () => {
  // One member per state the ladder can reach without a room reading. `ready`
  // and `safe` are covered above; between them that is all seven.
  const party: PartySnapshot = {
    ...PARTY,
    leaderId: 'a',
    leader: { id: 'a', username: 'A', level: 10, uIcon: null, uIconColor: null },
    members: ['b', 'c', 'd', 'e'].map((id) => ({
      id, username: id.toUpperCase(), level: 10, uIcon: null, uIconColor: null,
    })),
    size: 5,
  }
  const presence: Record<string, PresencePlayer> = {
    a: presenceOf({ id: 'a', username: 'A', hp: 0, hpMax: 40 }),
    b: presenceOf({ id: 'b', username: 'B', inBattle: true, battleEnemyName: 'Rat' }),
    c: presenceOf({ id: 'c', username: 'C', hp: 2, hpMax: 40 }),
    d: presenceOf({ id: 'd', username: 'D', status: 'idle' }),
    // 'e' is in no feed at all, which is what being offline looks like here.
  }
  const squad = buildSquad({ party, roomPlayers: [], presenceById: presence, currentPlayerId: 'nobody' })

  assert.deepEqual(
    squad.map((m) => m.state),
    ['down', 'fighting', 'hurt', 'idle', 'offline'],
    'the fixture must actually reach every state it claims to'
  )
  for (const member of squad) {
    assert.ok(
      !member.statusLabel.includes('/'),
      `${member.state} labels itself "${member.statusLabel}", which repeats a vital`
    )
  }
})
