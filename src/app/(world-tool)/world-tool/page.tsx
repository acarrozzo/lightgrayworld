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
  { href: '/skills', label: 'Skills', description: 'Every skill, by group — weapon proficiencies, special attacks, defenses, upgrades — with what it does, what it costs, and the teachers that unlock each level.' },
  { href: '/spells', label: 'Spells', description: 'Every spell, by school, with its formula, learning and casting costs, and the teachers that unlock each level.' },
  { href: '/crafting', label: 'Crafting', description: 'Every recipe, by family — what it takes, what it makes, which station it needs, and the rooms you can make it in.' },
  { href: '/shops', label: 'Shops', description: 'Every shop, with the room it stands in, its stock and prices, and any membership it requires.' },
  { href: '/chests', label: 'Chests', description: 'The one-time gold chests and the repeatable ones, with their full loot tables, pool odds and rooms.' },
  { href: '/teleport', label: 'Teleport', description: 'The fast-travel network — every destination, the region it belongs to, what unlocks it and what it costs.' },
  { href: '/rooms', label: 'World Atlas', description: 'Compass-oriented maps of every region — Grassy Field through the Dark Forest, each with the areas below it — showing enemies, spawn logic, NPCs, loot, actions, gates, and secrets.' },
  { href: '/room-desc', label: 'Room Desc', description: "Every room's title, subtitle, description, actions and exits in the original game beside the recreation, field by field, with the differences flagged." },
  { href: '/players', label: 'Players', description: 'Every player, with level, vitals, equipment, kills, quests, and progression. Sort and drill into full profiles.' },
  { href: '/themes', label: 'Terminal Themes', description: 'Every semantic colour role — actions, resources, stats, combat, feed channels, room mood and world regions — shown across every terminal theme, with what each role means and where it is used.' },
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
