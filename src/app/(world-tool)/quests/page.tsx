export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import QuestsList, { type FactionGroup, type GiverGroup, type QuestRow } from './QuestsList'
import WorldToolNav from '@/components/WorldToolNav'

export const metadata = {
  title: 'Quests — Light Gray RPG',
  description: 'Every quest in Light Gray RPG, grouped by faction and quest giver, with objectives, requirements, and rewards.',
}

// Quest, giver and faction definitions are the canonical source — imported live
// from the game-data modules so this page never drifts when content is added or
// edited. Player progress lives in the database (QuestProgress, GiverMet); only
// the static *definitions* are shown here.
const registry = require('@/lib/game-data/quest-registry') as {
  QUESTS: Record<string, QuestDef>
  GIVERS: Record<string, GiverDef>
  listFactionGiverIds: (factionId: string) => string[]
}
const { FACTIONS } = require('@/lib/game-data/factions') as {
  FACTIONS: { id: string; name: string; kind: string; title?: string; membershipQuest?: string; placeholder?: boolean }[]
}
const { ALL_REGIONS } = require('@/lib/game-data/world-map') as { ALL_REGIONS: { id: string; name: string }[] }
// Enemy data (for resolving killCount enemy slugs to display names) is also static.
const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: { slug: string; name: string }[] }

// Mirror of the shapes stored in quests.json / quest-givers.json. Extra keys are
// tolerated via the index signature so new fields never break this page.
type Requirement = {
  type: string
  minLevel?: number
  itemSlug?: string
  items?: { itemSlug: string; quantity?: number }[]
  quantity?: number
  enemySlug?: string
  enemySlugs?: string[]
  count?: number
  displayName?: string
  slot?: string
  notDefault?: boolean
  flag?: string
  factionId?: string
  factionIds?: string[]
  giverId?: string
  questId?: string
}
type Reward = { type: string; amount?: number; itemSlug?: string; quantity?: number }
type QuestDef = {
  giverId: string
  questType: string
  level: number
  title: string
  summary: string
  objective: string
  nextStep: string
  reminderDialog: string
  completionDialog: string
  after?: string[]
  requirements?: Requirement[]
  consumeRequirementsOnComplete?: boolean
  rewards?: Reward[]
  [key: string]: unknown
}
type GiverDef = {
  name: string
  spokenName?: string
  roomId: string
  icon: string
  faction: string | null
  revealedBy?: { type: string; questId?: string; giverId?: string; regionId?: string; flag?: string }
  hint?: string
  meetRequirements?: Requirement[]
  lockedDialog?: string
  greeting?: string
  quests: string[]
  [key: string]: unknown
}

const { QUESTS, GIVERS, listFactionGiverIds } = registry

// Friendly labels for equipment slots referenced by hasEquippedInSlot requirements.
const SLOT_LABELS: Record<string, string> = {
  MAIN_HAND: 'Main Hand',
  OFF_HAND: 'Off Hand',
  HEAD: 'Head',
  BODY: 'Body',
  HANDS: 'Hands',
  FEET: 'Feet',
  RING: 'Ring',
  NECK: 'Neck',
  MOUNT: 'Mount',
  ARTIFACT: 'Artifact',
  COMPANION: 'Companion',
}

// Turn a slug like "yellow-flower" into "Yellow Flower" — only used as a fallback
// when a referenced item/enemy isn't found in its source.
function prettifySlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function QuestsPage() {
  // Resolve item slugs from hasItem requirements and item rewards to their
  // canonical DB names, so renaming an item in the source updates the name here.
  const itemSlugs = Array.from(
    new Set(
      Object.values(QUESTS).flatMap((q) => [
        ...(q.requirements ?? []).filter((r) => r.type === 'hasItem' && r.itemSlug).map((r) => r.itemSlug as string),
        ...(q.requirements ?? []).flatMap((r) => (r.items ?? []).map((entry) => entry.itemSlug)),
        ...(q.rewards ?? []).filter((r) => r.type === 'item' && r.itemSlug).map((r) => r.itemSlug as string),
      ])
    )
  )
  const items = itemSlugs.length
    ? await prisma.itemTemplate.findMany({
        where: { slug: { in: itemSlugs } },
        select: { slug: true, name: true },
      })
    : []
  const itemNameBySlug = new Map(items.map((i) => [i.slug, i.name]))
  const enemyNameBySlug = new Map(ENEMIES.map((e) => [e.slug, e.name]))
  const factionById = new Map(FACTIONS.map((f) => [f.id, f]))
  const regionById = new Map(ALL_REGIONS.map((r) => [r.id, r]))

  const resolveItem = (slug: string) => itemNameBySlug.get(slug) ?? prettifySlug(slug)
  const resolveEnemy = (slug: string) => enemyNameBySlug.get(slug) ?? prettifySlug(slug)
  const questTitle = (id: string) => QUESTS[id]?.title ?? prettifySlug(id)
  const giverName = (id: string) => GIVERS[id]?.spokenName ?? GIVERS[id]?.name ?? prettifySlug(id)
  const factionName = (id: string) => factionById.get(id)?.name ?? prettifySlug(id)

  // Render one requirement as a human-readable line, pulling every value from the
  // requirement object (and resolved names) — nothing hardcoded per quest.
  function formatRequirement(r: Requirement): string {
    switch (r.type) {
      case 'level':
        return (r.minLevel ?? 0) > 0 ? `Reach level ${r.minLevel}` : 'No level requirement'
      case 'hasItem': {
        const qty = r.quantity ?? 1
        return `Bring ${qty}× ${resolveItem(r.itemSlug ?? '')}`
      }
      case 'hasAnyItem': {
        const names = (r.items ?? []).map((entry) => `${entry.quantity ?? 1}× ${resolveItem(entry.itemSlug)}`)
        return names.length ? `Bring any one of: ${names.join(', ')}` : 'Bring any qualifying item'
      }
      case 'killCount': {
        const count = r.count ?? 1
        const name = r.displayName ?? resolveEnemy(r.enemySlug ?? '')
        return `Defeat ${count}× ${name}`
      }
      case 'killCountGroup': {
        const count = r.count ?? 1
        const name = r.displayName ?? (r.enemySlugs ?? []).map(resolveEnemy).join(' / ')
        return `Defeat ${count}× ${name}`
      }
      case 'hasEquippedInSlot': {
        const slot = r.slot ? SLOT_LABELS[r.slot] ?? prettifySlug(r.slot.toLowerCase()) : 'a slot'
        return `Equip ${r.notDefault ? 'a non-default item' : 'an item'} in ${slot}`
      }
      case 'hasFlag':
        return r.displayName ?? prettifySlug(r.flag ?? '')
      case 'memberOf':
        return `Be a member of the ${factionName(r.factionId ?? '')}`
      case 'giverMet':
        return `Have met ${giverName(r.giverId ?? '')}`
      case 'questCompleted':
        return `Have completed "${questTitle(r.questId ?? '')}"`
      case 'factionsComplete':
        return `Complete every quest in: ${(r.factionIds ?? []).map(factionName).join(', ')}`
      default:
        return r.type
    }
  }

  // Render one reward line from its fields.
  function formatReward(r: Reward): string {
    switch (r.type) {
      case 'currency':
        return `${r.amount ?? 0} gold`
      case 'xp':
        return `${r.amount ?? 0} XP`
      case 'item': {
        const qty = r.quantity ?? 1
        return qty > 1 ? `${resolveItem(r.itemSlug ?? '')} ×${qty}` : resolveItem(r.itemSlug ?? '')
      }
      default:
        return `${r.amount ?? ''} ${r.type}`.trim()
    }
  }

  // How the player first hears of a giver.
  function formatReveal(giver: GiverDef): string {
    const rule = giver.revealedBy
    if (!rule) return 'Never revealed'
    switch (rule.type) {
      case 'always':
        return 'Known from the start'
      case 'questCompleted':
        return `After completing "${questTitle(rule.questId ?? '')}"`
      case 'giverMet':
        return `After meeting ${giverName(rule.giverId ?? '')}`
      case 'regionDiscovered':
        return `After discovering ${regionById.get(rule.regionId ?? '')?.name ?? prettifySlug(rule.regionId ?? '')}`
      case 'flag':
        return `After ${prettifySlug(rule.flag ?? '')}`
      default:
        return rule.type
    }
  }

  // Quests opened by finishing this one: any quest whose `after` names it.
  const opensByQuest = new Map<string, string[]>()
  for (const [id, q] of Object.entries(QUESTS)) {
    for (const prev of q.after ?? []) {
      const list = opensByQuest.get(prev) ?? []
      list.push(id)
      opensByQuest.set(prev, list)
    }
  }

  const toRow = (id: string): QuestRow => {
    const q = QUESTS[id]
    return {
      id,
      questType: q.questType,
      level: q.level,
      title: q.title,
      summary: q.summary,
      objective: q.objective,
      nextStep: q.nextStep,
      reminderDialog: q.reminderDialog,
      completionDialog: q.completionDialog,
      requirements: (q.requirements ?? []).map(formatRequirement),
      consumesItems: !!q.consumeRequirementsOnComplete,
      rewards: (q.rewards ?? []).map(formatReward),
      after: (q.after ?? []).map(questTitle),
      opens: (opensByQuest.get(id) ?? []).map(questTitle),
    }
  }

  const toGiver = (giverId: string): GiverGroup => {
    const g = GIVERS[giverId]
    return {
      giverId,
      name: g.name,
      icon: g.icon,
      roomId: g.roomId,
      revealedBy: formatReveal(g),
      meetRequirements: (g.meetRequirements ?? []).map(formatRequirement),
      lockedDialog: g.lockedDialog ?? null,
      greeting: g.greeting ?? '',
      hint: g.hint ?? '',
      quests: g.quests.map(toRow),
    }
  }

  // Factions in world order, each with its givers in authored order; the
  // Pillar (no faction) closes the list under its own heading.
  const groups: FactionGroup[] = FACTIONS.filter((f) => !f.placeholder).map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    title: f.title ?? null,
    membershipQuest: f.membershipQuest ? questTitle(f.membershipQuest) : null,
    givers: listFactionGiverIds(f.id).map(toGiver),
  }))
  const pillarGivers = Object.keys(GIVERS).filter((id) => GIVERS[id].faction === null).map(toGiver)
  if (pillarGivers.length) {
    groups.push({ id: 'grand-quests', name: 'Grand Quests', kind: 'grand', title: null, membershipQuest: null, givers: pillarGivers })
  }

  const questCount = Object.keys(QUESTS).length
  const giverCount = Object.keys(GIVERS).length

  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="quests" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Quests</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {questCount} quests from {giverCount} quest givers across {groups.length - (pillarGivers.length ? 1 : 0)} factions — pulled live from the game data.
            Standing with a faction is its quests done out of its total; every quest done earns its title.
          </p>
        </header>
        <QuestsList groups={groups} />
      </div>
    </div>
  )
}
