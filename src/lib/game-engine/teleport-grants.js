/**
 * Single-use permission for one player to teleport to one specific room.
 *
 * Some destinations are decided by the server but navigated by the client: a
 * guild lair the room handler just unlocked, the respawn room after a defeat,
 * the room a flee retreats into. In each case the server names the room and the
 * client echoes it back as a `teleport` action — which, on its own, would mean
 * trusting a client-supplied destination.
 *
 * A grant closes that: the server records the room it just named, and the
 * teleport handler will only accept a destination that is either part of the
 * fixed network (`game-data/teleport-destinations`) or matches a live grant.
 * Grants are consumed on use and expire, so an echo cannot be replayed later to
 * reach the same room a second time.
 *
 * Ephemeral by design — grants live in memory and are lost on restart, which
 * only means a player must re-trigger the action that issued one. Held on
 * `globalThis` so Next.js module reloads and separately-bundled route modules
 * share one map, the same pattern the presence and ghost stores use.
 */

const DEFAULT_TTL_MS = 60_000

function store() {
  if (!globalThis.__teleportGrants) {
    globalThis.__teleportGrants = new Map() // playerId -> { roomId, expiresAt }
  }
  return globalThis.__teleportGrants
}

/**
 * Record that `playerId` may teleport to `roomId` once, within `ttlMs`.
 * A player holds at most one grant; issuing a new one replaces any pending grant.
 */
function grantTeleport(playerId, roomId, ttlMs = DEFAULT_TTL_MS) {
  if (!playerId || !roomId) return
  store().set(playerId, { roomId, expiresAt: Date.now() + ttlMs })
}

/**
 * Consume a grant for exactly this room. Returns true only when a live,
 * matching grant existed; the grant is removed either way if it had expired.
 */
function consumeTeleportGrant(playerId, roomId) {
  const grants = store()
  const grant = grants.get(playerId)
  if (!grant) return false

  if (grant.expiresAt <= Date.now()) {
    grants.delete(playerId)
    return false
  }

  if (grant.roomId !== roomId) return false

  grants.delete(playerId)
  return true
}

/** Drop any pending grant — used when a player disconnects. */
function clearTeleportGrants(playerId) {
  store().delete(playerId)
}

module.exports = {
  grantTeleport,
  consumeTeleportGrant,
  clearTeleportGrants,
}
