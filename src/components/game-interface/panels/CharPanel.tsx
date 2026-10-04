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
import { ScrollEnd } from '@/components/game-interface/LayerShell'

import type { FilterTab } from '@/lib/inventory-categories'

interface CharPanelProps {
  player: Player
  onAction?: (action: string | { type: string; data?: any }) => void
  /** Opens the Inv tab beside the compass: the bag, what is worn and the MAX row live there. */
  onSwitchToInventory?: (filter?: FilterTab, openItemId?: string) => void
  /** Opens the Skills & Spells book on the given tab, ringing one entry. */
  onOpenBook?: (tab: 'skills' | 'spells', highlightId?: string) => void
  /** A fight is running, so a strike or attack spell is this turn's attack. */
  /** An enemy stands in the room: out of a fight, a strike or attack spell opens one. */
  /** Opens the single Core Points modal owned by GameInterface (so Escape and the level-up alert share it). */
  onOpenStatAllocation?: () => void
  onOpenTraining?: () => void
  onClose?: () => void
}


export default function CharPanel({ player, onSwitchToInventory, onOpenBook, onOpenStatAllocation, onOpenTraining, onClose }: CharPanelProps) {
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
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-fg-secondary hover:text-fg-bright transition-colors duration-200 rounded-lg hover:bg-surface-raised/50"
            title="Close"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
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

            {/* Core Stats */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Core Stats</h4>
                <div className="flex items-center gap-1.5">
                  {(player.tp ?? 0) > 0 && (
                    <span className="relative inline-flex">
                      <span className="absolute inset-[2px] rounded-lg bg-resource-gold/60 animate-ping-slow" />
                      <button
                        type="button"
                        onClick={onOpenTraining}
                        disabled={!isLoggedIn || !onOpenTraining}
                        className="relative px-2.5 py-1 text-xs font-semibold text-fg-disabled bg-resource-gold/90 hover:bg-resource-gold disabled:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg transition-colors"
                      >
                        Spend TP ({player.tp ?? 0})
                      </button>
                    </span>
                  )}
                  {(player.cp ?? 0) > 0 && (
                    <span className="relative inline-flex">
                      <span className="absolute inset-[2px] rounded-lg bg-accent/60 animate-ping-slow" />
                      <button
                        type="button"
                        onClick={onOpenStatAllocation}
                        disabled={!isLoggedIn || !onOpenStatAllocation}
                        className="relative px-2.5 py-1 text-xs font-semibold fill-accent hover:bg-accent-hover disabled:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg transition-colors"
                      >
                        Spend CP ({player.cp ?? 0})
                      </button>
                    </span>
                  )}
                </div>
              </div>
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

            {/* Core Points Group */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Points</h4>
                {/* SP is spent in the book; its button sits with TP's and CP's. */}
                {onOpenBook && (
                  <BookLink sp={player.sp ?? 0} nudge={canLearnSkill || canLearnSpell} disabled={!isLoggedIn} onClick={() => onOpenBook('skills')} />
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <StatBox label="Core" value={player.cp ?? 0} compact />
                <StatBox label="Training" value={player.tp ?? 0} compact />
                <StatBox label="Skill" value={player.sp ?? 0} compact />
                <StatBox label="PT" value={player.physicalTraining ?? 0} compact subtle />
                <StatBox label="MT" value={player.mentalTraining ?? 0} compact subtle />
                <StatBox label="Gold" value={(player.currency ?? 0).toLocaleString()} compact />
                <StatBox label="Clicks" value={(player.clicks ?? 0).toLocaleString()} compact subtle />
                <StatBox label="Deaths" value={(player.deaths ?? 0).toLocaleString()} compact subtle />
              </div>
            </div>
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

/** The door to the book, wearing the SP there is to spend. Pings when some of it can be spent. */
function BookLink({ sp, nudge, disabled, onClick }: { sp: number; nudge: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <span className="relative inline-flex flex-shrink-0">
      {nudge && <span className="absolute inset-[2px] rounded-md bg-mood-arcane/60 animate-ping-slow" />}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative px-2 py-1 text-[11px] font-semibold fill-mood-arcane hover:opacity-90 disabled:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50 rounded-md transition-colors"
      >
        Book · {sp} SP
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

interface StatBoxProps {
  label: string
  value: number | string
  subtle?: boolean
}

function StatBox({ label, value, subtle = false, compact = false }: StatBoxProps & { compact?: boolean }) {
  return (
    <div className={`rounded-xl border text-center ${compact ? 'px-2 py-1.5' : 'px-4 py-3'} ${subtle ? 'border-line-subtle/70 bg-surface-panel/60' : 'border-line-subtle/80 bg-surface-panel/80'}`}>
      <p className="text-xs uppercase tracking-wide text-fg-secondary leading-none">{label}</p>
      <p className={`font-semibold text-fg-bright ${compact ? 'text-base mt-0.5' : 'text-lg mt-1'}`}>{value}</p>
    </div>
  )
}

