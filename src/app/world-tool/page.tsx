export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import WorldToolNav from '@/components/WorldToolNav'

export const metadata = {
  title: 'Light Gray World Tool',
  description: 'The Light Gray World Tool — browse enemies and items.',
}

const PAGES = [
  { href: '/enemies', label: 'Bestiary', description: 'Every enemy, with their stats and drops.' },
  { href: '/items', label: 'Item Compendium', description: 'Every item, with their stats, value, and properties.' },
  { href: '/quests', label: 'Quests', description: 'Every quest, grouped by giver, with objectives, requirements, and rewards.' },
  { href: '/rooms', label: 'World Atlas', description: 'Compass-oriented maps of every region — Grassy Field, Forest and Red Town, each with the areas below it — showing enemies, spawn logic, NPCs, loot, actions, gates, and secrets.' },
  { href: '/players', label: 'Players', description: 'Every player, with level, vitals, equipment, kills, quests, and progression. Sort and drill into full profiles.' },
  { href: '/themes', label: 'Terminal Themes', description: 'Every semantic colour role — actions, resources, stats, combat, feed channels, room mood and world regions — shown across all eight terminal themes, with what each role means and where it is used.' },
]

export default function WorldToolHomePage() {
  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="home" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Light Gray World Tool</h1>
        </header>
        <ul className="flex flex-col gap-3">
          {PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="block rounded border border-line-subtle/80 bg-surface-panel px-4 py-3 transition-colors hover:border-line-subtle hover:bg-surface-raised"
              >
                <span className="text-base font-medium text-fg-bright">{page.label}</span>
                <span className="mt-1 block text-sm text-fg-secondary">{page.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
