import Link from 'next/link'

// Top navigation bar shared across the Light Gray Wiki pages.
// To add a new wiki page, add an entry here and pass its `key` as the
// `active` prop from that page.
const NAV_ITEMS: { key: string; href: string; label: string }[] = [
  { key: 'home', href: '/wiki', label: 'Home' },
  { key: 'enemies', href: '/enemies', label: 'Bestiary' },
  { key: 'items', href: '/items', label: 'Item Compendium' },
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
        <div className="flex items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'rounded px-2 py-1 text-sm transition-colors sm:px-3 ' +
                  (isActive
                    ? 'bg-gray-800 font-medium text-gray-100'
                    : 'text-gray-400 hover:text-gray-200')
                }
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
