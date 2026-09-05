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
  { key: 'mount', label: 'Mount', def: '- - -' },
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
  MOUNT: 'mount',
  ARTIFACT: 'artifact',
  COMPANION: 'companion',
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
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="players" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/players" className="text-sm text-accent-hover hover:underline">
          ← Back to Players
        </Link>

        {/* Header */}
        <header className="mt-4 mb-6 flex items-center gap-4">
          <Icon name={user.uIcon} size={48} color={user.uIconColor} />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-fg-bright">
              {user.username}
              {user.inFight && (
                <span className="rounded border border-status-error px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-status-error">
                  in battle
                </span>
              )}
              {!user.isActive && (
                <span className="rounded border border-line-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">
                  inactive
                </span>
              )}
            </h1>
            <p className="text-sm text-fg-secondary">
              Level {user.level} · {user.characterRace} {user.characterClass}
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Vitals & Attributes">
            <Stat label="Max HP" value={`${user.hp} / ${user.hpMax}`} color="text-status-error" />
            <Stat label="Max MP" value={`${user.mp} / ${user.mpMax}`} color="text-resource-mp" />
            <Stat label="STR" value={`${user.str}${user.strMod ? ` (+${user.strMod})` : ''}`} color="text-resource-hp" />
            <Stat label="DEX" value={`${user.dex}${user.dexMod ? ` (+${user.dexMod})` : ''}`} color="text-status-success" />
            <Stat label="MAG" value={`${user.mag}${user.magMod ? ` (+${user.magMod})` : ''}`} color="text-action-search" />
            <Stat label="DEF" value={`${user.def}${user.defMod ? ` (+${user.defMod})` : ''}`} color="text-resource-gold" />
            <Stat label="Physical Training" value={user.physicalTraining} color="text-action-attack" />
            <Stat label="Mental Training" value={user.mentalTraining} color="text-stat-mag" />
          </Section>

          <Section title="Progression">
            <Stat label="Level" value={user.level} color="text-status-warning" />
            <Stat label="XP (current)" value={user.xp.toLocaleString()} color="text-status-success" />
            <Stat label="Currency" value={user.currency} color="text-status-warning" />
            <Stat label="Total Clicks" value={user.clicks.toLocaleString()} />
            <Stat label="Deaths" value={user.deaths} color="text-status-error" />
            <Stat label="Chests Opened" value={`${chestsOpened} / 10`} color="text-resource-gold" />
            <Stat label="Daily Chests" value={user.dailyChestCount} color="text-resource-gold" />
            <Stat label="Completed Quests" value={`${completedQuestCount} / ${questCount}`} color="text-status-success" />
          </Section>

          <Section title="Location & Activity">
            <Stat label="Current Room" value={`${user.room?.name || user.currentRoom} (${user.currentRoom})`} color="text-action-search" />
            <Stat label="Recall Room" value={user.recallRoom} color="text-action-search" />
            <Stat label="Last Login" value={dateWithRelative(user.lastActive)} />
            <Stat label="Account Created" value={fmtDate(user.createdAt)} />
          </Section>

          <Section title="Combat">
            <Stat label="Total Kills" value={totalKills} color="text-fg-bright" />
            <Stat
              label="Last Enemy Fought"
              value={lastBattle ? `${lastBattle.enemyName} (${lastBattle.outcome})` : '—'}
              color={lastBattle?.outcome === 'victory' ? 'text-status-success' : lastBattle ? 'text-status-error' : undefined}
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
              <p className="text-sm text-fg-muted">No kills recorded.</p>
            ) : (
              kills.map((k) => <Stat key={k.id} label={k.monster} value={k.kills} color="text-fg-bright" />)
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line-subtle bg-surface-panel/30 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-secondary">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Stat({ label, value, color = 'text-fg-bright' }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line-subtle/60 py-1 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className={`text-right ${color}`}>{value}</span>
    </div>
  )
}
