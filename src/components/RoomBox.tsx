'use client'

import RoomDisplay from './RoomDisplay'
import type { Room, Player } from '@/lib/game-state'
import Icon from './Icon'
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

// Copied from the previous GameFeed helper to ensure Tailwind picks up dynamic color classes
export const getTextColorClass = (color?: string | null, defaultColor: string = 'green-400'): string => {
  const colorValue = color || defaultColor

  const colorMap: Record<string, string> = {
    'red-50': 'text-red-50',
    'red-100': 'text-red-100',
    'red-200': 'text-red-200',
    'red-300': 'text-red-300',
    'red-400': 'text-red-400',
    'red-500': 'text-red-500',
    'red-600': 'text-red-600',
    'red-700': 'text-red-700',
    'red-800': 'text-red-800',
    'red-900': 'text-red-900',
    'blue-50': 'text-blue-50',
    'blue-100': 'text-blue-100',
    'blue-200': 'text-blue-200',
    'blue-300': 'text-blue-300',
    'blue-400': 'text-blue-400',
    'blue-500': 'text-blue-500',
    'blue-600': 'text-blue-600',
    'blue-700': 'text-blue-700',
    'blue-800': 'text-blue-800',
    'blue-900': 'text-blue-900',
    'green-50': 'text-green-50',
    'green-100': 'text-green-100',
    'green-200': 'text-green-200',
    'green-300': 'text-green-300',
    'green-400': 'text-green-400',
    'grass': 'text-green-400',
    'green-500': 'text-green-500',
    'green-600': 'text-green-600',
    'green-700': 'text-green-700',
    'green-800': 'text-green-800',
    'green-900': 'text-green-900',
    'yellow-50': 'text-yellow-50',
    'yellow-100': 'text-yellow-100',
    'yellow-200': 'text-yellow-200',
    'yellow-300': 'text-yellow-300',
    'yellow-400': 'text-yellow-400',
    'yellow-500': 'text-yellow-500',
    'yellow-600': 'text-yellow-600',
    'yellow-700': 'text-yellow-700',
    'dirt': 'text-yellow-700',
    'yellow-800': 'text-yellow-800',
    'yellow-900': 'text-yellow-900',
    'purple-50': 'text-purple-50',
    'purple-100': 'text-purple-100',
    'purple-200': 'text-purple-200',
    'purple-300': 'text-purple-300',
    'purple-400': 'text-purple-400',
    'purple-500': 'text-purple-500',
    'purple-600': 'text-purple-600',
    'purple-700': 'text-purple-700',
    'purple-800': 'text-purple-800',
    'purple-900': 'text-purple-900',
    'pink-50': 'text-pink-50',
    'pink-100': 'text-pink-100',
    'pink-200': 'text-pink-200',
    'pink-300': 'text-pink-300',
    'pink-400': 'text-pink-400',
    'pink-500': 'text-pink-500',
    'pink-600': 'text-pink-600',
    'pink-700': 'text-pink-700',
    'pink-800': 'text-pink-800',
    'pink-900': 'text-pink-900',
    'orange-50': 'text-orange-50',
    'orange-100': 'text-orange-100',
    'orange-200': 'text-orange-200',
    'orange-300': 'text-orange-300',
    'orange-400': 'text-orange-400',
    'orange-500': 'text-orange-500',
    'orange-600': 'text-orange-600',
    'orange-700': 'text-orange-700',
    'orange-800': 'text-orange-800',
    'orange-900': 'text-orange-900',
    'amber-50': 'text-amber-50',
    'amber-100': 'text-amber-100',
    'amber-200': 'text-amber-200',
    'amber-300': 'text-amber-300',
    'sand': 'text-amber-300',
    'amber-400': 'text-amber-400',
    'amber-500': 'text-amber-500',
    'amber-600': 'text-amber-600',
    'amber-700': 'text-amber-700',
    'amber-800': 'text-amber-800',
    'amber-900': 'text-amber-900',
    'gray-50': 'text-gray-50',
    'gray-100': 'text-gray-100',
    'gray-200': 'text-gray-200',
    'gray-300': 'text-gray-300',
    'gray-400': 'text-gray-400',
    'gray-500': 'text-gray-500',
    'gray-600': 'text-gray-600',
    'gray-700': 'text-gray-700',
    'gray-800': 'text-gray-800',
    'gray-900': 'text-gray-900',
    'indigo-50': 'text-indigo-50',
    'indigo-100': 'text-indigo-100',
    'indigo-200': 'text-indigo-200',
    'indigo-300': 'text-indigo-300',
    'indigo-400': 'text-indigo-400',
    'indigo-500': 'text-indigo-500',
    'indigo-600': 'text-indigo-600',
    'indigo-700': 'text-indigo-700',
    'indigo-800': 'text-indigo-800',
    'indigo-900': 'text-indigo-900',
  }

  return colorMap[colorValue] || `text-${colorValue}`
}

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
  onRefreshCaps?: () => void | Promise<void>
  worldTick?: {
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  }
  actionResult?: any
  isLoadingRoom?: boolean
  currentAction?: string
  roomEnemies?: RoomEnemy[]
  isInBattle?: boolean
  quests?: Array<{ id: string; questId: string; progress: number; completed: boolean }>
  killList?: { monster: string; kills: number }[]
}

export default function RoomBox({
  room,
  roomPlayers = [],
  currentPlayerId,
  onAction,
  onOpenPlayerProfile,
  onRefreshCaps,
  worldTick,
  actionResult,
  isLoadingRoom = false,
  currentAction = '',
  roomEnemies = [],
  isInBattle = false,
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
  const [isMoreActionsExpanded, setIsMoreActionsExpanded] = useState(false)

  const availableDirections = useMemo(
    () => DIRECTIONS.filter((dir) => typeof room[dir as DirectionKey] === 'string' && room[dir as DirectionKey]),
    [room]
  )

  const handleDirection = (dir: DirectionKey) => {
    if (!onAction) return
    onAction(dir)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header with icon and two-line title */}
      <div className="flex items-center gap-4">
        <div className={getTextColorClass(room.iconColor, 'yellow-400')}>
          <Icon name={room.icon || 'sun'} className={iconClassName} color="current" />
        </div>
        <div className="flex-1">
          {hasSubtitle && subtitlePlacement === 'above' && (
            <p className={`${getTextColorClass(room.subtitleColor, 'blue-300')} font-bold text-lg`}>{subtitleText}</p>
          )}
          <h3 className={`text-xl sm:text-2xl font-bold ${getTextColorClass(room.nameColor, 'green-400')}`}>
            {room.name}
          </h3>
          {hasSubtitle && subtitlePlacement === 'below' && (
            <p className={`${getTextColorClass(room.subtitleColor, 'blue-300')} font-bold text-base sm:text-lg`}>
              {subtitleText}
            </p>
          )}
        </div>
      </div>

      {/* Room Description */}
      <p className="text-gray-300/90 leading-relaxed text-sm sm:text-base">{room.description}</p>

      {/* Enemies in Room */}
      {roomEnemies.length > 0 && (
        <div className="space-y-2">
          {roomEnemies.map((enemy) => (
            <div
              key={enemy.slug}
              className={`inline-flex items-center gap-3 rounded-lg border px-3 py-2 ${enemy.isAggressive ? 'border-red-800/50 bg-red-950/20' : 'border-gray-700/40 bg-gray-800/40'}`}
            >
              <img
                src={`/icons/enemy/${encodeURIComponent(enemy.name)}.svg`}
                alt={enemy.name}
                className="w-12 h-12 shrink-0 object-contain brightness-0 invert"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold truncate ${enemy.isAggressive ? 'text-red-200' : 'text-gray-200'}`}>
                    {enemy.name}
                  </span>
                  {enemy.isAggressive ? (
                    <span className="text-[10px] font-bold text-red-400 bg-red-900/30 border border-red-800/40 px-1 rounded shrink-0">
                      HOSTILE
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-500 bg-gray-800/60 px-1 rounded shrink-0">
                      neutral
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-xs mt-0.5">
                  <span className="text-white font-bold text-sm">Lv. {enemy.level}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-gray-500">HP <span className="font-semibold text-green-400">{enemy.hp}</span></span>
                  <span className="text-gray-500">ATT <span className="font-semibold text-red-400">{enemy.att}</span></span>
                  <span className="text-gray-500">DEF <span className="font-semibold text-amber-400">{enemy.def}</span></span>
                </div>
              </div>
              <button
                onClick={() => onAction({ type: 'start_battle', data: { enemySlug: enemy.slug } })}
                disabled={isInBattle || isLoadingRoom}
                title={isInBattle ? 'You are already in combat' : `Attack the ${enemy.name}`}
                className="ml-1 shrink-0 px-3 py-1 text-xs font-semibold bg-red-700/60 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-all duration-150"
              >
                Attack
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Direction Buttons */}
      {availableDirections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableDirections.map((dir) => (
            <button
              key={dir}
              onClick={() => handleDirection(dir)}
              className="px-4 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg text-sm transition-all duration-200"
            >
              {dir.charAt(0).toUpperCase() + dir.slice(1)}
            </button>
          ))}
        </div>
      )}

      <RoomDisplay
        room={room}
        roomPlayers={roomPlayers}
        currentPlayerId={currentPlayerId}
        onAction={onAction}
        onOpenPlayerProfile={onOpenPlayerProfile}
        onRefreshCaps={onRefreshCaps}
        showHeader={false}
        className="mt-2"
        worldTick={worldTick}
        actionResult={actionResult}
        quests={quests}
        killList={killList}
      />

      {/* Basic Actions */}
      <div className="mt-6 pt-4">
        <div className="w-32 border-t border-gray-800/50 mb-4"></div>
        <div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                console.log('[ActionButton] Attack button clicked')
                onAction('attack')
              }}
              disabled={isLoadingRoom}
              className="px-3 py-1 bg-red-500/70 hover:bg-red-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
            >
              {isLoadingRoom && currentAction === 'attack' ? '...' : 'Attack'}
            </button>
            <button
              onClick={() => {
                console.log('[ActionButton] Search button clicked')
                onAction('search')
              }}
              disabled={isLoadingRoom}
              className="px-3 py-1 bg-amber-500/70 hover:bg-amber-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
            >
              {isLoadingRoom && currentAction === 'search' ? '...' : 'Search'}
            </button>
            <button
              onClick={() => {
                console.log('[ActionButton] Rest button clicked')
                onAction('rest')
              }}
              disabled={isLoadingRoom}
              className="px-3 py-1 bg-green-500/70 hover:bg-green-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
            >
              {isLoadingRoom && currentAction === 'rest' ? '...' : 'Rest'}
            </button>
            <button
              onClick={() => {
                console.log('[ActionButton] Look button clicked')
                onAction('look')
              }}
              disabled={isLoadingRoom}
              className="px-3 py-1 bg-blue-500/70 hover:bg-blue-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
            >
              {isLoadingRoom && currentAction === 'look' ? '...' : 'Look'}
            </button>
          </div>
        </div>
      </div>

      {/* More Actions Section */}
      <div className="mt-4">
        <div className="flex flex-col gap-4">
          {/* Collapsible Header */}
          <button
            type="button"
            onClick={() => setIsMoreActionsExpanded((prev) => !prev)}
            className="group flex items-center gap-2 transition-all duration-200 text-gray-500 hover:text-gray-300 rounded-md px-2 py-1 -mx-2 -my-1 w-auto self-start"
            aria-expanded={isMoreActionsExpanded}
            aria-label="Toggle more actions"
          >
            <span className="text-sm font-medium">More Actions</span>
            {isMoreActionsExpanded ? (
              <ChevronUp size={14} className="text-gray-500 group-hover:text-white transition-colors duration-200" />
            ) : (
              <ChevronDown size={14} className="text-gray-500 group-hover:text-white transition-colors duration-200" />
            )}
          </button>

          {/* Collapsible Content */}
          {isMoreActionsExpanded && (
            <div className="flex flex-col gap-4">
              {/* Teleport */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Teleport to:</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (onAction) {
                        onAction({ type: 'teleport', data: { toRoomId: '999' } })
                      }
                    }}
                    className="px-2 py-1 bg-blue-400/50 hover:bg-blue-400/70 border border-blue-500/50 hover:border-blue-400/70 text-white rounded text-xs transition-all duration-200"
                  >
                    The Lobby
                  </button>
                  <button
                    onClick={() => {
                      if (onAction) {
                        onAction({ type: 'teleport', data: { toRoomId: '001' } })
                      }
                    }}
                    className="px-2 py-1 bg-green-500/50 hover:bg-green-500/70 border border-green-600/50 hover:border-green-500/70 text-white rounded text-xs transition-all duration-200"
                  >
                    Grassy Field
                  </button>
                  <button
                    onClick={() => {
                      if (onAction) {
                        onAction({ type: 'teleport', data: { toRoomId: '000' } })
                      }
                    }}
                    className="px-2 py-1 bg-gray-700/70 hover:bg-gray-600/70 border border-gray-600/50 hover:border-gray-500/50 text-white rounded text-xs transition-all duration-200"
                  >
                    Room Zero
                  </button>
                  <button
                    onClick={() => {
                      if (onAction) {
                        onAction({ type: 'teleport', data: { toRoomId: '088' } })
                      }
                    }}
                    className="px-2 py-1 bg-gray-900/70 hover:bg-gray-900/90 border border-gray-700/50 hover:border-amber-300/70 text-gray-300 rounded text-xs transition-all duration-200"
                  >
                    Solar Office
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

