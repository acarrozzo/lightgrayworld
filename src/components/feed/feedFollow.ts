import type { WorldFeedEntry } from '@/store/worldFeedStore'

/**
 * Whether the feed should follow a batch of new entries to the bottom, and
 * how many of them count as unread chat when it does not.
 *
 * The store caps history and trims the oldest entry on every append, so the
 * array's length stops changing once the cap is reached. New entries are
 * therefore found by position after the previously newest id, never by a
 * change in length.
 */

/** How close to the bottom (px) still counts as reading the latest. */
export const FOLLOW_THRESHOLD_PX = 120

export type FeedFollowDecision = {
  /** Entries that were not in the previous array. */
  newEntries: WorldFeedEntry[]
  /** Snap the list to the bottom. */
  follow: boolean
  /** Chat lines the player has not seen, to add to the badge. */
  unreadChat: number
}

/** The entries in `next` that come after the newest entry of `prev`. */
export const newEntriesSince = (prev: WorldFeedEntry[], next: WorldFeedEntry[]): WorldFeedEntry[] => {
  if (prev.length === 0) return next
  const lastId = prev[prev.length - 1].id
  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i].id === lastId) return next.slice(i + 1)
  }
  // The previous newest entry is gone (feed cleared or wholly replaced):
  // everything is new.
  return next
}

export const isChatEntry = (entry: WorldFeedEntry): boolean =>
  entry.type === 'party' || ((entry.type === 'world' || entry.type === 'room') && !entry.eventType)

/**
 * @param distanceFromBottom px between the viewport bottom and the list
 *   bottom as it stood before the new rows were added; `null` when the list
 *   has never been measured (first paint), which follows.
 */
export const decideFeedFollow = (
  prev: WorldFeedEntry[],
  next: WorldFeedEntry[],
  distanceFromBottom: number | null,
): FeedFollowDecision => {
  const newEntries = newEntriesSince(prev, next)
  if (newEntries.length === 0) return { newEntries, follow: false, unreadChat: 0 }

  // Your own action always shows its result: the feed follows it to the
  // bottom even if you had scrolled up to read. Other people's lines only
  // pull the feed down when you are already near the bottom.
  const ownAction = newEntries.some((entry) => entry.type === 'action')
  const nearBottom = distanceFromBottom === null || distanceFromBottom < FOLLOW_THRESHOLD_PX
  if (ownAction || nearBottom) return { newEntries, follow: true, unreadChat: 0 }

  return { newEntries, follow: false, unreadChat: newEntries.filter(isChatEntry).length }
}
