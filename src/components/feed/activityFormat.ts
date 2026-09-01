import type { WorldFeedEntry } from '@/store/worldFeedStore'

/**
 * Maps an entry's outcome/level to the small accent-dot color class.
 * Shared between the ActivityTicker and the in-room ActionFlyout so the
 * success/failure/info colors stay identical across surfaces.
 */
export const entryAccent = (entry: Pick<WorldFeedEntry, 'outcome' | 'level'>) => {
  if (entry.outcome === 'success') return 'bg-status-success'
  if (entry.outcome === 'failure' || entry.level === 'error') return 'bg-status-error'
  return 'bg-resource-mp'
}

/**
 * Formats a timestamp as a short relative string ("now", "5s", "2m", "1h").
 */
export const formatRelative = (ts: number, now: number) => {
  const diff = Math.max(0, now - ts)
  if (diff < 5_000) return 'now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  return `${Math.floor(diff / 3_600_000)}h`
}
