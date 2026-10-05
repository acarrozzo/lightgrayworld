'use client'

import { Player, useGameStore } from '@/lib/game-state'
import { earnedTitles } from '@/lib/game-data/quest-registry'
import React, { useMemo, useState } from 'react'
import AvatarSelectionModal from '@/components/AvatarSelectionModal'
import { DEFAULT_PLAYER_AVATAR, PlayerAvatar, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { hasLearnableSpell } from '@/lib/spellbook'
import { hasLearnableSkill } from '@/lib/skillbook'
import CoreStatsGrid from '@/components/game-interface/CoreStatsGrid'
import { effectiveStats } from '@/lib/effective-stats'
import { describeRegen, playerRegen, statusChips } from '@/lib/status-effects'
import StatusStrip from '@/components/StatusStrip'
import StatAllocation from '@/components/StatAllocation'
import TrainingAllocation from '@/components/TrainingAllocation'
import type { AllocationSummary } from '@/components/PointAllocation'
import { ScrollEnd } from '@/components/game-interface/LayerShell'

import type { FilterTab } from '@/lib/inventory-categories'

interface CharPanelProps {
  player: Player
  onAction?: (action: string | { type: string; data?: any }) => void
  /** Opens the Inv tab beside the compass: the bag, what is worn and the MAX row live there. */
  onSwitchToInventory?: (filter?: FilterTab, openItemId?: string) => void
  /** Opens the Skills & Spells book on the given tab, ringing one entry. */
  onOpenBook?: (tab: 'skills' | 'spells', highlightId?: string) => void
  /** Which book the SP button opens: the Skill book if a skill teacher has been met, else the Spell book, else nothing yet. */
  bookTab?: 'skills' | 'spells' | null
  /** The server applied a spend: merge the player and write the feed line. GameInterface owns both. */
  onPointsSpent: (updatedPlayer: Player, summary: AllocationSummary) => void
}


export default function CharPanel({ player, onSwitchToInventory, onOpenBook, bookTab = null, onPointsSpent }: CharPanelProps) {
  const inventory = useGameStore((state) => state.inventory)
  const questRows = useGameStore((state) => state.quests)
  const titles = earnedTitles(questRows)
  const setPlayer = useGameStore((state) => state.setPlayer)
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const isLoggedIn = useGameStore((state) => state.isLoggedIn)
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)

  const hpPercent = useMemo(() => {
    if (!player.hpMax) return 0
    return Math.min(100, Math.max(0, (player.hp / Math.max(player.hpMax, 1)) * 100))
  }, [player.hp, player.hpMax])

  const mpPercent = useMemo(() => {
    if (!player.mpMax) return 0
    return Math.min(100, Math.max(0, (player.mp / Math.max(player.mpMax, 1)) * 100))
  }, [player.mp, player.mpMax])

  const { xpInLevel, xpRange, xpPct, xpRemaining } = useMemo(() => {
    const level = player.level ?? 1
    const xpFromLevel = (level ** 3) * 2
    const xpForLevel = ((level + 1) ** 3) * 2
    const xpInLevel = Math.max(0, (player.xp ?? 0) - xpFromLevel)
    const xpRange = xpForLevel - xpFromLevel
    const xpPct = Math.min(100, Math.floor((xpInLevel / Math.max(xpRange, 1)) * 100))
    const xpRemaining = Math.max(0, xpRange - xpInLevel)
    return { xpInLevel, xpRange, xpPct, xpRemaining }
  }, [player.level, player.xp])
  const canLearnSpell = hasLearnableSpell(player)
  const canLearnSkill = hasLearnableSkill(player)
  // What the passives add for what is in hand right now — shown on the stats.
  // The four stats as combat rolls them — the same numbers the header shows.
  const stats = useMemo(() => effectiveStats(player, inventory), [player, inventory])
  // Everything regenerating per click, from the equipped set and running effects.
  const regen = useMemo(() => playerRegen(player, inventory), [player, inventory])
  // Every running effect as a chip: regen, poison, buffs, wings — the original's buffBox row.
  const chips = useMemo(() => statusChips(player, inventory), [player, inventory])
  const pt = player.physicalTraining ?? 0
  const mt = player.mentalTraining ?? 0
  const sp = player.sp ?? 0
  const records: Array<{ label: string; note?: string; value: string | number; tone?: string; action?: React.ReactNode }> = []
  if (sp > 0) {
    records.push({
      label: 'Skill Points',
      note: bookTab ? 'Spent in your book' : 'Waiting for a teacher',
      value: sp,
      tone: 'text-stat-mag',
      action:
        onOpenBook && bookTab ? (
          <BookLink nudge={canLearnSkill || canLearnSpell} disabled={!isLoggedIn} onClick={() => onOpenBook(bookTab)} />
        ) : undefined,
    })
  }
  if (pt > 0) records.push({ label: 'Physical Training', note: `+${pt} HP per rest · +${1 + pt * 2} max HP per level`, value: pt, tone: 'text-resource-hp' })
  if (mt > 0) records.push({ label: 'Mental Training', note: `+${mt} MP per rest · +${1 + mt * 2} max MP per level`, value: mt, tone: 'text-resource-mp' })
  if ((player.currency ?? 0) > 0) records.push({ label: 'Gold', value: (player.currency ?? 0).toLocaleString(), tone: 'text-resource-gold' })
  if ((player.clicks ?? 0) > 0) records.push({ label: 'Clicks', note: 'Actions taken', value: (player.clicks ?? 0).toLocaleString() })
  if ((player.deaths ?? 0) > 0) records.push({ label: 'Deaths', value: (player.deaths ?? 0).toLocaleString(), tone: 'text-status-error' })
  const avatarKey = player.uIcon || DEFAULT_PLAYER_AVATAR
  const avatarColor = player.uIconColor || DEFAULT_AVATAR_COLOR
  const coloredAvatarSvg = useColoredAvatar(avatarKey, avatarColor)


  const handleAvatarUpdate = async (avatar: PlayerAvatar, color: string) => {
    if (!isLoggedIn || !player.id) {
      setAvatarModalOpen(false)
      return
    }

    try {
      setIsSavingAvatar(true)
      const response = await fetch('/api/user/avatar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ avatar, color }),
      })

      if (!response.ok) {
        throw new Error('Failed to update avatar')
      }

      const data = await response.json()
      if (data?.player) {
        setPlayer(data.player)
      } else {
        setPlayer({ ...player, uIcon: avatar, uIconColor: color })
      }
      setAvatarModalOpen(false)
    } catch (error) {
      console.error('Avatar update failed:', error)
    } finally {
      setIsSavingAvatar(false)
    }
  }

  return (
    <>
      <div className="relative w-full h-full">
        <div className="@container flex-1 overflow-y-auto min-h-0 p-4">
          <div className="space-y-4">
            <div className="">
              <div className="relative flex flex-row items-start gap-6">
                <div className="relative w-36 h-52 bg-surface-canvas/70 rounded-3xl border border-line-subtle/80 flex items-center justify-center shadow-inner shadow-black/60 flex-shrink-0">
                  {coloredAvatarSvg ? (
                    <div
                      className="w-28 h-44"
                      dangerouslySetInnerHTML={{ __html: coloredAvatarSvg }}
                    />
                  ) : (
                    <div className="text-fg-muted text-sm">Loading avatar...</div>
                  )}
                  <button
                    type="button"
                    className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full text-xs font-semibold fill-accent hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas transition-all"
                    onClick={() => setAvatarModalOpen(true)}
                    disabled={!isLoggedIn}
                  >
                    {isLoggedIn ? 'Edit' : 'Login to edit'}
                  </button>
                </div>

                <div className="flex-1 w-full space-y-3">
                  <div className="space-y-0 text-left">
                    <div className="text-xs uppercase tracking-[0.3em] text-accent-hover/80">lvl {player.level}</div>
                    <h3 className="text-2xl font-semibold text-fg-bright">{player.username}</h3>
                    {titles.length > 0 && (
                      <p className="text-xs text-resource-gold" title="Faction titles: every quest for that faction is done">
                        {titles.join(' · ')}
                      </p>
                    )}
                    <p className="text-sm text-fg-secondary">Room: {player.currentRoom || '???'}</p>
                  </div>

                  <div className="space-y-3">
                    <StatBar
                      label="HP"
                      value={<span className="text-fg-bright">{Math.min(player.hp, player.hpMax)}/{player.hpMax}{player.hp > player.hpMax && <span className="text-resource-gold"> +{player.hp - player.hpMax}</span>}</span>}
                      percentage={hpPercent}
                      gradient="from-fill-resource-hp via-resource-hp to-resource-hp"
                    />
                    <StatBar
                      label="MP"
                      value={<span className="text-fg-bright">{Math.min(player.mp, player.mpMax)}/{player.mpMax}{player.mp > player.mpMax && <span className="text-resource-gold"> +{player.mp - player.mpMax}</span>}</span>}
                      percentage={mpPercent}
                      gradient="from-fill-resource-mp via-resource-mp to-resource-mp"
                    />
                    {/* What every click restores: gear, tea and Regenerate summed —
                        the same formula the server ticks with. */}
                    {regen.any && (
                      <p className="text-xs text-fg-secondary" title="Every counted action restores this much, up to your max. MP regen skips the click you cast a spell on.">
                        <span className="uppercase tracking-wide text-fg-muted">Regen</span>{' '}
                        <span className="text-fg-bright font-semibold">{describeRegen(regen)}</span>
                        {regen.gear.hp + regen.gear.mp > 0 && <span className="text-fg-muted"> · gear {describeRegen(regen.gear).replace(' / click', '')}</span>}
                        {regen.tea && <span className="text-fg-muted"> · tea</span>}
                        {regen.regenerateAmount > 0 && <span className="text-fg-muted"> · Regenerate</span>}
                      </p>
                    )}
                    <StatusStrip chips={chips} />
                    <StatBar
                      label="XP"
                      value={<><span className="text-resource-xp">{xpPct}%</span> <span className="text-fg-secondary">need {xpRemaining}</span></>}
                      percentage={xpPct}
                      gradient="from-fill-resource-xp via-resource-xp to-resource-xp"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Points to spend, right here: a level-up leads to this page and the
                controls are waiting on it. Nothing shows when there is nothing to spend. */}
            {((player.cp ?? 0) > 0 || (player.tp ?? 0) > 0) && isLoggedIn && (
              <div id="char-points" className="scroll-mt-4 space-y-3">
                {(player.tp ?? 0) > 0 && <TrainingAllocation player={player} onTrainingAllocated={onPointsSpent} />}
                {(player.cp ?? 0) > 0 && <StatAllocation player={player} onStatAllocated={onPointsSpent} />}
              </div>
            )}

            {/* Core Stats */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Core Stats</h4>
              <CoreStatsGrid stats={stats} />
              {/* What is worn, the MAX row and the bag are the Inv tab's; this is the way there. */}
              {onSwitchToInventory && (
                <button
                  type="button"
                  onClick={() => onSwitchToInventory()}
                  className="text-xs text-fg-secondary hover:text-fg-bright hover:underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus rounded-sm"
                >
                  Equipment and inventory<span className="text-fg-muted"> ›</span>
                </button>
              )}
            </div>

            {/* The record: what has been trained and what has happened. A line
                appears only once there is something to say on it, so a new
                character is not shown a column of zeros. */}
            {records.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Record</h4>
                <dl className="divide-y divide-line-subtle/40 rounded-xl border border-line-subtle/60 bg-surface-panel/60">
                  {records.map((record) => (
                    <div key={record.label} className="flex items-center gap-3 px-3 py-2">
                      <dt className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg-primary">{record.label}</span>
                        {record.note && <span className="block truncate text-[11px] text-fg-muted">{record.note}</span>}
                      </dt>
                      <dd className={`flex-shrink-0 text-base font-bold tabular-nums ${record.tone ?? 'text-fg-bright'}`}>{record.value}</dd>
                      {record.action}
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <ScrollEnd />
          </div>
        </div>
      </div>

      <AvatarSelectionModal
        isOpen={isAvatarModalOpen}
        currentAvatar={avatarKey}
        currentColor={avatarColor}
        isSaving={isSavingAvatar}
        onClose={() => (isSavingAvatar ? null : setAvatarModalOpen(false))}
        onSelectAvatar={handleAvatarUpdate}
      />
    </>
  )
}

/** The door to the book from the Skill Points line. Pings when some of it can be spent. */
function BookLink({ nudge, disabled, onClick }: { nudge: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <span className="relative inline-flex flex-shrink-0">
      {nudge && <span className="absolute inset-[2px] rounded-md bg-mood-arcane/60 animate-ping-slow" />}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative px-2 py-1 text-[11px] font-semibold fill-mood-arcane hover:opacity-90 disabled:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50 rounded-md transition"
      >
        Open book
      </button>
    </span>
  )
}

interface StatBarProps {
  label: string
  value: React.ReactNode
  percentage: number
  gradient: string
}

function StatBar({ label, value, percentage, gradient }: StatBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-fg-secondary mb-1">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-surface-raised/80 overflow-hidden shadow-[inset_0_1px_3px_var(--shadow)]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-[width] duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}


