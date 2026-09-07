export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { WORLD_TOOL_GROUPS } from '@/lib/world-tool/pages'
import { loadWorldToolCounts } from '@/lib/world-tool/counts'

export const metadata = {
  title: 'Light Gray World Tool',
  description:
    'The Light Gray World Tool — every enemy, item, quest, skill, spell, recipe, shop, chest, room and player, read live from the game.',
}

/**
 * The launcher: every page, in the same groups as the rail, each with a live
 * count of what it documents. The list and the rail read one registry, so
 * they cannot disagree about what pages exist.
 */
export default async function WorldToolHomePage() {
  const counts = await loadWorldToolCounts()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-fg-bright">Light Gray World Tool</h1>
        <p className="mt-1 max-w-3xl text-sm text-fg-secondary">
          A reference for everything in the game, read from the same definitions the engine plays by.
          Search the rail for any enemy, item, room, quest, skill, spell, recipe or shop and jump straight to it.
        </p>
      </header>

      {WORLD_TOOL_GROUPS.map((group) => (
        <section key={group.id} className="mb-8" aria-labelledby={`wt-group-${group.id}`}>
          <h2
            id={`wt-group-${group.id}`}
            className="mb-3 border-b border-line-subtle pb-1 text-xs font-bold uppercase tracking-widest text-fg-muted"
          >
            {group.label}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.pages.map((page) => {
              const PageIcon = page.icon
              const count = counts[page.key]
              return (
                <li key={page.key}>
                  <Link
                    href={page.href}
                    className="flex h-full flex-col rounded border border-line-subtle/80 bg-surface-panel px-4 py-3 transition-colors hover:border-line-subtle hover:bg-surface-raised"
                  >
                    <span className="flex items-center gap-2">
                      <PageIcon className="h-4 w-4 shrink-0 text-fg-secondary" aria-hidden="true" />
                      <span className="text-base font-medium text-fg-bright">{page.label}</span>
                      {count != null && (
                        <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-fg-muted">
                          {count.toLocaleString()} {page.unit}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-fg-secondary">{page.description}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
