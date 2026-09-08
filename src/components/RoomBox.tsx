'use client'

import RoomDisplay from './RoomDisplay'
import TravelerCard from './TravelerCard'
import BasicActionButtons from './BasicActionButtons'
import type { Room, Player } from '@/lib/game-state'
import type { GatherCooldownView, SupplyView } from '@/lib/types/room'
import Icon from './Icon'
import { useEffect, useMemo, useState } from 'react'
import { roomColor } from '@/lib/theme/room-colors'
import { getEnemyTraits } from '@/lib/game-data/enemy-traits'
import EnemyTraitTags from './EnemyTraitTags'

const DIRECTIONS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
] as const

type DirectionKey = (typeof DIRECTIONS)[number]

export interface RoomEnemy {
  slug: string
  name: string
  description: string
  icon: string
  level: number
  hp: number
  att: number
  def: number
  isAggressive: boolean
  isFriendly: boolean
  /** Trait flags from the enemy definition, read by getEnemyTraits for the tag row. */
  specials?: string[]
  isFlying?: boolean
  damageType?: 'MELEE' | 'RANGED' | 'MAGIC'
  isMeleeImmune?: boolean
  isRangedImmune?: boolean
  isMagicImmune?: boolean
}

interface RoomBoxProps {
  room: Room
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction: (action: string | { type: string; data?: any }) => void | Promise<void>
  onOpenPlayerProfile?: (player: Player) => void
  gatherCooldowns?: GatherCooldownView[]
  supplies?: SupplyView[]
  worldTick?: {
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  }
  actionResult?: any
  isLoadingRoom?: boolean
  /** The action in flight, so its button can show it is working. */
  currentAction?: string
  roomEnemy?: RoomEnemy | null
  isInBattle?: boolean
  isPartyMember?: boolean
  quests?: Array<{ id: string; questId: string; progress: number; completed: boolean }>
  killList?: { monster: string; kills: number }[]
}

export default function RoomBox({
  room,
  roomPlayers = [],
  currentPlayerId,
  onAction,
  onOpenPlayerProfile,
  gatherCooldowns,
  supplies,
  worldTick,
  actionResult,
  isLoadingRoom = false,
  currentAction = '',
  roomEnemy = null,
  isInBattle = false,
  isPartyMember = false,
  quests = [],
  killList = [],
}: RoomBoxProps) {

  // A departure note stays up long enough to be read, then goes on its own.
  // Keyed on the note's timestamp so a new departure restarts the clock.
  const TRAVELER_NOTE_MS = 25_000
  const noteTs = room?.travelerNote?.ts ?? null
  const [travelerNoteVisible, setTravelerNoteVisible] = useState(false)
  useEffect(() => {
    if (noteTs == null) {
      setTravelerNoteVisible(false)
      return
    }
    const remaining = TRAVELER_NOTE_MS - (Date.now() - noteTs)
    if (remaining <= 0) {
      setTravelerNoteVisible(false)
      return
    }
    setTravelerNoteVisible(true)
    const timer = setTimeout(() => setTravelerNoteVisible(false), remaining)
    return () => clearTimeout(timer)
  }, [noteTs])
  // Sizes key off the room column (a container), not the viewport: between
  // two desktop side panels the column can be phone-narrow. Below 28rem the
  // compact set is used, as on a phone.
  const iconSizeClasses: Record<string, string> = {
    sm: 'w-12 h-12 @md:w-20 @md:h-20',
    md: 'w-20 h-20 @md:w-32 @md:h-32',
    lg: 'w-24 h-24 @md:w-40 @md:h-40',
    xl: 'w-36 h-36 @md:w-60 @md:h-60',
  }
  const iconClassName = iconSizeClasses[room.iconSize ?? ''] ?? iconSizeClasses.sm

  const subtitleText = (room.subtitle ?? 'This is it. The world is yours.').trim()
  const hasSubtitle = subtitleText.length > 0
  const subtitlePlacement = room.subtitlePosition?.toLowerCase() === 'above' ? 'above' : 'below'

  const availableDirections = useMemo(
    () => DIRECTIONS.filter((dir) => typeof room[dir as DirectionKey] === 'string' && room[dir as DirectionKey]),
    [room]
  )

  const handleDirection = (dir: DirectionKey) => {
    if (!onAction || isPartyMember) return
    onAction(dir)
  }

  return (
    <div className="p-4 @md:p-6 space-y-4">
      {/* Header with icon and two-line title. On desktop the feed toggle
          floats at the column's top right, so a column narrower than the
          content cap plus the button's clearance keeps the title out from
          under it. */}
      <div className="flex items-center gap-4 lg:@max-[992px]:pr-10">
        <div style={{ color: roomColor(room.iconColor, room.region, 'icon') }}>
          <Icon name={room.icon || 'sun'} className={iconClassName} color="current" />
        </div>
        <div className="flex-1">
          {hasSubtitle && subtitlePlacement === 'above' && (
            <p
              className="font-bold text-lg"
              style={{ color: roomColor(room.subtitleColor, room.region, 'subtitle') }}
            >
              {subtitleText}
            </p>
          )}
          <h3
            className="text-xl @md:text-2xl font-bold"
            style={{ color: roomColor(room.nameColor, room.region, 'title') }}
          >
            {room.name}
          </h3>
          {hasSubtitle && subtitlePlacement === 'below' && (
            <p
              className="font-bold text-base @md:text-lg"
              style={{ color: roomColor(room.subtitleColor, room.region, 'subtitle') }}
            >
              {subtitleText}
            </p>
          )}
        </div>
      </div>

      {/* Room Description */}
      <p className="text-fg-primary/90 leading-relaxed text-sm @md:text-base">{room.description}</p>

      {/* Enemy in Room — one at a time, as in the original. In a narrow
          column the Attack button drops to its own line under the stats. */}
      {roomEnemy && (
        <div
          className={`inline-flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${roomEnemy.isAggressive ? 'border-action-attack/40 bg-action-attack/30 shadow-sm shadow-shadow/20' : 'border-line-subtle/30 bg-surface-raised/30'}`}
        >
          <img
            src={`/icons/enemy/${encodeURIComponent(roomEnemy.name)}.svg`}
            alt={roomEnemy.name}
            className="w-12 h-12 shrink-0 object-contain brightness-0 invert"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold truncate ${roomEnemy.isAggressive ? 'text-enemy-hostile' : 'text-fg-bright'}`}>
                {roomEnemy.name}
              </span>
              {roomEnemy.isAggressive ? (
                <span className="text-[10px] font-bold text-enemy-hostile bg-action-attack/30 border border-action-attack/40 px-1 rounded shrink-0">
                  HOSTILE
                </span>
              ) : (
                <span className="text-[10px] text-fg-muted bg-surface-raised/60 px-1 rounded shrink-0">
                  neutral
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-xs mt-0.5">
              <span className="text-fg-bright font-bold text-sm">Lv. {roomEnemy.level}</span>
              <span className="text-fg-disabled">·</span>
              <span className="text-fg-muted">HP <span className="font-semibold text-terrain-grass">{roomEnemy.hp}</span></span>
              <span className="text-fg-muted">ATT <span className="font-semibold text-enemy-hostile">{roomEnemy.att}</span></span>
              <span className="text-fg-muted">DEF <span className="font-semibold text-resource-gold">{roomEnemy.def}</span></span>
            </div>
            <EnemyTraitTags traits={getEnemyTraits(roomEnemy)} className="mt-1.5" />
          </div>
          <div className="flex basis-full justify-end @md:basis-auto @md:ml-1">
            <button
              onClick={() => onAction({ type: 'start_battle', data: { enemySlug: roomEnemy.slug } })}
              disabled={isInBattle || isLoadingRoom}
              title={isInBattle ? 'You are already in combat' : `Attack the ${roomEnemy.name}`}
              className="shrink-0 px-3.5 py-1.5 text-xs font-semibold fill-action-attack disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all duration-150 shadow-sm active:scale-[0.97]"
            >
              Attack
            </button>
          </div>
        </div>
      )}

      {/* Where the last traveler went — the feed line, pinned where the player looks */}
      {travelerNoteVisible && room.travelerNote?.message && (
        <p className="text-xs text-resource-gold/80 italic">{room.travelerNote.message}</p>
      )}

      {/* Travelers passing through — shared by everyone here */}
      {Array.isArray(room.travelers) && room.travelers.length > 0 && (
        <div className="space-y-2">
          {room.travelers.map((traveler) => (
            <TravelerCard
              key={traveler.id}
              traveler={traveler}
              onAction={onAction}
              isInBattle={isInBattle}
              isLoadingRoom={isLoadingRoom}
            />
          ))}
        </div>
      )}

      {/* Direction Buttons */}
      {availableDirections.length > 0 && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            {availableDirections.map((dir) => (
              <button
                key={dir}
                onClick={() => handleDirection(dir)}
                disabled={isPartyMember}
                title={isPartyMember ? 'Following your party — leave to move freely' : undefined}
                className="px-4 py-1.5 fill-surface-raised hover:bg-surface-hover/80 disabled:opacity-40 disabled:cursor-not-allowed/80 hover:text-fg-bright rounded-lg text-sm transition-all duration-200 border border-line-subtle/30 hover:border-line-strong/50"
              >
                {dir.charAt(0).toUpperCase() + dir.slice(1)}
              </button>
            ))}
          </div>
          {isPartyMember && (
            <p className="text-[11px] text-status-info/70">Following your party — leave to move freely.</p>
          )}
        </div>
      )}

      <RoomDisplay
        room={room}
        roomPlayers={roomPlayers}
        currentPlayerId={currentPlayerId}
        onAction={onAction}
        onOpenPlayerProfile={onOpenPlayerProfile}
        gatherCooldowns={gatherCooldowns}
        supplies={supplies}
        showHeader={false}
        className="mt-2"
        worldTick={worldTick}
        actionResult={actionResult}
        quests={quests}
        killList={killList}
      />

      {/* The three persistent actions, last in the room as the original kept
          them: everything the room offers comes first, then what you can
          always do. This is their only copy: the result flyout anchors here. */}
      <BasicActionButtons
        onAction={onAction}
        actionResult={actionResult}
        isLoadingRoom={isLoadingRoom}
        currentAction={currentAction}
        containerClassName="flex flex-wrap gap-2 mt-4 pt-4 border-t border-line-subtle/30"
      />
    </div>
  )
}

