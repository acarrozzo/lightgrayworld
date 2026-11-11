/**
 * The boss rest clock as the browser reads it: the rule from
 * game-data/boss-rest.js (a plain CommonJS module, shared with the server)
 * over the browser-sized boss copy (bosses.generated.js) and the kill list's
 * `lastKilledAt`. The Travel tab's chips, the Kill List and the bestiary card
 * work out "resting until" from these; the room card's strip takes the
 * server's own `bossRest` payload instead, which carries a seconds count.
 */
import type { KillEntry } from './game-state'

const { BOSSES } = require('./game-data/bosses.generated') as {
  BOSSES: Array<{ slug: string; name: string; level: number; rank: 'boss' | 'miniboss'; lair?: string }>
}
const bossRest = require('./game-data/boss-rest') as {
  isRestingBoss: (enemy: unknown) => boolean
  restMinutesFor: (enemy: unknown) => number
  restingUntil: (enemy: unknown, lastKilledAt: string | number | Date | null | undefined) => number | null
  formatRestMinutes: (minutes: number) => string
}

const BOSS_BY_SLUG = new Map(BOSSES.map((boss) => [boss.slug, boss]))

/** How long this enemy rests after a kill, in minutes; 0 when it never rests. */
export function restMinutesForSlug(slug: string): number {
  const boss = BOSS_BY_SLUG.get(slug)
  return boss ? bossRest.restMinutesFor(boss) : 0
}

/** "5m", "2h", "1h 30m". */
export const formatRestMinutes: (minutes: number) => string = bossRest.formatRestMinutes

/**
 * Server epoch ms when each resting boss gets back up, from the kill list.
 * Only bosses still resting at `now` are listed.
 */
export function restingUntilBySlug(killList: KillEntry[], now = Date.now()): Record<string, number> {
  const out: Record<string, number> = {}
  for (const entry of killList) {
    if (!entry.lastKilledAt) continue
    const boss = BOSS_BY_SLUG.get(entry.monster)
    if (!boss) continue
    const until = bossRest.restingUntil(boss, entry.lastKilledAt)
    if (until != null && until > now) out[entry.monster] = until
  }
  return out
}

/**
 * The countdown's text. Under ten minutes it ticks ("4:32"); under an hour
 * it is minutes ("23m"); above that hours and minutes ("5h 12m"), which is
 * what the server's own formatter writes for the gather nodes.
 */
export function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft))
  if (s < 600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return m ? `${h}h ${m}m` : `${h}h`
}
