'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Home, Skull, Sword, ScrollText, Map, Users, Palette, Sparkles, Swords, Columns2, type LucideIcon } from 'lucide-react'

// Top navigation bar shared across the Light Gray World Tool pages.
// To add a new World Tool page, add an entry here and pass its `key` as the
// `active` prop from that page.
const NAV_ITEMS: { key: string; href: string; label: string; icon: LucideIcon }[] = [
  { key: 'home', href: '/world-tool', label: 'Home', icon: Home },
  { key: 'enemies', href: '/enemies', label: 'Bestiary', icon: Skull },
  // Labelled "Items" rather than "Item Compendium" (the page's own title): ten
  // links only fit the container's max-w-7xl without scrolling if this one is
  // short, and the icon plus the URL already say what it is.
  { key: 'items', href: '/items', label: 'Items', icon: Sword },
  { key: 'quests', href: '/quests', label: 'Quests', icon: ScrollText },
  { key: 'skills', href: '/skills', label: 'Skills', icon: Swords },
  { key: 'spells', href: '/spells', label: 'Spells', icon: Sparkles },
  { key: 'rooms', href: '/rooms', label: 'World Atlas', icon: Map },
  { key: 'room-desc', href: '/room-desc', label: 'Room Desc', icon: Columns2 },
  { key: 'players', href: '/players', label: 'Players', icon: Users },
  { key: 'themes', href: '/themes', label: 'Themes', icon: Palette },
]

export default function WorldToolNav({ active }: { active: string }) {
  // The link row is a horizontal scroll strip rather than a wrapping or
  // shrinking one: nine links need ~1000px, so on anything narrower they would
  // otherwise be clipped by the page and drag the whole document sideways with
  // them. Scrolling the strip keeps the header one row tall at every width and
  // keeps every page reachable.
  const stripRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  // The current page's link is often past the fold on a narrow screen, which
  // would leave the header looking like it had no selection at all. Nudge the
  // strip — and only the strip — until that link is showing.
  useEffect(() => {
    const strip = stripRef.current
    const link = activeRef.current
    if (!strip || !link) return
    // Measured with rects rather than offsetLeft: the strip is statically
    // positioned, so offsetLeft counts from <body> and would include the brand
    // beside it — which read as an overflow and scrolled the first link away.
    const margin = 12
    const stripBox = strip.getBoundingClientRect()
    const linkBox = link.getBoundingClientRect()
    const overflowRight = linkBox.right - stripBox.right
    const overflowLeft = stripBox.left - linkBox.left
    if (overflowRight > 0) strip.scrollLeft += overflowRight + margin
    else if (overflowLeft > 0) strip.scrollLeft -= overflowLeft + margin
  }, [active])

  return (
    <nav className="border-b border-line-subtle bg-surface-panel">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link
          href="/world-tool"
          className="shrink-0 text-base font-bold whitespace-nowrap text-fg-bright/80 hover:text-fg-bright"
        >
          Light Gray World Tool
        </Link>
        <div
          ref={stripRef}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto sm:gap-2"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                ref={isActive ? activeRef : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={
                  // px-3 rather than the old sm:px-4: at the container's
                  // max-w-7xl the nine links needed 1091px against 1066px of
                  // room, so the widest desktop still had to scroll to reach
                  // Themes. The tighter padding buys 72px and fits it.
                  'flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ' +
                  (isActive
                    ? 'border-accent fill-accent shadow-sm'
                    : 'border-line-subtle fill-surface-raised hover:border-line-strong hover:bg-surface-hover/80 hover:text-fg-bright')
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
