export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Icon from '@/components/Icon'
import WorldToolNav from '@/components/WorldToolNav'

// Resolve every equipment slot the way the public-profile route does:
// legacy `Equipment` string slots as the fallback, equipped `PlayerItem` rows override.
const EQUIP_SLOTS: { key: string; label: string; def: string }[] = [
  { key: 'rightHand', label: 'Weapon (Right Hand)', def: 'fists' },
  { key: 'leftHand', label: 'Left Hand', def: '- - -' },
  { key: 'head', label: 'Helmet', def: '- - -' },
  { key: 'body', label: 'Body Armor', def: '- - -' },
  { key: 'hands', label: 'Hands', def: '- - -' },
  { key: 'feet', label: 'Feet', def: '- - -' },
  { key: 'ring1', label: 'Ring 1', def: '- - -' },
  { key: 'ring2', label: 'Ring 2', def: '- - -' },
  { key: 'neck', label: 'Neck', def: '- - -' },
  { key: 'artifact', label: 'Artifact', def: '- - -' },
]
const PLAYER_ITEM_SLOT_MAP: Record<string, string> = {
  MAIN_HAND: 'rightHand',
  OFF_HAND: 'leftHand',
  HEAD: 'head',
  BODY: 'body',
  HANDS: 'hands',
  FEET: 'feet',
  RING: 'ring1',
  NECK: 'neck',
}

function fmtDate(d: Date) {
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Coarse "3 days ago" style label relative to now.
function fmtRelative(d: Date) {
  const diff = Date.now() - d.getTime()
  const abs = Math.abs(diff)
  const suffix = diff >= 0 ? 'ago' : 'from now'
  if (abs < 60_000) return 'just now'
  const units: [number, string][] = [
    [60_000, 'min'], [3_600_000, 'hour'], [86_400_000, 'day'],
    [604_800_000, 'week'], [2_592_000_000, 'month'], [31_536_000_000, 'year'],
  ]
  let value = Math.floor(abs / 60_000)
  let unit = 'min'
  for (let i = 0; i < units.length; i++) {
    const next = units[i + 1]
    if (!next || abs < next[0]) {
      value = Math.floor(abs / units[i][0])
      unit = units[i][1]
      break
    }
  }
  return `${value} ${unit}${value === 1 ? '' : 's'} ${suffix}`
}

function dateWithRelative(d: Date) {
  return `${fmtDate(d)} (${fmtRelative(d)})`
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [user, kills, lastBattle, completedQuestCount, questCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        equipment: true,
        room: { select: { name: true } },
        PlayerItem: {
          where: { isEquipped: true },
          select: { slot: true, ItemTemplate: { select: { name: true } } },
        },
      },
    }),
    prisma.killList.findMany({ where: { userId: id }, orderBy: { kills: 'desc' } }),
    prisma.battleLog.findFirst({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.questProgress.count({ where: { userId: id, completed: true } }),
    prisma.questProgress.count({ where: { userId: id } }),
  ])

  if (!user) notFound()

  // Resolve equipment (PlayerItem overrides Equipment string fallback).
  const equip: Record<string, string> = {}
  for (const s of EQUIP_SLOTS) {
    equip[s.key] = (user.equipment?.[s.key as keyof typeof user.equipment] as string) || s.def
  }
  for (const pi of user.PlayerItem) {
    if (!pi.slot || !pi.ItemTemplate) continue
    const mapped = PLAYER_ITEM_SLOT_MAP[pi.slot]
    if (mapped) equip[mapped] = pi.ItemTemplate.name
  }

  const totalKills = kills.reduce((sum, k) => sum + k.kills, 0)
  const chestsOpened = [
    user.chest1, user.chest2, user.chest3, user.chest4, user.chest5,
    user.chest6, user.chest7, user.chest8, user.chest9, user.chest10,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <WorldToolNav active="players" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/players" className="text-sm text-indigo-300 hover:underline">
          ← Back to Players
        </Link>

        {/* Header */}
        <header className="mt-4 mb-6 flex items-center gap-4">
          <Icon name={user.uIcon} size={48} color={user.uIconColor} />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
              {user.username}
              {user.inFight && (
                <span className="rounded border border-red-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-400">
                  in battle
                </span>
              )}
              {!user.isActive && (
                <span className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                  inactive
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-400">
              Level {user.level} · {user.characterRace} {user.characterClass}
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Vitals & Attributes">
            <Stat label="Max HP" value={`${user.hp} / ${user.hpMax}`} color="text-red-400" />
            <Stat label="Max MP" value={`${user.mp} / ${user.mpMax}`} color="text-blue-400" />
            <Stat label="STR" value={`${user.str}${user.strMod ? ` (+${user.strMod})` : ''}`} color="text-rose-300" />
            <Stat label="DEX" value={`${user.dex}${user.dexMod ? ` (+${user.dexMod})` : ''}`} color="text-lime-300" />
            <Stat label="MAG" value={`${user.mag}${user.magMod ? ` (+${user.magMod})` : ''}`} color="text-cyan-300" />
            <Stat label="DEF" value={`${user.def}${user.defMod ? ` (+${user.defMod})` : ''}`} color="text-amber-300" />
            <Stat label="Physical Training" value={user.physicalTraining} color="text-orange-400" />
            <Stat label="Mental Training" value={user.mentalTraining} color="text-purple-400" />
          </Section>

          <Section title="Progression">
            <Stat label="Level" value={user.level} color="text-yellow-400" />
            <Stat label="XP (current)" value={user.xp.toLocaleString()} color="text-green-400" />
            <Stat label="Currency" value={user.currency} color="text-yellow-300" />
            <Stat label="Total Clicks" value={user.clicks.toLocaleString()} />
            <Stat label="Deaths" value={user.deaths} color="text-red-300" />
            <Stat label="Chests Opened" value={`${chestsOpened} / 10`} color="text-amber-400" />
            <Stat label="Daily Chests" value={user.dailyChestCount} color="text-amber-400" />
            <Stat label="Completed Quests" value={`${completedQuestCount} / ${questCount}`} color="text-emerald-400" />
          </Section>

          <Section title="Location & Activity">
            <Stat label="Current Room" value={`${user.room?.name || user.currentRoom} (${user.currentRoom})`} color="text-teal-300" />
            <Stat label="Recall Room" value={user.recallRoom} color="text-teal-300" />
            <Stat label="Last Login" value={dateWithRelative(user.lastActive)} />
            <Stat label="Account Created" value={fmtDate(user.createdAt)} />
          </Section>

          <Section title="Combat">
            <Stat label="Total Kills" value={totalKills} color="text-gray-100" />
            <Stat
              label="Last Enemy Fought"
              value={lastBattle ? `${lastBattle.enemyName} (${lastBattle.outcome})` : '—'}
              color={lastBattle?.outcome === 'victory' ? 'text-green-400' : lastBattle ? 'text-red-400' : undefined}
            />
            {lastBattle && (
              <Stat label="Last Battle" value={fmtDate(lastBattle.createdAt)} />
            )}
          </Section>

          <Section title="Equipment">
            {EQUIP_SLOTS.map((s) => (
              <Stat key={s.key} label={s.label} value={equip[s.key]} />
            ))}
          </Section>

          <Section title={`Kill List (${kills.length})`}>
            {kills.length === 0 ? (
              <p className="text-sm text-gray-500">No kills recorded.</p>
            ) : (
              kills.map((k) => <Stat key={k.id} label={k.monster} value={k.kills} color="text-gray-100" />)
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-200' }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-800/60 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right ${color}`}>{value}</span>
    </div>
  )
}
