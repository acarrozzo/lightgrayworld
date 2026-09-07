/**
 * The World Tool's table of contents.
 *
 * One list, read by the rail, the home launcher and anything else that needs
 * to know what pages exist. It used to live twice — as the nav strip's items
 * and as the home page's cards — and the two drifted: the home copy still
 * described the tool as "enemies and items" a dozen pages later.
 *
 * The groups are the tool's information architecture. Compendium is what a
 * player can meet, own or learn; World is where; Community is who; Workshop
 * is the author's bench — porting and design references that are about the
 * game rather than in it.
 *
 * A plain module, no 'use client': the home page reads it on the server, the
 * rail on the client.
 */

import {
  Columns2,
  Hammer,
  Map,
  Package,
  Palette,
  ScrollText,
  Skull,
  Sparkles,
  Store,
  Sword,
  Swords,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react'

export type WorldToolPageKey =
  | 'enemies'
  | 'items'
  | 'quests'
  | 'skills'
  | 'spells'
  | 'crafting'
  | 'shops'
  | 'chests'
  | 'rooms'
  | 'teleport'
  | 'players'
  | 'room-desc'
  | 'themes'

export type WorldToolPage = {
  key: WorldToolPageKey
  href: string
  /** What the rail shows. Short: it has to fit a 15rem column. */
  label: string
  /** The noun the home launcher counts — "enemies" reads as "143 enemies". */
  unit: string
  description: string
  icon: LucideIcon
}

export type WorldToolGroup = {
  id: 'compendium' | 'world' | 'community' | 'workshop'
  label: string
  pages: WorldToolPage[]
}

export const WORLD_TOOL_HOME = { href: '/world-tool', label: 'Light Gray World Tool' } as const

/**
 * Remembers whether the rail is collapsed. A cookie rather than localStorage
 * so the server can render the rail at its remembered width on a hard load;
 * from localStorage it would paint expanded and snap shut after hydration.
 */
export const WORLD_TOOL_RAIL_COOKIE = 'lg_wt_rail'

export const WORLD_TOOL_GROUPS: WorldToolGroup[] = [
  {
    id: 'compendium',
    label: 'Compendium',
    pages: [
      { key: 'enemies', href: '/enemies', label: 'Bestiary', unit: 'enemies', icon: Skull,
        description: 'Every enemy, with their stats and drops.' },
      { key: 'items', href: '/items', label: 'Items', unit: 'items', icon: Sword,
        description: 'Every item, with their stats, value, flags, and where in the world it comes from.' },
      { key: 'quests', href: '/quests', label: 'Quests', unit: 'quests', icon: ScrollText,
        description: 'Every quest, by faction and giver, with objectives, requirements, and rewards.' },
      { key: 'skills', href: '/skills', label: 'Skills', unit: 'skills', icon: Swords,
        description: 'Every skill, by group, with what it does, what it costs, and who teaches each level.' },
      { key: 'spells', href: '/spells', label: 'Spells', unit: 'spells', icon: Sparkles,
        description: 'Every spell, by school, with its formula, learning and casting costs, and its teachers.' },
      { key: 'crafting', href: '/crafting', label: 'Crafting', unit: 'recipes', icon: Hammer,
        description: 'Every recipe, by family — what it takes, what it makes, and which station and rooms make it.' },
      { key: 'shops', href: '/shops', label: 'Shops', unit: 'shops', icon: Store,
        description: 'Every shop, with the room it stands in, its stock and prices, and any membership it requires.' },
      { key: 'chests', href: '/chests', label: 'Chests', unit: 'chests', icon: Package,
        description: 'The one-time gold chests and the repeatable ones, with their loot tables, odds and rooms.' },
    ],
  },
  {
    id: 'world',
    label: 'World',
    pages: [
      { key: 'rooms', href: '/rooms', label: 'World Atlas', unit: 'rooms', icon: Map,
        description: 'Compass-oriented maps of every region and the areas below it, with enemies, loot, NPCs, actions, gates, and secrets.' },
      { key: 'teleport', href: '/teleport', label: 'Teleport', unit: 'destinations', icon: Waypoints,
        description: 'The fast-travel network — every destination, its region, what unlocks it and what it costs.' },
    ],
  },
  {
    id: 'community',
    label: 'Community',
    pages: [
      { key: 'players', href: '/players', label: 'Players', unit: 'players', icon: Users,
        description: 'Every player, with level, vitals, equipment, kills, quests, and progression.' },
    ],
  },
  {
    id: 'workshop',
    label: 'Workshop',
    pages: [
      { key: 'room-desc', href: '/room-desc', label: 'Room Desc', unit: 'rooms compared', icon: Columns2,
        description: "Every room in the original game beside the recreation, field by field, with the differences flagged." },
      { key: 'themes', href: '/themes', label: 'Themes', unit: 'themes', icon: Palette,
        description: 'Every semantic colour role across every terminal theme, with what each role means and where it is used.' },
    ],
  },
]

export const WORLD_TOOL_PAGES: WorldToolPage[] = WORLD_TOOL_GROUPS.flatMap((g) => g.pages)

/** This page, or something under it — a player's profile lights up Players. */
export function isWorldToolPageActive(page: WorldToolPage, pathname: string): boolean {
  return pathname === page.href || pathname.startsWith(`${page.href}/`)
}
