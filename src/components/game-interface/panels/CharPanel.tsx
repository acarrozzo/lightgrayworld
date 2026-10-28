'use client'

import { Player, useGameStore } from '@/lib/game-state'
import Icon from '@/components/Icon'
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
import VitalBar from '@/components/game-interface/VitalBar'
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
  /** Wear one of the earned titles, or none (null). The server validates and the header follows. */
  onSetTitle?: (title: string | null) => void
}

// Pets are named from the shared registry; the player carries only the slug.
const { getPet } = require('@/lib/game-data/pets') as { getPet: (slug: string | null | undefined) => { slug: string; name: string; icon: string } | null }

export default function CharPanel({ player, onSwitchToInventory, onOpenBook, bookTab = null, onPointsSpent, onSetTitle }: CharPanelProps) {
  const inventory = useGameStore((state) => state.inventory)
  const questRows = useGameStore((state) => state.quests)
  // The titles the player may wear: the Pillar's growing name, then the guilds'.
  const titles = earnedTitles(questRows)
  const [isTitlePickerOpen, setTitlePickerOpen] = useState(false)
  const setPlayer = useGameStore((state) => state.setPlayer)
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const isLoggedIn = useGameStore((state) => state.isLoggedIn)
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)


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
                    {/* The title worn, and the picker for the ones earned: the
                        Pillar's name (every quest of a land, claimed from the
                        Guardian Angel) and each guild's at max standing. */}
                    {(player.title || titles.length > 0) && (
                      <div className="text-xs">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={player.title ? 'font-semibold text-resource-gold' : 'text-fg-muted'} title={player.title ? 'The title you wear' : 'No title worn'}>
                            {player.title ?? 'No title'}
                          </span>
                          {onSetTitle && titles.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setTitlePickerOpen((open) => !open)}
                              aria-expanded={isTitlePickerOpen}
                              className="text-[10px] uppercase tracking-wide text-fg-muted hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus rounded"
                            >
                              {isTitlePickerOpen ? 'Done' : 'Change'}
                            </button>
                          )}
                        </div>
                        {isTitlePickerOpen && onSetTitle && (
                          <div className="mt-1.5 flex flex-wrap gap-1" role="radiogroup" aria-label="Title to wear">
                            {[null, ...titles].map((option) => {
                              const worn = (player.title ?? null) === option
                              return (
                                <button
                                  key={option ?? '__none'}
                                  type="button"
                                  role="radio"
                                  aria-checked={worn}
                                  onClick={() => { if (!worn) onSetTitle(option) }}
                                  className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                                    worn
                                      ? 'border-resource-gold bg-resource-gold/15 text-resource-gold font-semibold'
                                      : 'border-line-subtle text-fg-secondary hover:border-resource-gold/60 hover:text-fg-bright'
                                  }`}
                                >
                                  {option ?? 'No title'}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-fg-secondary">Room: {player.currentRoom || '???'}</p>
                    {/* The pet along, or the pets at home: company, no numbers. Switch opens the bag's Pets group. */}
                    {(() => {
                      const along = getPet(player.activePet)
                      const heldPets = inventory.filter((item) => Boolean((item.template.metadata as { pet?: unknown } | null)?.pet))
                      if (!along && heldPets.length === 0) return null
                      return (
                        <p className="flex items-center gap-1.5 text-sm text-fg-secondary">
                          {along ? (
                            <>
                              <Icon name={along.icon} size={14} color="current" />
                              <span>Pet: <span className="text-fg-bright">{along.name}</span></span>
                            </>
                          ) : (
                            <span>Pet: <span className="text-fg-muted">none along</span></span>
                          )}
                          {onSwitchToInventory && (
                            <button
                              type="button"
                              onClick={() => onSwitchToInventory('pets')}
                              className="text-xs text-accent-hover underline-offset-2 hover:underline"
                            >
                              {along ? 'Switch' : 'Choose'}
                            </button>
                          )}
                        </p>
                      )
                    })()}
                  </div>

                  <div className="space-y-3">
                    <VitalRow label="HP">
                      <VitalBar kind="hp" size="fat" self current={player.hp} max={player.hpMax} className="w-full" />
                    </VitalRow>
                    <VitalRow label="MP">
                      <VitalBar kind="mp" size="fat" current={player.mp} max={player.mpMax} className="w-full" />
                    </VitalRow>
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
                    <VitalRow label="XP" aside={<span className="text-fg-secondary">need {xpRemaining.toLocaleString()}</span>}>
                      <VitalBar
                        kind="xp"
                        size="fat"
                        current={xpInLevel}
                        max={xpRange}
                        extra={<span className="text-resource-xp">· {xpPct}%</span>}
                        title={`XP ${xpInLevel.toLocaleString()} of ${xpRange.toLocaleString()} this level · ${xpPct}%`}
                        className="w-full"
                      />
                    </VitalRow>
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

/** A vital's row: the label in its column, the shared bar beside it, a note after. */
function VitalRow({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-x-2 text-xs">
      <span className="text-fg-secondary">{label}</span>
      {children}
      <span className="text-[11px] tabular-nums">{aside}</span>
    </div>
  )
}


