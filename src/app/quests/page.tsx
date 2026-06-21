export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import QuestsList, { type QuestGroup, type QuestRow } from './QuestsList'
import WorldToolNav from '@/components/WorldToolNav'

export const metadata = {
  title: 'Quests — Light Gray RPG',
  description: 'Every quest in Light Gray RPG, grouped by quest giver, with objectives, requirements, and rewards.',
}

// Quest definitions are the canonical source — imported live from the game-data
// file so this page never drifts when quests are added or edited. Player progress
// lives in the database (QuestProgress); only the static *definitions* are shown here.
import questData from '@/lib/game-data/quests.json'

// Enemy data (for resolving killCount enemy slugs to display names) is also static.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: { slug: string; name: string }[] }

// Mirror of the shape stored in quests.json. Extra keys are tolerated via the
// index signature so new fields in the source never break this page.
type Requirement = {
  type: string
  minLevel?: number
  itemSlug?: string
  quantity?: number
  enemySlug?: string
  count?: number
  displayName?: string
  slot?: string
  notDefault?: boolean
}
type Reward = { type: string; amount?: number; name?: string }
type Effect = { type: string; questId?: string }
type QuestDef = {
  number: number
  questType: string
  level: number
  title: string
  summary: string
  objective: string
  nextStep: string
  reminderDialog: string
  completionDialog: string
  giver: { npcId: string; roomId: string; name: string; icon: string }
  requirements?: Requirement[]
  consumeRequirementsOnComplete?: boolean
  rewards?: Reward[]
  onComplete?: Effect[]
  [key: string]: unknown
}

const QUESTS = questData as Record<string, QuestDef>

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
}

// Turn a slug like "yellow-flower" into "Yellow Flower" — only used as a fallback
// when a referenced item/enemy isn't found in its source.
function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function QuestsPage() {
  // Resolve item slugs from hasItem requirements to their canonical DB names,
  // so renaming an item in the source updates the name shown here too.
  const itemSlugs = Array.from(
    new Set(
      Object.values(QUESTS)
        .flatMap((q) => q.requirements ?? [])
        .filter((r) => r.type === 'hasItem' && r.itemSlug)
        .map((r) => r.itemSlug as string)
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

  const resolveItem = (slug: string) => itemNameBySlug.get(slug) ?? prettifySlug(slug)
  const resolveEnemy = (slug: string) => enemyNameBySlug.get(slug) ?? prettifySlug(slug)

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
      case 'killCount': {
        const count = r.count ?? 1
        const name = r.displayName ?? resolveEnemy(r.enemySlug ?? '')
        return `Defeat ${count}× ${name}`
      }
      case 'hasEquippedInSlot': {
        const slot = r.slot ? SLOT_LABELS[r.slot] ?? prettifySlug(r.slot.toLowerCase()) : 'a slot'
        return `Equip ${r.notDefault ? 'a non-default item' : 'an item'} in ${slot}`
      }
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
      case 'item':
        return r.name ?? 'Item'
      default:
        return r.name ? `${r.name}` : `${r.amount ?? ''} ${r.type}`.trim()
    }
  }

  // Resolve an onComplete effect to the title of the quest it starts/completes.
  function formatEffect(e: Effect): string | null {
    if (!e.questId) return null
    const target = QUESTS[e.questId]
    const title = target?.title ?? prettifySlug(e.questId.replace(/_/g, '-'))
    return e.type === 'completeQuest' ? `Completes: ${title}` : `Unlocks: ${title}`
  }

  // Build serializable rows; the client component is a pure presenter.
  const rows: QuestRow[] = Object.entries(QUESTS).map(([id, q]) => ({
    id,
    number: q.number,
    questType: q.questType,
    level: q.level,
    title: q.title,
    summary: q.summary,
    objective: q.objective,
    nextStep: q.nextStep,
    reminderDialog: q.reminderDialog,
    completionDialog: q.completionDialog,
    npcId: q.giver.npcId,
    requirements: (q.requirements ?? []).map(formatRequirement),
    consumesItems: !!q.consumeRequirementsOnComplete,
    rewards: (q.rewards ?? []).map(formatReward),
    unlocks: (q.onComplete ?? []).map(formatEffect).filter((s): s is string => !!s),
  }))

  // Group quests by giver, preserving each giver's quest order (by `number`).
  // Givers appear in the order their first quest does in the source file.
  const groupMap = new Map<string, QuestGroup>()
  for (const [id, q] of Object.entries(QUESTS)) {
    if (!groupMap.has(q.giver.npcId)) {
      groupMap.set(q.giver.npcId, {
        npcId: q.giver.npcId,
        name: q.giver.name,
        icon: q.giver.icon,
        roomId: q.giver.roomId,
        quests: [],
      })
    }
    groupMap.get(q.giver.npcId)!.quests.push(rows.find((r) => r.id === id)!)
  }
  const groups = Array.from(groupMap.values())
  for (const g of groups) g.quests.sort((a, b) => a.number - b.number)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <WorldToolNav active="quests" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Quests</h1>
          <p className="mt-1 text-sm text-gray-400">
            {rows.length} quests across {groups.length} quest givers — pulled live from the game data.
          </p>
        </header>
        <QuestsList groups={groups} />
      </div>
    </div>
  )
}
