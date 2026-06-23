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
    leaderId: party.leaderId,
    leader: party.leaderInfo,
    members: Array.from(party.members.values()),
    size: 1 + party.members.size,
    maxSize: MAX_PARTY_SIZE,
  }
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

// All ids in the player's party (leader + members), or null if not in a party.
// Used by combat to count co-located party members.
function getParty(playerId) {
  const leaderId = getLeaderId(playerId)
  if (leaderId == null) return null
  const party = store.parties.get(leaderId)
  if (!party) return null
  return { leaderId, memberIds: [leaderId, ...party.members.keys()] }
}

// Remove a player from whatever party they're in, broadcasting side-effects.
// notifySelf controls whether the departing player gets a "you're partyless now" notice.
function detach(playerId, { notifySelf = true } = {}) {
  // Leader leaving -> disband the whole party
  if (store.parties.has(playerId)) {
    const party = store.parties.get(playerId)
    const memberIds = [...party.members.keys()]
    for (const mid of memberIds) store.memberToLeader.delete(mid)
    store.parties.delete(playerId)
    broadcastDisband(notifySelf ? [playerId, ...memberIds] : memberIds)
    return
  }

  // Member leaving
  if (store.memberToLeader.has(playerId)) {
    const leaderId = store.memberToLeader.get(playerId)
    store.memberToLeader.delete(playerId)
    const party = store.parties.get(leaderId)
    if (party) {
      party.members.delete(playerId)
      if (party.members.size === 0) {
        // Only the leader left -> dissolve; tell the former leader their party is gone
        store.parties.delete(leaderId)
        broadcastDisband([leaderId])
      } else {
        broadcastUpdate(party)
      }
    }
    if (notifySelf) broadcastDisband([playerId])
  }
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

  // Leave any current party first (disbands it if the follower was leading one).
  detach(followerId, { notifySelf: false })

  let party = store.parties.get(targetLeaderId)
  if (!party) {
    party = { leaderId: targetLeaderId, leaderInfo: normInfo(targetInfo), members: new Map() }
    store.parties.set(targetLeaderId, party)
  }
  party.members.set(followerId, normInfo(followerInfo))
  store.memberToLeader.set(followerId, targetLeaderId)
  broadcastUpdate(party)
  return { ok: true }
}

// Leader kicks a member.
function remove(leaderId, memberId) {
  const party = store.parties.get(leaderId)
  if (!party) return { ok: false, error: 'You are not leading a party.' }
  if (!party.members.has(memberId)) return { ok: false, error: 'That player is not in your party.' }

  party.members.delete(memberId)
  store.memberToLeader.delete(memberId)
  emitTo([memberId], SOCKET_EVENTS.PARTY_REMOVED, {})

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
  detach(playerId, { notifySelf: true })
}

// Connection lost — drop silently from the player's own side, still notify the rest.
function onDisconnect(playerId) {
  detach(playerId, { notifySelf: false })
}

// Player died and is being respawned elsewhere — they can't stay pinned, so drop them.
function onDeath(playerId) {
  detach(playerId, { notifySelf: true })
}

module.exports = {
  MAX_PARTY_SIZE,
  follow,
  remove,
  leave,
  onDisconnect,
  onDeath,
  isMember,
  isLeader,
  getLeaderMemberIds,
  getParty,
}
