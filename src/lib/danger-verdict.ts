/**
 * The danger verdict: a room's danger level read against the player's level.
 *
 * The original nav band printed "danger lvl 9 · HIGH" in its top-left corner,
 * with eleven rungs from SUPER EZ to SUICIDE!!!. This is the deliberate
 * five-rung cut (plus SAFE) chosen in September 2026: the same thresholds at
 * the edges, the two AVG rungs and the sub-half rungs folded together. The
 * number is always shown beside the word, so the ladder is flavour on top of
 * the real value, never a replacement for it.
 *
 * SAFE comes from the room's `isSafe` flag. The original showed SAFE once the
 * room's fight had ended; the modern game has no such flag, and a safe zone is
 * the closer meaning for a player deciding whether to walk in.
 *
 * Pure and shared: the compass corner, the mobile rail, and any future World
 * Tool view read the same ladder.
 */

export type DangerTone = 'safe' | 'easy' | 'fair' | 'even' | 'high' | 'deadly'

export interface DangerVerdict {
  /** The word: SAFE, EASY, FAIR, EVEN, HIGH, DEADLY. */
  label: string
  tone: DangerTone
  /** The room's danger level as shown, 0 when unknown. */
  level: number
}

/**
 * Colour per rung, as semantic roles so every theme places them. DEADLY is the
 * one filled pill: it should read before the word does.
 */
export const DANGER_TONE_CLASS: Record<DangerTone, string> = {
  safe: 'text-status-info',
  easy: 'text-status-success',
  fair: 'text-status-warning',
  even: 'text-mood-danger',
  high: 'text-status-error',
  deadly: 'fill-status-error px-1 rounded',
}

export function dangerVerdict(
  dangerLevel: number | null | undefined,
  isSafe: boolean | null | undefined,
  playerLevel: number | null | undefined
): DangerVerdict {
  const level = Math.max(0, Math.floor(Number(dangerLevel) || 0))
  if (isSafe) return { label: 'SAFE', tone: 'safe', level }

  const me = Math.max(1, Math.floor(Number(playerLevel) || 1))
  if (level < me / 2) return { label: 'EASY', tone: 'easy', level }
  if (level < me) return { label: 'FAIR', tone: 'fair', level }
  if (level === me) return { label: 'EVEN', tone: 'even', level }
  if (level < me * 2) return { label: 'HIGH', tone: 'high', level }
  return { label: 'DEADLY', tone: 'deadly', level }
}

/**
 * Gold for a corner or a header: full digits with separators until a million,
 * then "1.2m", as the original shortened it once the number stopped fitting.
 */
export function formatGold(amount: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m >= 10 ? Math.floor(m) : Math.floor(m * 10) / 10}m`
  }
  return n.toLocaleString()
}
