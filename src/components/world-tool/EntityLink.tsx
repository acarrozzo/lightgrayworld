'use client'

/**
 * Links between World Tool pages, and the anchor machinery they land on.
 *
 * The world is a graph — a room spawns enemies, an enemy drops items, an item
 * is found in rooms — but the tool used to render it as separate tables with no
 * way to follow an edge. These are the edges.
 *
 * Targets are addressed by their stable identity (an enemy or item slug, a room
 * id), never by display name, so a rename never breaks a link.
 */

import Link from 'next/link'
import { useEffect } from 'react'

// Re-exported so callers can pull the link and its target from one place.
export {
  enemyHref,
  itemHref,
  roomHref,
  roomDescHref,
  questHref,
  questGiverHref,
  skillHref,
  spellHref,
  recipeHref,
  shopHref,
} from './hrefs'

const LINK_CLASS =
  'text-accent-hover/85 underline decoration-line-subtle underline-offset-2 transition-colors hover:text-accent-hover hover:decoration-accent-hover'

/** A link to another World Tool page, styled so it reads as a cross-reference. */
export function EntityLink({
  href,
  title,
  children,
  className = '',
}: {
  href: string
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link href={href} title={title} className={`${LINK_CLASS} ${className}`}>
      {children}
    </Link>
  )
}

/**
 * Scroll to the row `data-anchor={id}` marks, and flash it.
 *
 * Deliberately not native `#id` anchoring. A list page can render a row more
 * than once — a table for wide screens and a card for narrow — so a plain `id`
 * would be duplicated, and the copy the browser found first would be the one
 * that is `display: none` at that width, which it then cannot scroll to.
 * Marking rows with `data-anchor` and picking the one that is actually laid
 * out makes a link work at every width.
 *
 * The flash is an outline rather than a background so it reads the same on a
 * table row and on a card, neither of which share a background.
 *
 * Exported on its own, not only through the hook, because the rail's search
 * jumps within the current page by rewriting the hash with `replaceState`,
 * which fires no `hashchange` — so it calls this directly.
 */
export function revealAnchor(id: string): ReturnType<typeof setTimeout> | undefined {
  if (!id) return
  const matches = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-anchor="${CSS.escape(id)}"]`)
  )
  // offsetParent is null for anything the current breakpoint has hidden.
  const el = matches.find((m) => m.offsetParent !== null) ?? matches[0]
  if (!el) return
  el.scrollIntoView({ block: 'center' })
  el.style.outline = '2px solid var(--accent)'
  el.style.outlineOffset = '-2px'
  return setTimeout(() => {
    el.style.outline = ''
    el.style.outlineOffset = ''
  }, 1800)
}

/** Reveal whatever the URL fragment names, on mount and whenever it changes. */
export function useAnchorTarget() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    function go() {
      if (timer) clearTimeout(timer)
      timer = revealAnchor(decodeURIComponent(window.location.hash.slice(1)))
    }

    // A frame's grace so the rows exist before we look for them.
    const raf = requestAnimationFrame(go)
    window.addEventListener('hashchange', go)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('hashchange', go)
      if (timer) clearTimeout(timer)
    }
  }, [])
}
