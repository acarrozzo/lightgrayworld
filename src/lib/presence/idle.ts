/**
 * Idle, as the client reads it.
 *
 * The server decides who is idle and since when (`idleSince` on the presence
 * entry, carried as `lastSeen` on a room card). Everything here is derived from
 * that one timestamp: how long, which tier, what the label says, and when it is
 * worth telling a follower their leader has wandered off. Nothing is stored.
 *
 * The room card, the roster and the party rail each used to format this their
 * own way ("Idle 3m ago", "idle", "Idle 3m"); they all call `idleLabel` now.
 */

/** Past this an idle player reads as Away: not coming back in the next minute. */
export const IDLE_AWAY_MS = 30 * 60 * 1000

/** A follower is pinned to their leader, so a leader idle this long is worth a nudge. */
export const LEADER_IDLE_NUDGE_MS = 10 * 60 * 1000

export type IdleTier = 'idle' | 'away'

/* ───────────────────────── the server's clock ───────────────────────── */

// `idleSince` is a server timestamp, so "how long" has to be counted against
// the server's clock: a laptop running two minutes fast would otherwise read
// every idle player as two minutes more idle than they are. Every presence
// message carries the server's time; the presence store notes it here, and
// `serverNow()` is the default "now" for everything below.
let clockOffsetMs = 0

/** Record the server's time as of a message that has just arrived. */
export function noteServerTime(serverTime: number | null | undefined, clientNow: number = Date.now()): void {
  if (typeof serverTime !== 'number' || !Number.isFinite(serverTime)) return
  clockOffsetMs = serverTime - clientNow
}

/** The current time on the server's clock, as best the client knows it. */
export function serverNow(): number {
  return Date.now() + clockOffsetMs
}

/** "45s", "12m", "3h", "2d": a duration, with no "ago". Empty when there is no timestamp. */
export function shortAgo(ts?: number | null, now: number = serverNow()): string {
  if (!ts) return ''
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** How long they have been quiet, in ms. 0 when unknown. */
export function idleMs(since?: number | null, now: number = serverNow()): number {
  if (!since) return 0
  return Math.max(0, now - since)
}

export function idleTier(since?: number | null, now: number = serverNow()): IdleTier {
  return idleMs(since, now) >= IDLE_AWAY_MS ? 'away' : 'idle'
}

/** "Idle 12m" or "Away 45m"; just the word when there is no timestamp. */
export function idleLabel(since?: number | null, now: number = serverNow()): string {
  const word = idleTier(since, now) === 'away' ? 'Away' : 'Idle'
  const ago = shortAgo(since, now)
  return ago ? `${word} ${ago}` : word
}

/**
 * What to say on a Follow control aimed at somebody idle: they have a minute to
 * answer an ask, and somebody away from the keyboard will not.
 */
export function idleFollowWarning(username: string, since?: number | null, now: number = serverNow()): string {
  return `${username} is ${idleLabel(since, now).toLowerCase()} and may not answer`
}

/** Whether a follower should be offered the way out of a party whose leader is idle. */
export function shouldNudgeLeaderIdle(
  leader: { presence: string; lastSeen?: number | null; inBattle?: boolean } | null | undefined,
  now: number = serverNow()
): boolean {
  if (!leader || leader.presence !== 'idle' || leader.inBattle) return false
  return idleMs(leader.lastSeen, now) >= LEADER_IDLE_NUDGE_MS
}

/* ───────────────────────── the "still here" throttle ───────────────────────── */

/** At most one "still here" message per this long. Far inside the server's 5 minute threshold. */
export const HEARTBEAT_MIN_MS = 60 * 1000

export interface HeartbeatState {
  /** When the last ping that landed (or is in flight) was sent; 0 when none has. */
  lastSentAt: number
  inFlight: boolean
}

/**
 * Whether this input should send a ping. Pure, so the rule is testable: one a
 * minute, never two at once, and the first input after a quiet spell goes
 * straight away (which is what makes returning from idle immediate).
 */
export function nextHeartbeat(state: HeartbeatState, now: number): { send: boolean; state: HeartbeatState } {
  if (state.inFlight) return { send: false, state }
  if (state.lastSentAt && now - state.lastSentAt < HEARTBEAT_MIN_MS) return { send: false, state }
  return { send: true, state: { lastSentAt: now, inFlight: true } }
}

/** A ping that did not land is retried on the next input after this long, not after the full minute. */
export const HEARTBEAT_RETRY_MS = 3 * 1000

/**
 * The state after a ping comes back. One that landed holds the minute; one that
 * did not (sent before login finished, or lost) is due again in a few seconds,
 * so a page that has just loaded wakes an idle session almost at once without
 * every pointer move becoming a message.
 */
export function settleHeartbeat(sentAt: number, landed: boolean): HeartbeatState {
  return {
    lastSentAt: landed ? sentAt : sentAt - HEARTBEAT_MIN_MS + HEARTBEAT_RETRY_MS,
    inFlight: false,
  }
}
