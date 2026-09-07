/**
 * How many of each thing the World Tool documents, for the home launcher.
 *
 * Read from the same sources as the pages themselves, so the number on a card
 * is the number at the top of the page it opens. Server-only: it queries the
 * database.
 */

import { prisma } from '@/lib/prisma'
import { cachedWorldToolData } from './cached'
import { SKILLS } from '@/lib/skillbook'
import { SPELLS } from '@/lib/spellbook'
import { THEMES } from '@/lib/theme/themes'
import legacyData from '@/lib/game-data/legacy-rooms.json'
import { ATLAS_EXCLUDED_ROOMS } from './atlas'
import type { WorldToolPageKey } from './pages'

const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: unknown[] }
const { QUEST_ORDER } = require('@/lib/game-data/quest-registry') as { QUEST_ORDER: string[] }
const { CRAFTING_RECIPES } = require('@/lib/game-data/crafting-recipes') as { CRAFTING_RECIPES: unknown[] }
const { SHOPS } = require('@/lib/game-data/shops') as { SHOPS: Record<string, unknown> }
const { CHEST_LOOT, REPEATABLE_CHEST_LOOT } = require('@/lib/game-engine/room-action-handlers') as {
  CHEST_LOOT: Record<string, Record<string, unknown>>
  REPEATABLE_CHEST_LOOT: unknown[]
}
const { TELEPORT_LOCATIONS } = require('@/lib/game-data/teleport-destinations') as {
  TELEPORT_LOCATIONS: unknown[]
}

export type WorldToolCounts = Partial<Record<WorldToolPageKey, number>>

export const loadWorldToolCounts = cachedWorldToolData('counts', async (): Promise<WorldToolCounts> => {
  const [items, atlasRooms, roomIds, players] = await Promise.all([
    prisma.itemTemplate.count(),
    prisma.room.count({ where: { roomId: { notIn: ATLAS_EXCLUDED_ROOMS } } }),
    prisma.room.findMany({ select: { roomId: true } }),
    prisma.user.count(),
  ])

  // Room Desc compares the union: rooms the original had, rooms the
  // recreation has, and every room in both.
  const legacyIds = (legacyData as { rooms: { roomId: string }[] }).rooms.map((r) => r.roomId)
  const compared = new Set([...legacyIds, ...roomIds.map((r) => r.roomId)]).size

  const oneTimeChests = Object.values(CHEST_LOOT).reduce((n, actions) => n + Object.keys(actions).length, 0)

  return {
    enemies: ENEMIES.length,
    items,
    quests: QUEST_ORDER.length,
    skills: SKILLS.length,
    spells: SPELLS.length,
    crafting: CRAFTING_RECIPES.length,
    shops: Object.keys(SHOPS).length,
    chests: oneTimeChests + REPEATABLE_CHEST_LOOT.length,
    rooms: atlasRooms,
    teleport: TELEPORT_LOCATIONS.length,
    players,
    'room-desc': compared,
    themes: THEMES.length,
  }
})
