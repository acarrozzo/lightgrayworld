'use client'

import { Player, useGameStore, InventoryItem } from '@/lib/game-state'
import { earnedTitles } from '@/lib/game-data/quest-registry'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AvatarSelectionModal from '@/components/AvatarSelectionModal'
import { DEFAULT_PLAYER_AVATAR, PlayerAvatar, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { EquipSlot } from '@prisma/client'
import Icon from '@/components/Icon'
import { resolveItemIcon } from '@/lib/item-actions'
import { buildSpellbook, hasLearnableSpell, spellTone } from '@/lib/spellbook'
import { buildSkillbook, gearContextFromInventory, hasLearnableSkill, passiveSkillBonuses, skillTone } from '@/lib/skillbook'
import AutoEquipRow from '@/components/game-interface/AutoEquipRow'
import { describeStat, effectiveStats, type StatBreakdown } from '@/lib/effective-stats'

import type { FilterTab } from '@/lib/inventory-categories'

interface CharPanelProps {
  player: Player
  onAction?: (action: string | { type: string; data?: any }) => void
  onSwitchToInventory?: (filter?: FilterTab) => void
  /** Opens the Skills & Spells book on the given tab. */
  onOpenBook?: (tab: 'skills' | 'spells') => void
  /** Opens the single Core Points modal owned by GameInterface (so Escape and the level-up alert share it). */
  onOpenStatAllocation?: () => void
  onOpenTraining?: () => void
  onClose?: () => void
}

const STAT_MOD_COLORS: Record<string, string> = {
  str: 'text-stat-str',
  dex: 'text-stat-dex',
  mag: 'text-stat-mag',
  def: 'text-stat-def',
}

function renderStatMods(metadata: any): React.ReactNode {
  if (!metadata || typeof metadata !== 'object') return null
  const statMods = metadata.statMods
  if (!statMods || typeof statMods !== 'object') return null

  const statOrder = ['str', 'dex', 'mag', 'def'] as const
  const statLabels: Record<string, string> = { str: 'STR', dex: 'DEX', mag: 'MAG', def: 'DEF' }

  const parts: React.ReactNode[] = []
  for (const stat of statOrder) {
    const value = statMods[stat]
    if (typeof value === 'number' && value !== 0) {
      const sign = value > 0 ? '+' : ''
      const color = value > 0 ? STAT_MOD_COLORS[stat] : 'text-fg-disabled'
      if (parts.length > 0) parts.push(<span key={`${stat}-sep`} className="text-fg-muted">, </span>)
      parts.push(<span key={stat} className={color}>{sign}{value} {statLabels[stat]}</span>)
    }
  }
  return parts.length > 0 ? <>{parts}</> : null
}

export default function CharPanel({ player, onAction, onSwitchToInventory, onOpenBook, onOpenStatAllocation, onOpenTraining, onClose }: CharPanelProps) {
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
  const spellbook = useMemo(() => buildSpellbook(player), [player])
  const learnedSpells = spellbook.filter((entry) => entry.level >= 1)
  const hasAnyTeacher = spellbook.some((entry) => entry.maxLevel > 0)
  const canLearnSpell = hasLearnableSpell(player)
  const skillbook = useMemo(() => buildSkillbook(player), [player])
  const learnedSkills = skillbook.filter((entry) => entry.level >= 1)
  const hasAnySkillTeacher = skillbook.some((entry) => entry.maxLevel > 0)
  const canLearnSkill = hasLearnableSkill(player)
  // What the passives add for what is in hand right now — shown on the stats.
  const gear = useMemo(() => gearContextFromInventory(inventory), [inventory])
  const passives = useMemo(() => passiveSkillBonuses(player, gear), [player, gear])
  // The four stats as combat rolls them — the same numbers the header shows.
  const stats = useMemo(() => effectiveStats(player, inventory), [player, inventory])
  const avatarKey = player.uIcon || DEFAULT_PLAYER_AVATAR
  const avatarColor = player.uIconColor || DEFAULT_AVATAR_COLOR
  const coloredAvatarSvg = useColoredAvatar(avatarKey, avatarColor)

  // Group equipped items by slot
  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipSlot | null, typeof inventory[0]>()
    inventory
      .filter((item) => item.isEquipped === true)
      .forEach((item) => {
        if (item.slot) {
          map.set(item.slot as EquipSlot, item)
        }
      })
    return map
  }, [inventory])

  // Slots whose item just changed — a manual equip, an auto-equip loadout —
  // flash for a moment so the eye finds what moved.
  const prevSlotItemsRef = useRef<Map<string, string | null> | null>(null)
  const [flashSlots, setFlashSlots] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const now = new Map<string, string | null>()
    for (const slot of Object.values(EquipSlot)) now.set(slot, equippedBySlot.get(slot)?.id ?? null)
    const prev = prevSlotItemsRef.current
    prevSlotItemsRef.current = now
    if (!prev) return
    const changed = new Set<string>()
    for (const [slot, id] of now) if (prev.get(slot) !== id) changed.add(slot)
    if (changed.size === 0) return
    setFlashSlots(changed)
    const timer = setTimeout(() => setFlashSlots(new Set()), 1500)
    return () => clearTimeout(timer)
  }, [equippedBySlot])

  // Map EquipSlot to FilterTab
  const getFilterForSlot = (slot: EquipSlot): FilterTab => {
    switch (slot) {
      case EquipSlot.MAIN_HAND:
        return 'main'
      case EquipSlot.OFF_HAND:
        return 'off'
      case EquipSlot.HEAD:
        return 'head'
      case EquipSlot.BODY:
        return 'body'
      case EquipSlot.HANDS:
        return 'hands'
      case EquipSlot.FEET:
        return 'feet'
      case EquipSlot.RING:
        return 'ring'
      case EquipSlot.NECK:
        return 'neck'
      case EquipSlot.MOUNT:
        return 'mount'
      case EquipSlot.ARTIFACT:
        return 'artifact'
      case EquipSlot.COMPANION:
        return 'companion'
      default:
        return 'all'
    }
  }

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
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
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
              <div className="grid grid-cols-4 gap-1.5">
                <StatDisplay label="STR" stat={stats.str} compact color="text-stat-str" />
                <StatDisplay label="DEX" stat={stats.dex} compact color="text-stat-dex" />
                <StatDisplay label="MAG" stat={stats.mag} compact color="text-stat-mag" />
                <StatDisplay label="DEF" stat={stats.def} compact color="text-stat-def" />
              </div>
              <AutoEquipRow disabled={!isLoggedIn || !onAction} onAction={onAction} />
            </div>

            {/* Equipment Display */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-fg-primary uppercase tracking-wide">Equipment</h4>
              <div className="grid grid-cols-2 gap-2">
                {/* Row 1: MAIN_HAND, OFF_HAND */}
                <EquipmentSlot
                  slot={EquipSlot.MAIN_HAND}
                  flash={flashSlots.has(EquipSlot.MAIN_HAND)}
                  item={equippedBySlot.get(EquipSlot.MAIN_HAND)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.MAIN_HAND))}
                />
                <EquipmentSlot
                  slot={EquipSlot.OFF_HAND}
                  flash={flashSlots.has(EquipSlot.OFF_HAND)}
                  item={equippedBySlot.get(EquipSlot.OFF_HAND)}
                  ghostItem={(() => {
                    const main = equippedBySlot.get(EquipSlot.MAIN_HAND)
                    return main && (main.template.metadata as any)?.isTwoHanded ? main : undefined
                  })()}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.OFF_HAND))}
                />
                {/* Row 2: HEAD, BODY */}
                <EquipmentSlot
                  slot={EquipSlot.HEAD}
                  flash={flashSlots.has(EquipSlot.HEAD)}
                  item={equippedBySlot.get(EquipSlot.HEAD)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.HEAD))}
                />
                <EquipmentSlot
                  slot={EquipSlot.BODY}
                  flash={flashSlots.has(EquipSlot.BODY)}
                  item={equippedBySlot.get(EquipSlot.BODY)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.BODY))}
                />
                {/* Row 3: HANDS, FEET */}
                <EquipmentSlot
                  slot={EquipSlot.HANDS}
                  flash={flashSlots.has(EquipSlot.HANDS)}
                  item={equippedBySlot.get(EquipSlot.HANDS)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.HANDS))}
                />
                <EquipmentSlot
                  slot={EquipSlot.FEET}
                  flash={flashSlots.has(EquipSlot.FEET)}
                  item={equippedBySlot.get(EquipSlot.FEET)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.FEET))}
                />
                {/* Row 4: RING */}
                <EquipmentSlot
                  slot={EquipSlot.RING}
                  flash={flashSlots.has(EquipSlot.RING)}
                  item={equippedBySlot.get(EquipSlot.RING)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.RING))}
                />
                <EquipmentSlot
                  slot={EquipSlot.NECK}
                  flash={flashSlots.has(EquipSlot.NECK)}
                  item={equippedBySlot.get(EquipSlot.NECK)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.NECK))}
                />
                {/* Row 5: MOUNT, ARTIFACT */}
                <EquipmentSlot
                  slot={EquipSlot.MOUNT}
                  flash={flashSlots.has(EquipSlot.MOUNT)}
                  item={equippedBySlot.get(EquipSlot.MOUNT)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.MOUNT))}
                />
                <EquipmentSlot
                  slot={EquipSlot.ARTIFACT}
                  flash={flashSlots.has(EquipSlot.ARTIFACT)}
                  item={equippedBySlot.get(EquipSlot.ARTIFACT)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.ARTIFACT))}
                />
                {/* Row 6: COMPANION — swings beside you on every attack turn */}
                <EquipmentSlot
                  slot={EquipSlot.COMPANION}
                  flash={flashSlots.has(EquipSlot.COMPANION)}
                  item={equippedBySlot.get(EquipSlot.COMPANION)}
                  onUnequip={(playerItemId) =>
                    onAction?.({
                      type: 'unequip_item',
                      data: { playerItemId },
                    })
                  }
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.COMPANION))}
                />
              </div>
            </div>

            {/* Skills & Spells: what's learned, and the door to the book that spends SP on both. */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Skills &amp; Spells</h4>
                {onOpenBook && (
                  <span className="relative inline-flex">
                    {(canLearnSkill || canLearnSpell) && (
                      <span className="absolute inset-[2px] rounded-lg bg-mood-arcane/60 animate-ping-slow" />
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenBook(canLearnSkill && !canLearnSpell ? 'skills' : canLearnSpell ? 'spells' : 'skills')}
                      disabled={!isLoggedIn}
                      className="relative px-2.5 py-1 text-xs font-semibold fill-mood-arcane hover:opacity-90 disabled:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg transition-colors"
                    >
                      Open book ({player.sp ?? 0} SP)
                    </button>
                  </span>
                )}
              </div>
              <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider px-1">Skills</p>
              {learnedSkills.length === 0 ? (
                <p className="text-xs text-fg-muted italic px-1">
                  {hasAnySkillTeacher ? 'No skills learned yet. Open the book to spend SP.' : 'No skills yet. Find a teacher — the Young Soldier trains recruits east of the Grassy Field.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {learnedSkills.map((entry) => {
                    const tone = skillTone(entry.def.hue)
                    const part = passives.parts.find((p) => p.skillId === entry.def.id)
                    const now = part
                      ? part.stat === 'dodge' ? `${part.amount}% dodge` : `+${part.amount} ${part.stat.toUpperCase()} now`
                      : entry.def.kind === 'strike' && entry.castCost !== null ? `${entry.castCost} MP` : 'not in hand'
                    return (
                      <div key={entry.def.id} className="rounded-lg border border-line-subtle/70 bg-surface-panel/60 px-2.5 py-1.5 flex items-center gap-2">
                        <Icon name={entry.def.icon} size={20} className={`${tone.text} flex-shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-fg-bright truncate">{entry.def.name}</p>
                          <p className="text-[10px] text-fg-muted tabular-nums">
                            lvl {entry.level}/{entry.maxLevel} · <span className={entry.def.kind === 'strike' ? 'text-resource-mp' : part ? tone.text : 'text-fg-disabled'}>{now}</span>
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider px-1 pt-1">Spells</p>
              {learnedSpells.length === 0 ? (
                <p className="text-xs text-fg-muted italic px-1">
                  {hasAnyTeacher ? 'No spells learned yet. Open the book to spend SP.' : 'No spells yet. Find a teacher — the Pajama Shaman camps north-east of the Grassy Field.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {learnedSpells.map((entry) => {
                    const tone = spellTone(entry.def.hue)
                    return (
                      <div key={entry.def.id} className="rounded-lg border border-line-subtle/70 bg-surface-panel/60 px-2.5 py-1.5 flex items-center gap-2">
                        <Icon name={entry.def.icon} size={20} className={`${tone.text} flex-shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-fg-bright truncate">{entry.def.name}</p>
                          <p className="text-[10px] text-fg-muted tabular-nums">
                            lvl {entry.level}/{entry.maxLevel} · <span className="text-resource-mp">{entry.castCost} MP</span>
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Core Points Group */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Points</h4>
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

interface StatDisplayProps {
  label: string
  /** The stat as combat rolls it: core, gear, running buffs, and the passive skills for what is in hand. */
  stat: StatBreakdown
}

function StatDisplay({ label, stat, compact = false, color }: StatDisplayProps & { compact?: boolean; color?: string }) {
  return (
    <div
      className={`rounded-xl border border-line-subtle/40 bg-surface-panel/60 text-center ${compact ? 'px-2 py-1.5' : 'px-4 py-3'}`}
      title={describeStat(label, stat)}
    >
      <p className={`text-xs uppercase tracking-wide leading-none ${color ?? 'text-fg-secondary'}`}>{label}</p>
      <p className={`font-bold ${color ?? 'text-fg-bright'} ${compact ? 'text-lg mt-0.5' : 'text-2xl mt-1'}`}>{stat.total}</p>
      <p className="text-xs text-fg-muted leading-none tabular-nums">
        {stat.core}
        {stat.buff > 0 && <span className="text-fg-disabled"> · +{stat.buff} buff</span>}
        {stat.skill > 0 && <span className="text-fg-disabled"> · +{stat.skill} skill</span>}
      </p>
    </div>
  )
}

interface EquipmentSlotProps {
  slot: EquipSlot
  item?: InventoryItem
  ghostItem?: InventoryItem
  /** The item here just changed: a short ring so the change is seen. */
  flash?: boolean
  onUnequip: (playerItemId: string) => void
  onSwitchToInventory?: () => void
}

const FLASH = 'ring-2 ring-accent/70'

function EquipmentSlot({ slot, item, ghostItem, flash = false, onUnequip, onSwitchToInventory }: EquipmentSlotProps) {
  const slotName = slot.replace(/_/g, ' ')
  const flashClass = flash ? FLASH : ''

  if (item) {
    const mods = renderStatMods(item.template.metadata)
    const icon = resolveItemIcon(item.template.metadata as { icon?: string } | null, item.template.slug ?? '')

    return (
      <button
        onClick={() => onSwitchToInventory?.()}
        className={`rounded-lg border border-line-subtle/80 bg-surface-panel/80 px-3 py-2 text-left hover:bg-surface-raised/80 transition-all duration-500 flex items-center gap-2 ${flashClass}`}
      >
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-surface-hover/40 border border-line-strong/30">
          <Icon name={icon} size={22} className="text-fg-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}</p>
          <p className="text-sm font-medium text-fg-bright truncate">{item.template.name}</p>
          {mods && <p className="text-xs">{mods}</p>}
        </div>
      </button>
    )
  }

  if (ghostItem) {
    const ghostMods = renderStatMods(ghostItem.template.metadata)
    const ghostIcon = resolveItemIcon(ghostItem.template.metadata as { icon?: string } | null, ghostItem.template.slug ?? '')

    return (
      <div className={`rounded-lg border border-line-subtle/80 bg-surface-panel/80 px-3 py-2 cursor-default select-none transition-all duration-500 ${flashClass}`}>
        <div className="flex items-center gap-2 opacity-35">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-surface-hover/40 border border-line-strong/30">
            <Icon name={ghostIcon} size={22} className="text-fg-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}</p>
            <p className="text-sm font-medium text-fg-bright truncate">{ghostItem.template.name}</p>
            {ghostMods && <p className="text-xs">{ghostMods}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => onSwitchToInventory?.()}
      className={`rounded-lg border border-line-subtle/70 bg-surface-panel/60 px-3 py-2 text-left hover:bg-surface-raised/60 hover:border-line-subtle transition-all duration-500 cursor-pointer ${flashClass}`}
    >
      <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}</p>
      <p className="text-sm text-fg-muted mt-0.5">- - -</p>
    </button>
  )
}
