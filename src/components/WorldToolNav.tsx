import Link from 'next/link'
import { Home, Skull, Sword, ScrollText, Map, Users, Palette, type LucideIcon } from 'lucide-react'

// Top navigation bar shared across the Light Gray World Tool pages.
// To add a new World Tool page, add an entry here and pass its `key` as the
// `active` prop from that page.
const NAV_ITEMS: { key: string; href: string; label: string; icon: LucideIcon }[] = [
  { key: 'home', href: '/world-tool', label: 'Home', icon: Home },
  { key: 'enemies', href: '/enemies', label: 'Bestiary', icon: Skull },
  { key: 'items', href: '/items', label: 'Item Compendium', icon: Sword },
  { key: 'quests', href: '/quests', label: 'Quests', icon: ScrollText },
  { key: 'rooms', href: '/rooms', label: 'World Atlas', icon: Map },
  { key: 'players', href: '/players', label: 'Players', icon: Users },
  { key: 'themes', href: '/themes', label: 'Themes', icon: Palette },
]

export default function WorldToolNav({ active }: { active: string }) {
  return (
    <nav className="border-b border-line-subtle bg-surface-panel">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link
          href="/world-tool"
          className="text-base font-bold text-fg-bright/80 hover:text-fg-bright"
        >
          Light Gray World Tool
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors sm:px-4 ' +
                  (isActive
                    ? 'border-accent bg-accent text-fg-bright shadow-sm'
                    : 'border-line-subtle bg-surface-raised/60 text-fg-primary hover:border-line-strong hover:bg-surface-hover/80 hover:text-fg-bright')
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
