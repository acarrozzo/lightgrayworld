/**
 * Boss rest timers: how long a ranked enemy stays down after you kill it.
 *
 * Decided 4–5 Nov 2026. Beat a boss and it stays down for a while, for you
 * (per player, per enemy): it is stripped from its lair's roll, the lair reads
 * SAFE, and its Boss Chest — one open per kill — is open. The clock starts at the
 * kill, not when you leave, and is written as `KillList.lastKilledAt` in the
 * win transaction, so a refresh, a second tab, or a server restart changes
 * nothing. Only a ranked enemy with a `lair` rests: that is the same set as the
 * Bosses teleport ladder (teleport-destinations.js). A ranked enemy that moves
 * (King Blade, Jikay, Jiemji) rests nowhere.
 *
 * The rest is the enemy's level band, minibosses at half; a definition may
 * carry its own `rest` (minutes) to override its band, the way `lair` is set
 * by hand. The bands were saved from the Boss Rest Timers review page on
 * 5 Nov 2026 (its db doc config/bosses): the Gator's 5 minutes, L60 about 6 h,
 * L100 24 h.
 *
 * Shared by the server (the roll, the win, the Boss Chest) and the client (the
 * strip's "rests 5m", the bestiary card, the World Tool's enemies page) — a
 * plain module with no engine imports, like crafting-recipes.js.
 */

/** `[upToLevel, minutes]`, read top to bottom: the first rung the level fits. */
const REST_BANDS = [
  [9, 5],
  [19, 30],
  [29, 60],
  [39, 120],
  [49, 180],
  [59, 240],
  [69, 360],
  [79, 480],
  [89, 720],
  [99, 1080],
  [100, 1440],
]

/** A miniboss rests this fraction of its band. */
const MINIBOSS_FACTOR = 0.5

const MINUTE_MS = 60 * 1000

/** The band's minutes for a level, before the miniboss factor. */
function bandMinutes(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1))
  for (const [upTo, minutes] of REST_BANDS) if (lvl <= upTo) return minutes
  return REST_BANDS[REST_BANDS.length - 1][1]
}

/**
 * Whether this enemy rests after a kill: ranked, with a lair. Takes a
 * definition from enemies.js or the browser's bosses.generated.js copy.
 * @param {{ rank?: string, lair?: string | null } | null | undefined} enemy
 */
function isRestingBoss(enemy) {
  return Boolean(enemy && (enemy.rank === 'boss' || enemy.rank === 'miniboss') && enemy.lair)
}

/**
 * How long this enemy rests after a kill, in minutes — 0 when it never rests.
 * @param {{ rank?: string, lair?: string | null, level?: number, rest?: number } | null | undefined} enemy
 */
function restMinutesFor(enemy) {
  if (!isRestingBoss(enemy)) return 0
  if (typeof enemy.rest === 'number' && enemy.rest > 0) return Math.round(enemy.rest)
  const base = bandMinutes(enemy.level)
  return Math.max(1, Math.round(enemy.rank === 'miniboss' ? base * MINIBOSS_FACTOR : base))
}

/** The same, in milliseconds. */
function restMsFor(enemy) {
  return restMinutesFor(enemy) * MINUTE_MS
}

/**
 * When a rest that began at `lastKilledAt` ends, as a ms timestamp — or null
 * when the enemy never rests or has no kill. `lastKilledAt` is a Date, a ms
 * number, or an ISO string, whatever the row or the mirror holds.
 * @returns {number | null}
 */
function restingUntil(enemy, lastKilledAt) {
  const ms = restMsFor(enemy)
  if (!ms || lastKilledAt == null) return null
  const at = lastKilledAt instanceof Date ? lastKilledAt.getTime() : new Date(lastKilledAt).getTime()
  if (!Number.isFinite(at)) return null
  return at + ms
}

/** True while the rest that began at `lastKilledAt` is still running at `now`. */
function isResting(enemy, lastKilledAt, now = Date.now()) {
  const until = restingUntil(enemy, lastKilledAt)
  return until != null && until > now
}

/**
 * "5m", "2h", "1h 30m" — the rest's length for a label. The live countdown
 * ("4:32") is the client's, from the server's `restingUntil`.
 */
function formatRestMinutes(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h ${rest}m` : `${h}h`
}

module.exports = {
  REST_BANDS,
  MINIBOSS_FACTOR,
  bandMinutes,
  isRestingBoss,
  restMinutesFor,
  restMsFor,
  restingUntil,
  isResting,
  formatRestMinutes,
}
