'use client'

import RoomDisplay from './RoomDisplay'
import type { Room, Player } from '@/lib/game-state'
import Icon from './Icon'
import { useMemo } from 'react'
import { roomColor } from '@/lib/theme/room-colors'

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
}

interface RoomBoxProps {
  room: Room
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction: (action: string | { type: string; data?: any }) => void | Promise<void>
  onOpenPlayerProfile?: (player: Player) => void
  gatherCooldowns?: Array<{
    action: string
    cooldownSeconds: number
    secondsRemaining: number
    quantity?: number | null
    itemSlug?: string | null
    itemNamePlural?: string | null
    maxHeld?: number | null
    readyLabel?: string | null
  }>
  worldTick?: {
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  }
  actionResult?: any
  isLoadingRoom?: boolean
  roomEnemies?: RoomEnemy[]
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
  worldTick,
  actionResult,
  isLoadingRoom = false,
  roomEnemies = [],
  isInBattle = false,
  isPartyMember = false,
  quests = [],
  killList = [],
}: RoomBoxProps) {
  const iconSizeClasses: Record<string, string> = {
    sm: 'w-12 h-12 sm:w-20 sm:h-20',
    md: 'w-20 h-20 sm:w-32 sm:h-32',
    lg: 'w-24 h-24 sm:w-40 sm:h-40',
    xl: 'w-36 h-36 sm:w-60 sm:h-60',
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
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header with icon and two-line title */}
      <div className="flex items-center gap-4">
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
            className="text-xl sm:text-2xl font-bold"
            style={{ color: roomColor(room.nameColor, room.region, 'title') }}
          >
            {room.name}
          </h3>
          {hasSubtitle && subtitlePlacement === 'below' && (
            <p
              className="font-bold text-base sm:text-lg"
              style={{ color: roomColor(room.subtitleColor, room.region, 'subtitle') }}
            >
              {subtitleText}
            </p>
          )}
        </div>
      </div>

      {/* Room Description */}
      <p className="text-fg-primary/90 leading-relaxed text-sm sm:text-base">{room.description}</p>

      {/* Enemies in Room */}
      {roomEnemies.length > 0 && (
        <div className="space-y-2">
          {roomEnemies.map((enemy, index) => (
            <div
              key={`${enemy.slug}-${index}`}
              className={`inline-flex items-center gap-3 rounded-lg border px-3 py-2.5 ${enemy.isAggressive ? 'border-action-attack/40 bg-action-attack/30 shadow-sm shadow-shadow/20' : 'border-line-subtle/30 bg-surface-raised/30'}`}
            >
              <img
                src={`/icons/enemy/${encodeURIComponent(enemy.name)}.svg`}
                alt={enemy.name}
                className="w-12 h-12 shrink-0 object-contain brightness-0 invert"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold truncate ${enemy.isAggressive ? 'text-enemy-hostile' : 'text-fg-bright'}`}>
                    {enemy.name}
                  </span>
                  {enemy.isAggressive ? (
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
                  <span className="text-fg-bright font-bold text-sm">Lv. {enemy.level}</span>
                  <span className="text-fg-disabled">·</span>
                  <span className="text-fg-muted">HP <span className="font-semibold text-terrain-grass">{enemy.hp}</span></span>
                  <span className="text-fg-muted">ATT <span className="font-semibold text-enemy-hostile">{enemy.att}</span></span>
                  <span className="text-fg-muted">DEF <span className="font-semibold text-resource-gold">{enemy.def}</span></span>
                </div>
              </div>
              <button
                onClick={() => onAction({ type: 'start_battle', data: { enemySlug: enemy.slug } })}
                disabled={isInBattle || isLoadingRoom}
                title={isInBattle ? 'You are already in combat' : `Attack the ${enemy.name}`}
                className="ml-1 shrink-0 px-3.5 py-1.5 text-xs font-semibold fill-action-attack disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all duration-150 shadow-sm active:scale-[0.97]"
              >
                Attack
              </button>
            </div>
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
        showHeader={false}
        className="mt-2"
        worldTick={worldTick}
        actionResult={actionResult}
        quests={quests}
        killList={killList}
      />

    </div>
  )
}

