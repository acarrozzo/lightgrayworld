export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import PlayersTable, { type PlayerRow } from './PlayersTable'
const { getQuestDef } = require('@/lib/game-data/quest-registry') as { getQuestDef: (questId: string) => unknown }
import { resolveEquipmentNames, type EquipmentSource } from '@/lib/items/equipment-resolution'

export const metadata = {
  title: 'Players — Light Gray World Tool',
  description: 'Every player, with their level, vitals, equipment, and progression.',
}

// Both equipment systems (legacy `Equipment` string slots and equipped `PlayerItem`
// rows) are merged by the shared resolver, so this page, the roster route, and the
// public-profile route always agree about what someone is wearing.
function resolveEquip(u: {
  equipment: { rightHand: string; head: string; body: string } | null
  PlayerItem: { slot: string | null; ItemTemplate: { name: string } | null }[]
}) {
  const names = resolveEquipmentNames(u as EquipmentSource)
  return { weapon: names.rightHand, helmet: names.head, body: names.body }
}

export default async function PlayersPage() {
  const [users, killAgg, completedRows] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        level: true,
        hpMax: true,
        mpMax: true,
        xp: true,
        clicks: true,
        deaths: true,
        physicalTraining: true,
        mentalTraining: true,
        characterClass: true,
        characterRace: true,
        currentRoom: true,
        lastActive: true,
        uIcon: true,
        uIconColor: true,
        inFight: true,
        isActive: true,
        dailyChestCount: true,
        chest1: true, chest2: true, chest3: true, chest4: true, chest5: true,
        chest6: true, chest7: true, chest8: true, chest9: true, chest10: true,
        equipment: { select: { rightHand: true, head: true, body: true } },
        PlayerItem: {
          where: { isEquipped: true },
          select: { slot: true, ItemTemplate: { select: { name: true } } },
        },
        room: { select: { name: true } },
      },
    }),
    prisma.killList.groupBy({ by: ['userId'], _sum: { kills: true } }),
    prisma.questProgress.findMany({
      where: { completed: true },
      select: { userId: true, questId: true },
    }),
  ])

  const killsByUser = new Map(killAgg.map((k) => [k.userId, k._sum.kills ?? 0]))
  // Only quests that exist count — rows from retired ids stay in the table.
  const questsByUser = new Map<string, number>()
  for (const row of completedRows) {
    if (!getQuestDef(row.questId)) continue
    questsByUser.set(row.userId, (questsByUser.get(row.userId) ?? 0) + 1)
  }

  const rows: PlayerRow[] = users.map((u) => {
    const { weapon, helmet, body } = resolveEquip(u)
    const chestsOpened = [
      u.chest1, u.chest2, u.chest3, u.chest4, u.chest5,
      u.chest6, u.chest7, u.chest8, u.chest9, u.chest10,
    ].filter(Boolean).length
    return {
      id: u.id,
      name: u.username,
      level: u.level,
      hpMax: u.hpMax,
      mpMax: u.mpMax,
      room: u.room?.name || u.currentRoom,
      kills: killsByUser.get(u.id) ?? 0,
      lastLogin: u.lastActive.getTime(),
      // detail
      characterClass: u.characterClass,
      characterRace: u.characterRace,
      physicalTraining: u.physicalTraining,
      mentalTraining: u.mentalTraining,
      weapon,
      helmet,
      body,
      deaths: u.deaths,
      completedQuests: questsByUser.get(u.id) ?? 0,
      chestsOpened,
      dailyChestCount: u.dailyChestCount,
      xp: u.xp,
      clicks: u.clicks,
      uIcon: u.uIcon,
      uIconColor: u.uIconColor,
      inFight: u.inFight,
      isActive: u.isActive,
    }
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg-bright">Players</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          {rows.length} players — click a name for the full profile, or a row to expand details.
        </p>
      </header>
      <PlayersTable rows={rows} />
    </div>
  )
}
