/**
 * The database reads behind the authored World Tool pages, cached.
 *
 * Every reference page read its data straight from the database on each
 * request — one to three round trips to Supabase before a byte was sent — for
 * data that only changes on deploy or reseed. This keeps those reads for a
 * few minutes and serves them stale while the next read refreshes them in the
 * background, so in production a page's cost is its render.
 *
 * Only the reads are cached, not the page. The rail's remembered width comes
 * from a cookie and the list filters from `useSearchParams`, both request-time
 * APIs; a statically cached page would have to hand its tables to the client
 * to render after load and would forget the rail's width.
 *
 * Development is left uncached so an edit to a seed or a data file shows on
 * the next reload; production is where the round trips cost.
 *
 * Whatever the loader returns is stored as JSON: plain arrays and objects
 * survive, a Map does not, and a Date comes back as a string — so callers
 * cache the rows and build their Maps after.
 */

import { unstable_cache } from 'next/cache'

/** Long enough to absorb a burst of visits; short enough that a reseed shows before anyone wonders. */
export const WORLD_TOOL_REVALIDATE_SECONDS = 300

/** Every World Tool cache carries this tag, so `revalidateTag` can purge them all at once. */
export const WORLD_TOOL_CACHE_TAG = 'world-tool'

export function cachedWorldToolData<T>(key: string, load: () => Promise<T>): () => Promise<T> {
  if (process.env.NODE_ENV !== 'production') return load
  return unstable_cache(load, ['world-tool', key], {
    revalidate: WORLD_TOOL_REVALIDATE_SECONDS,
    tags: [WORLD_TOOL_CACHE_TAG],
  })
}
