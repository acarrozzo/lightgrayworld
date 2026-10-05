'use client'

import { feedLinkLabel, followFeedLink, type FeedLink } from '@/lib/feed-links'

/**
 * The small "Inv ›" at the end of a feed line that knows where it leads.
 * A button of its own, not the whole line, so selecting or reading the text
 * never navigates by accident.
 */
export default function FeedLinkButton({ link, className = '' }: { link?: FeedLink; className?: string }) {
  if (!link) return null
  const label = feedLinkLabel(link)
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        followFeedLink(link)
      }}
      title={`Open ${label}`}
      className={`shrink-0 whitespace-nowrap rounded border border-line-subtle/60 px-1.5 py-px text-[10px] font-semibold text-fg-secondary transition-colors hover:border-line-focus hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}
    >
      {label}
      <span className="text-fg-muted"> ›</span>
    </button>
  )
}
