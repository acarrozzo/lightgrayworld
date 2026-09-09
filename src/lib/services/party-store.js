// Ephemeral, in-memory party system.
//
// Model: flat parties — one leader plus up to MAX_PARTY_SIZE-1 members, no chains.
// "Following" someone places you in that person's party as a member (a party is
// created with them as leader if they were solo). One party per player; following
// someone new switches you. Members are pinned to the leader's room and cannot move
// on their own — only the leader's travel pulls them along.
//
// This store owns all party socket broadcasts so both the socket layer and the game
// engine (e.g. on death) can mutate parties without re-implementing emit logic.

const { getSocketIO, getSocketIdsForUser, SOCKET_EVENTS } = require('../socket-utils.js')
const { getPresence } = require('./presence-store.js')
const { randomUUID } = require('crypto')

const MAX_PARTY_SIZE = 6 // leader + 5

// Global singleton survives Next.js hot-module reloads in dev
if (!global.__partyStore) {
  global.__partyStore = {
    parties: new Map(), // leaderId -> { leaderId, leaderInfo, members: Map<memberId, info> }
    memberToLeader: new Map(), // memberId -> leaderId
  }
}

const store = global.__partyStore

function normInfo(p) {
  return {
    id: p.id,
    username: p.username,
    level: p.level ?? 1,
    uIcon: p.uIcon ?? null,
    uIconColor: p.uIconColor ?? null,
  }
}

/**
 * The level stored on a party row is the level the player had when the party
 * formed. Presence knows the current one and is patched on every level-up, so
 * read through to it and let the stored value be the fallback for a member who
 * has somehow left the roster.
 */
function withLiveLevel(info) {
  const live = getPresence(info.id)
  if (!live || typeof live.level !== 'number' || live.level === info.level) return info
  return { ...info, level: live.level }
}

function nameOf(playerId, fallback = 'Someone') {
  return getPresence(playerId)?.username || fallback
}

function emitTo(playerIds, event, payload) {
  const io = getSocketIO()
  if (!io) return
  for (const pid of playerIds) {
    for (const sid of getSocketIdsForUser(pid)) {
      io.to(sid).emit(event, payload)
    }
  }
}

function buildSnapshot(party) {
  return {
    // Stable for the life of the party, including across a succession — it is
    // what party chat is filed under, so it cannot be the leader's id.
    id: party.id,
    leaderId: party.leaderId,
    leader: withLiveLevel(party.leaderInfo),
    members: Array.from(party.members.values(), withLiveLevel),
    size: 1 + party.members.size,
    maxSize: MAX_PARTY_SIZE,
    // A closed party refuses new followers. Open by default: walking up to
    // someone and falling in behind them is the fast path this game had first.
    closed: party.closed === true,
  }
}

/**
 * One line about the party, sent to whoever is still in it.
 *
 * `kind` is what happened, not how to draw it — the client picks the wording's
 * colour from it. Every notice carries a timestamp because the feed orders by
 * server time, never by arrival.
 */
function notify(playerIds, kind, message, extra = {}) {
  if (!playerIds.length || !message) return
  emitTo(playerIds, SOCKET_EVENTS.PARTY_NOTICE, {
    id: randomUUID(),
    ts: Date.now(),
    kind,
    message,
    ...extra,
  })
}

/** Everyone in the player's party except the player, or [] when solo. */
function otherMemberIds(playerId) {
  const party = getParty(playerId)
  if (!party) return []
  return party.memberIds.filter((id) => id !== playerId)
}

/** Tell the rest of the party something about this player. */
function notifyOthers(playerId, kind, message, extra = {}) {
  notify(otherMemberIds(playerId), kind, message, extra)
}

function broadcastUpdate(party) {
  emitTo([party.leaderId, ...party.members.keys()], SOCKET_EVENTS.PARTY_UPDATED, buildSnapshot(party))
}

function broadcastDisband(playerIds) {
  if (playerIds.length) emitTo(playerIds, SOCKET_EVENTS.PARTY_DISBANDED, {})
}

// Resolve the leaderId for whatever party a player belongs to (as leader or member).
function getLeaderId(playerId) {
  if (store.parties.has(playerId)) return playerId
  if (store.memberToLeader.has(playerId)) return store.memberToLeader.get(playerId)
  return null
}

function isMember(playerId) {
  return store.memberToLeader.has(playerId)
}

function isLeader(playerId) {
  return store.parties.has(playerId)
}

// Member ids (excluding the leader) for the party this player leads, else [].
function getLeaderMemberIds(playerId) {
  const party = store.parties.get(playerId)
  if (!party) return []
  return [...party.members.keys()]
}

// The stable id of the party this player is in, or null when solo. Party chat
// is filed under it.
function getPartyId(playerId) {
  const leaderId = getLeaderId(playerId)
  if (leaderId == null) return null
  return store.parties.get(leaderId)?.id ?? null
}

// All ids in the player's party (leader + members), or null if not in a party.
// Used by combat to count co-located party members.
/**
 * The same snapshot shape broadcast as PARTY_UPDATED, or null when solo.
 *
 * Used to hand a reconnecting client its party on login. `null` matters as much
 * as a snapshot does: it is what lets the client clear a party strip left over
 * from before the connection dropped.
 */
function getPartySnapshot(playerId) {
  const leaderId = getLeaderId(playerId)
  if (leaderId == null) return null
  const party = store.parties.get(leaderId)
  if (!party) return null
  return buildSnapshot(party)
}

function getParty(playerId) {
  const leaderId = getLeaderId(playerId)
  if (leaderId == null) return null
  const party = store.parties.get(leaderId)
  if (!party) return null
  return { leaderId, memberIds: [leaderId, ...party.members.keys()] }
}

/**
 * How the party is told that somebody is no longer in it. The party list simply
 * getting shorter is not an event a player can notice, and one of these — a
 * death — is the most dramatic thing that can happen to a group.
 *
 * `null` means the caller narrates it itself (a switch of parties is the
 * follower's business, and a left-behind member needs the room's name).
 */
const DEPARTURE_NOTICE = {
  leave: (name) => `${name} left the party.`,
  disband: (name) => `${name} disbanded the party.`,
  disconnect: (name) => `${name} disconnected and left the party.`,
  death: (name) => `${name} has fallen.`,
  depart: (name) => `${name} escaped alone and left the party.`,
  switch: () => null,
  silent: () => null,
}

// Remove a player from whatever party they're in, broadcasting side-effects.
// notifySelf controls whether the departing player gets a "you're partyless now" notice.
// reason picks the line the people left behind read; 'silent' sends none.
function detach(playerId, { notifySelf = true, reason = 'leave' } = {}) {
  const name = nameOf(playerId)
  const line = (DEPARTURE_NOTICE[reason] ?? DEPARTURE_NOTICE.leave)(name)

  // Leader leaving -> disband the whole party
  if (store.parties.has(playerId)) {
    const party = store.parties.get(playerId)
    const memberIds = [...party.members.keys()]
    for (const mid of memberIds) store.memberToLeader.delete(mid)
    store.parties.delete(playerId)
    // Disband first: the notice explains a party list that has already gone.
    broadcastDisband(notifySelf ? [playerId, ...memberIds] : memberIds)
    const disbandLine = reason === 'leave' ? DEPARTURE_NOTICE.disband(name) : line
    if (disbandLine) notify(memberIds, reason === 'death' ? 'fallen' : 'leave', disbandLine, { actor: name })
    return
  }

  // Member leaving
  if (store.memberToLeader.has(playerId)) {
    const leaderId = store.memberToLeader.get(playerId)
    store.memberToLeader.delete(playerId)
    const party = store.parties.get(leaderId)
    if (party) {
      party.members.delete(playerId)
      const remaining = [leaderId, ...party.members.keys()]
      if (party.members.size === 0) {
        // Only the leader left -> dissolve; tell the former leader their party is gone
        store.parties.delete(leaderId)
        broadcastDisband([leaderId])
      } else {
        broadcastUpdate(party)
      }
      if (line) notify(remaining, reason === 'death' ? 'fallen' : 'leave', line, { actor: name })
    }
    if (notifySelf) broadcastDisband([playerId])
  }
}

/**
 * Drop a member who could not follow their leader out of the room.
 *
 * Membership means "pinned to the leader's room and unable to walk", so a member
 * who is still in the old room is in a state the rest of the store does not
 * admit: stranded and unable to move. Returning them to travelling alone is the
 * only resolution that keeps that invariant true, and both sides are told why.
 */
function leaveBehind(playerId, { destinationName = null } = {}) {
  const leaderId = getLeaderId(playerId)
  if (leaderId == null || leaderId === playerId) return false
  const name = nameOf(playerId)
  const where = destinationName ? ` to ${destinationName}` : ''
  notifyOthers(playerId, 'left-behind', `${name} could not follow the party${where} and was left behind.`, {
    actor: name,
  })
  notify(
    [playerId],
    'left-behind',
    `You could not follow your party${where}. You are travelling alone again.`
  )
  detach(playerId, { notifySelf: true, reason: 'silent' })
  return true
}

// followerInfo / targetInfo: { id, username, level, uIcon, uIconColor }
function follow(followerInfo, targetInfo) {
  const followerId = followerInfo.id
  const targetId = targetInfo.id

  if (followerId === targetId) return { ok: false, error: 'You cannot follow yourself.' }

  const targetLeaderId = getLeaderId(targetId) ?? targetId

  if (targetLeaderId === followerId) {
    return { ok: false, error: 'They are already in your party.' }
  }

  const followerLeaderId = getLeaderId(followerId)
  if (followerLeaderId != null && followerLeaderId === targetLeaderId) {
    return { ok: false, error: 'You are already in that party.' }
  }

  const destParty = store.parties.get(targetLeaderId)
  const destSize = destParty ? 1 + destParty.members.size : 1
  if (destSize >= MAX_PARTY_SIZE) return { ok: false, error: 'That party is full.' }
  // A closed party is the leader's own decision, so it is refused by name
  // rather than by rule — the follower should know who to ask.
  if (destParty && destParty.closed === true) {
    return { ok: false, error: `${destParty.leaderInfo?.username ?? 'That party'} has closed their party.` }
  }

  // Leave any current party first (disbands it if the follower was leading one).
  detach(followerId, { notifySelf: false, reason: 'switch' })

  let party = store.parties.get(targetLeaderId)
  const formed = !party
  if (!party) {
    party = {
      id: randomUUID(),
      leaderId: targetLeaderId,
      leaderInfo: normInfo(targetInfo),
      members: new Map(),
      closed: false,
    }
    store.parties.set(targetLeaderId, party)
  }
  party.members.set(followerId, normInfo(followerInfo))
  store.memberToLeader.set(followerId, targetLeaderId)
  broadcastUpdate(party)

  // Following is unilateral, so the person being followed learns about their
  // new party from this line rather than from a snapshot appearing.
  const followerName = followerInfo.username || 'Someone'
  notify(
    [targetLeaderId],
    'join',
    formed
      ? `${followerName} is following you. You are leading a party.`
      : `${followerName} joined your party.`,
    { actor: followerName }
  )
  const others = [...party.members.keys()].filter((id) => id !== followerId)
  notify(others, 'join', `${followerName} joined the party.`, { actor: followerName })
  const leaderName = targetInfo.username || 'them'
  notify([followerId], 'join', `You are following ${leaderName}. They lead where the party goes.`)
  return { ok: true, partyId: party.id }
}

/**
 * Open or close a party to new followers. Leader only — a member closing the
 * party they merely belong to would be deciding for someone else.
 */
function setClosed(leaderId, closed) {
  const party = store.parties.get(leaderId)
  if (!party) return { ok: false, error: 'You are not leading a party.' }
  const next = closed === true
  if (party.closed === next) return { ok: true, closed: next }
  party.closed = next
  broadcastUpdate(party)
  notify(
    [leaderId, ...party.members.keys()],
    'closed',
    next ? 'The party is closed to new followers.' : 'The party is open to new followers.'
  )
  return { ok: true, closed: next }
}

// Leader kicks a member.
function remove(leaderId, memberId) {
  const party = store.parties.get(leaderId)
  if (!party) return { ok: false, error: 'You are not leading a party.' }
  if (!party.members.has(memberId)) return { ok: false, error: 'That player is not in your party.' }

  const removedName = party.members.get(memberId)?.username ?? nameOf(memberId)
  party.members.delete(memberId)
  store.memberToLeader.delete(memberId)
  emitTo([memberId], SOCKET_EVENTS.PARTY_REMOVED, {})
  notify([leaderId, ...party.members.keys()], 'leave', `${removedName} was removed from the party.`, {
    actor: removedName,
  })

  if (party.members.size === 0) {
    store.parties.delete(leaderId)
    broadcastDisband([leaderId])
  } else {
    broadcastUpdate(party)
  }
  return { ok: true }
}

// Voluntary leave (member) or disband (leader).
function leave(playerId) {
  detach(playerId, { notifySelf: true, reason: 'leave' })
}

/**
 * A player breaks away from the party on their own — teleporting out of a fight,
 * which is an escape and not a march order, so nobody is dragged along with them.
 *
 * A member simply detaches. A leader hands the party on rather than collapsing
 * it: whoever has been in it longest takes over, since `members` is a Map and
 * therefore in join order. The handover needs somebody left to follow the new
 * leader — a leader plus one member who is now alone is not a party, and the
 * rest of this store already treats that as dissolved — so with fewer than two
 * members behind them the party goes with the leader who left.
 *
 * @returns {{ promotedId: string|null, promotedName: string|null }} who is
 *   leading now, so the caller can say so.
 */
function departAlone(playerId) {
  const party = store.parties.get(playerId)
  if (!party) {
    // An ordinary member walking out.
    detach(playerId, { notifySelf: true, reason: 'depart' })
    return { promotedId: null, promotedName: null }
  }

  const memberIds = [...party.members.keys()]
  if (memberIds.length < 2) {
    // Nobody to hand it to, or only one person to hand it to and no one to lead.
    detach(playerId, { notifySelf: true, reason: 'depart' })
    return { promotedId: null, promotedName: null }
  }

  const successorId = memberIds[0]
  const successorInfo = party.members.get(successorId)
  const followers = new Map(party.members)
  followers.delete(successorId)

  store.parties.delete(playerId)
  store.memberToLeader.delete(successorId)

  const promoted = {
    // The same party under new management: keeping the id keeps the party's
    // chat history reachable by the people who are still in it.
    id: party.id,
    leaderId: successorId,
    leaderInfo: successorInfo,
    members: followers,
    closed: party.closed === true,
  }
  store.parties.set(successorId, promoted)
  for (const memberId of followers.keys()) store.memberToLeader.set(memberId, successorId)

  // The one who left is on their own; everyone else sees the new leader.
  broadcastDisband([playerId])
  broadcastUpdate(promoted)
  notify(
    [successorId, ...followers.keys()],
    'leave',
    `${nameOf(playerId)} escaped alone. ${successorInfo?.username ?? 'Someone'} is leading the party now.`,
    { actor: nameOf(playerId) }
  )

  return { promotedId: successorId, promotedName: successorInfo?.username ?? null }
}

// Connection lost — drop silently from the player's own side, still notify the rest.
function onDisconnect(playerId) {
  detach(playerId, { notifySelf: false, reason: 'disconnect' })
}

// Player died and is being respawned elsewhere — they can't stay pinned, so drop them.
function onDeath(playerId) {
  detach(playerId, { notifySelf: true, reason: 'death' })
}

module.exports = {
  MAX_PARTY_SIZE,
  follow,
  setClosed,
  remove,
  leave,
  leaveBehind,
  departAlone,
  onDisconnect,
  onDeath,
  isMember,
  isLeader,
  getLeaderId,
  getLeaderMemberIds,
  getParty,
  getPartyId,
  getPartySnapshot,
  notify,
  notifyOthers,
  otherMemberIds,
}
