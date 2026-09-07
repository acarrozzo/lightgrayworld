/**
 * Everything the rail's search can find, as one flat list.
 *
 * Built on the server from the same registries the reference pages read, and
 * from the item and room tables. Each entry links to the entity's row on its
 * page — the same anchors the cross-page links use — so a hit lands on the
 * row and flashes it.
 *
 * Players are deliberately not here: the search is for the authored world.
 */

import { prisma } from '@/lib/prisma'
import { cachedWorldToolData } from './cached'
import { SKILLS, SKILL_GROUPS } from '@/lib/skillbook'
import { SPELLS, SPELL_SCHOOLS } from '@/lib/spellbook'
import {
  enemyHref,
  itemHref,
  questHref,
  questGiverHref,
  roomHref,
  skillHref,
  spellHref,
  recipeHref,
  shopHref,
} from '@/components/world-tool/hrefs'
import { ATLAS_EXCLUDED_ROOMS } from './atlas'
import type { SearchEntry } from './search-types'

const { ENEMIES } = require('@/lib/game-data/enemies') as {
  ENEMIES: { slug: string; name: string; zone: string; level: number }[]
}
const { QUESTS, GIVERS, QUEST_ORDER } = require('@/lib/game-data/quest-registry') as {
  QUESTS: Record<string, { title: string; giverId?: string; questType?: string }>
  GIVERS: Record<string, { name: string; roomId?: string; quests: string[] }>
  QUEST_ORDER: string[]
}
const { ALL_REGIONS } = require('@/lib/game-data/world-map') as {
  ALL_REGIONS: { id: string; name: string }[]
}
const { CRAFTING_RECIPES, CRAFTING_FAMILIES } = require('@/lib/game-data/crafting-recipes') as {
  CRAFTING_RECIPES: { id: string; family: string; station?: string; output: { name: string } }[]
  CRAFTING_FAMILIES: { id: string; label: string }[]
}
const { SHOPS } = require('@/lib/game-data/shops') as {
  SHOPS: Record<string, { name: string }>
}

const words = (s: string) => s.toLowerCase().replace(/_/g, ' ')

export const buildSearchIndex = cachedWorldToolData('search-index', async (): Promise<SearchEntry[]> => {
  const [items, rooms] = await Promise.all([
    prisma.itemTemplate.findMany({
      select: { slug: true, name: true, type: true, equipSlot: true },
      orderBy: { name: 'asc' },
    }),
    prisma.room.findMany({
      where: { roomId: { notIn: ATLAS_EXCLUDED_ROOMS } },
      select: { roomId: true, name: true, region: true },
      orderBy: { roomId: 'asc' },
    }),
  ])

  const regionName = new Map(ALL_REGIONS.map((r) => [r.id, r.name]))
  const familyLabel = new Map(CRAFTING_FAMILIES.map((f) => [f.id, f.label]))
  const groupName = new Map(SKILL_GROUPS.map((g) => [g.id, g.name]))
  const schoolName = new Map(SPELL_SCHOOLS.map((s) => [s.id, s.name]))
  const roomName = new Map(rooms.map((r) => [r.roomId, r.name]))

  const entries: SearchEntry[] = []

  for (const e of ENEMIES) {
    entries.push({ type: 'enemy', id: e.slug, name: e.name, sub: `${e.zone} · L${e.level}`, href: enemyHref(e.slug) })
  }
  for (const t of items) {
    entries.push({ type: 'item', id: t.slug, name: t.name, sub: words(t.equipSlot ?? t.type), href: itemHref(t.slug) })
  }
  for (const r of rooms) {
    const region = regionName.get(r.region) ?? r.region
    entries.push({ type: 'room', id: r.roomId, name: r.name, sub: `#${r.roomId} · ${region}`, href: roomHref(r.roomId) })
  }
  for (const id of QUEST_ORDER) {
    const q = QUESTS[id]
    if (!q) continue
    const giver = q.giverId ? GIVERS[q.giverId]?.name : undefined
    const sub = [giver, q.questType].filter(Boolean).join(' · ')
    entries.push({ type: 'quest', id, name: q.title, sub: sub || undefined, href: questHref(id) })
  }
  for (const [id, g] of Object.entries(GIVERS)) {
    const where = g.roomId ? roomName.get(g.roomId) ?? `room ${g.roomId}` : undefined
    const n = g.quests.length
    const sub = [where, `${n} quest${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
    entries.push({ type: 'giver', id, name: g.name, sub, href: questGiverHref(id) })
  }
  for (const s of SKILLS) {
    entries.push({ type: 'skill', id: s.id, name: s.name, sub: groupName.get(s.group), href: skillHref(s.id) })
  }
  for (const s of SPELLS) {
    entries.push({ type: 'spell', id: s.id, name: s.name, sub: schoolName.get(s.school), href: spellHref(s.id) })
  }
  for (const r of CRAFTING_RECIPES) {
    const sub = [familyLabel.get(r.family) ?? r.family, r.station].filter(Boolean).join(' · ')
    entries.push({ type: 'recipe', id: r.id, name: r.output.name, sub, href: recipeHref(r.id) })
  }
  for (const [roomId, shop] of Object.entries(SHOPS)) {
    // Most shops are named for their room, so only say where when it adds something.
    const where = roomName.get(roomId)
    const sub = where && where !== shop.name ? `#${roomId} · ${where}` : `#${roomId}`
    entries.push({ type: 'shop', id: roomId, name: shop.name, sub, href: shopHref(roomId) })
  }

  return entries
})
