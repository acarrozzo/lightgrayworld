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
const { MAX_PARTY_SIZE, MAX_PARTY_NAME } = require('../party/party-limits.js')

// Global singleton survives Next.js hot-module reloads in dev
if (!global.__partyStore) {
  global.__partyStore = {
    parties: new Map(), // leaderId -> { leaderId, leaderInfo, members: Map<memberId, info> }
    memberToLeader: new Map(), // memberId -> leaderId
    // targetId -> Map<requesterId, { requesterInfo, targetInfo, timer }>. Asking
    // to follow someone is a request now, not a fait accompli, so it has to be
    // remembered between the ask and the answer.
    requests: new Map(),
  }
}

const store = global.__partyStore
if (!store.requests) store.requests = new Map()

/** How long a follow request waits before it is dropped as unanswered. */
const FOLLOW_REQUEST_TTL_MS = 60_000

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
    // What the leader has chosen to call this lot, or null for plain "Party".
    name: party.name ?? null,
  }
}

/** Party names are for fun, so the only rules are the ones that keep them printable. */
function sanitizePartyName(raw) {
  if (raw == null) return null
  const cleaned = String(raw)
    // Keep only printable characters — letters, digits, punctuation, symbols and
    // spaces. Anything else (control codes, format joiners) would break the one
    // line the pill has to draw, and stated as a keep-list this needs no
    // exception for whatever arrives next.
    .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Zs}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PARTY_NAME)
  return cleaned || null
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

/**
 * Whether `followerInfo` may join whatever party `targetInfo` is in, right now.
 *
 * Checked twice on purpose: once when the request is made, so a hopeless ask is
 * refused immediately, and again when it is answered, because a minute can pass
 * in between and the party can fill up or close in that time.
 */
function checkFollowEligible(followerId, targetId) {
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

  // A member cannot answer for the party they merely belong to, so the ask
  // always goes to whoever leads it.
  return { ok: true, targetLeaderId }
}

/**
 * Ask to follow someone. Nobody joins anything until they say yes.
 *
 * Leading a party is a job — your travel drags other people through gates and
 * your fights hold them in place — so it is not something a stranger can hand
 * you by clicking. The request stands for a minute and then lapses.
 */
function requestFollow(followerInfo, targetInfo) {
  const followerId = followerInfo.id
  const eligible = checkFollowEligible(followerId, targetInfo.id)
  if (!eligible.ok) return eligible

  const { targetLeaderId } = eligible
  const leaderInfo = store.parties.get(targetLeaderId)?.leaderInfo ?? normInfo(targetInfo)

  let pending = store.requests.get(targetLeaderId)
  if (!pending) {
    pending = new Map()
    store.requests.set(targetLeaderId, pending)
  }
  if (pending.has(followerId)) {
    return { ok: false, error: `${leaderInfo.username} has not answered yet.` }
  }

  const expiresAt = Date.now() + FOLLOW_REQUEST_TTL_MS
  const timer = setTimeout(() => {
    if (resolveRequest(targetLeaderId, followerId, 'expired')) {
      notify([followerId], 'declined', `${leaderInfo.username} did not answer.`)
    }
  }, FOLLOW_REQUEST_TTL_MS)
  // A pending ask must never hold the process open on its own.
  if (typeof timer.unref === 'function') timer.unref()

  pending.set(followerId, { requesterInfo: normInfo(followerInfo), leaderInfo, timer })

  emitTo([targetLeaderId], SOCKET_EVENTS.PARTY_FOLLOW_REQUEST, {
    requesterId: followerId,
    requesterName: followerInfo.username,
    requesterLevel: followerInfo.level ?? 1,
    // Whether saying yes makes them a leader for the first time, which is the
    // part worth being asked about.
    wouldBecomeLeader: !store.parties.has(targetLeaderId),
    expiresAt,
  })
  emitTo([followerId], SOCKET_EVENTS.PARTY_FOLLOW_PENDING, {
    targetId: targetLeaderId,
    targetName: leaderInfo.username,
    expiresAt,
  })
  notify([followerId], 'asked', `You asked to follow ${leaderInfo.username}.`)
  return { ok: true, pending: true, targetId: targetLeaderId }
}

/** Forget one pending request. Returns true if there was one to forget. */
function cancelRequest(leaderId, requesterId) {
  const pending = store.requests.get(leaderId)
  const entry = pending?.get(requesterId)
  if (!entry) return false
  clearTimeout(entry.timer)
  pending.delete(requesterId)
  if (pending.size === 0) store.requests.delete(leaderId)
  return true
}

/**
 * End a request and tell both ends.
 *
 * Both ends matter equally: the leader has a prompt open that has to close, and
 * the asker has a button reading "Pending" that has to come back. An ask that
 * dies quietly leaves one of those two lying about the state of the world.
 */
function resolveRequest(leaderId, requesterId, outcome, reason = null) {
  if (!cancelRequest(leaderId, requesterId)) return false
  emitTo([leaderId, requesterId], SOCKET_EVENTS.PARTY_FOLLOW_RESOLVED, {
    requesterId,
    targetId: leaderId,
    outcome,
    reason,
  })
  return true
}

/**
 * End every request this player is either half of, because they have just done
 * something that makes the ask meaningless — walked out of the room, died, or
 * dropped their connection.
 *
 * Both directions, because both sides of a follow have to be standing in the
 * same room: whichever of them left, the ask is over.
 */
function cancelRequestsInvolving(playerId, outcome = 'cancelled', reason = null) {
  for (const requesterId of [...(store.requests.get(playerId)?.keys() ?? [])]) {
    resolveRequest(playerId, requesterId, outcome, reason)
  }
  for (const [leaderId, pending] of [...store.requests]) {
    if (pending.has(playerId)) resolveRequest(leaderId, playerId, outcome, reason)
  }
}

/** Silent teardown, for a player whose sockets are already gone. */
function clearRequestsFor(playerId) {
  cancelRequestsInvolving(playerId, 'cancelled', 'They are no longer available.')
}

/**
 * The leader's answer. `accept` false simply tells the asker no.
 *
 * `verify` is how the caller checks what this store cannot see. Rooms are the
 * case that matters: a follow is only legal between two people standing in the
 * same room, and a minute is long enough for the asker to have walked away.
 * Moving cancels a request outright, so this is the backstop rather than the
 * main defence — but a party is a thing you can be stranded in, and being
 * stranded is not a state worth trusting one mechanism to prevent.
 */
function answerFollow(leaderId, requesterId, accept, verify = null) {
  const entry = store.requests.get(leaderId)?.get(requesterId)
  if (!entry) return { ok: false, error: 'That request is no longer waiting.' }

  const leaderName = nameOf(leaderId, entry.leaderInfo.username)
  if (!accept) {
    resolveRequest(leaderId, requesterId, 'declined')
    notify([requesterId], 'declined', `${leaderName} declined to lead you.`)
    return { ok: true, accepted: false }
  }

  // A minute may have passed: re-check everything before letting anybody in.
  const eligible = checkFollowEligible(requesterId, leaderId)
  const blocked = eligible.ok ? verify?.(requesterId, leaderId) ?? null : eligible.error
  if (blocked) {
    resolveRequest(leaderId, requesterId, 'cancelled', blocked)
    notify([requesterId], 'declined', blocked)
    return { ok: false, error: blocked }
  }

  resolveRequest(leaderId, requesterId, 'accepted')
  return { ...follow(entry.requesterInfo, entry.leaderInfo), accepted: true }
}

// followerInfo / targetInfo: { id, username, level, uIcon, uIconColor }
// The join itself, once it has been agreed to. Not reachable from the socket
// layer directly — everything goes through requestFollow/answerFollow.
function follow(followerInfo, targetInfo) {
  const followerId = followerInfo.id
  const eligible = checkFollowEligible(followerId, targetInfo.id)
  if (!eligible.ok) return eligible
  const { targetLeaderId } = eligible

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
      name: null,
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
 * Name the party. Leader only, and purely cosmetic — nothing keys off it, so an
 * empty name simply returns the party to being called "Party".
 */
function setName(leaderId, name) {
  const party = store.parties.get(leaderId)
  if (!party) return { ok: false, error: 'You are not leading a party.' }
  const next = sanitizePartyName(name)
  if (party.name === next) return { ok: true, name: next }
  party.name = next
  broadcastUpdate(party)
  notify(
    [leaderId, ...party.members.keys()],
    'named',
    next ? `The party is now called "${next}".` : 'The party name was cleared.'
  )
  return { ok: true, name: next }
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
  if (next) {
    const why = `${party.leaderInfo?.username ?? 'They'} closed their party.`
    for (const requesterId of [...(store.requests.get(leaderId)?.keys() ?? [])]) {
      notify([requesterId], 'declined', why)
      resolveRequest(leaderId, requesterId, 'cancelled', why)
    }
  }
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
  // Someone who has just walked out of a party should not be answering asks to
  // join it a moment later.
  clearRequestsFor(playerId)
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
    // chat history reachable by the people who are still in it, and the name
    // they have been travelling under.
    id: party.id,
    leaderId: successorId,
    leaderInfo: successorInfo,
    members: followers,
    closed: party.closed === true,
    name: party.name ?? null,
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
  clearRequestsFor(playerId)
  detach(playerId, { notifySelf: false, reason: 'disconnect' })
}

// Player died and is being respawned elsewhere — they can't stay pinned, so drop them.
function onDeath(playerId) {
  clearRequestsFor(playerId)
  detach(playerId, { notifySelf: true, reason: 'death' })
}

module.exports = {
  MAX_PARTY_SIZE,
  requestFollow,
  answerFollow,
  cancelRequest,
  cancelRequestsInvolving,
  clearRequestsFor,
  follow,
  setClosed,
  setName,
  MAX_PARTY_NAME,
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
