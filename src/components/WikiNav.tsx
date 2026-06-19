import Link from 'next/link'
import { Home, Skull, Sword, ScrollText, type LucideIcon } from 'lucide-react'

// Top navigation bar shared across the Light Gray Wiki pages.
// To add a new wiki page, add an entry here and pass its `key` as the
// `active` prop from that page.
const NAV_ITEMS: { key: string; href: string; label: string; icon: LucideIcon }[] = [
  { key: 'home', href: '/wiki', label: 'Home', icon: Home },
  { key: 'enemies', href: '/enemies', label: 'Bestiary', icon: Skull },
  { key: 'items', href: '/items', label: 'Item Compendium', icon: Sword },
  { key: 'quests', href: '/quests', label: 'Quests', icon: ScrollText },
]

export default function WikiNav({ active }: { active: string }) {
  return (
    <nav className="border-b border-gray-800 bg-gray-900">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link
          href="/wiki"
          className="text-base font-bold text-gray-100 hover:text-white"
        >
          Light Gray RPG Wiki
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
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                    : 'border-gray-700 bg-gray-800/60 text-gray-300 hover:border-gray-600 hover:bg-gray-700/80 hover:text-white')
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
