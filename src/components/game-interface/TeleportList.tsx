'use client'

import Icon from '@/components/Icon'

export interface TeleportLocation {
  roomId: string
  name: string
  description?: string
}

interface TeleportListProps {
  locations: TeleportLocation[]
  currentRoomId?: string
  onTeleport: (roomId: string) => void
  /**
   * When set, every destination is disabled and this reason is shown above the
   * list. The server refuses these cases anyway (party followers in
   * socket-server-handlers, combat in room-state) — showing the reason inline
   * beats a button that silently does nothing.
   */
  blockedReason?: string | null
}

const VIP_ROOM_IDS = new Set(['000', '088'])

// Location-specific background color, matching each destination's world color.
const getLocationColor = (name: string, isMuted: boolean) => {
  if (name === 'The Lobby' || name === 'Lobby') {
    return isMuted
      ? 'bg-blue-400/40 border-blue-400/60'
      : 'bg-blue-400/60 hover:bg-blue-400/80 border-blue-500/70 hover:border-blue-400/90'
  } else if (name === 'Grassy Field') {
    return isMuted
      ? 'bg-green-500/40 border-green-500/60'
      : 'bg-green-500/60 hover:bg-green-500/80 border-green-600/70 hover:border-green-500/90'
  } else if (name === 'Forest Crossroads') {
    return isMuted
      ? 'bg-emerald-700/40 border-emerald-700/60'
      : 'bg-emerald-700/60 hover:bg-emerald-700/80 border-emerald-800/70 hover:border-emerald-700/90'
  } else if (name === 'Red Town') {
    return isMuted
      ? 'bg-red-600/40 border-red-600/60'
      : 'bg-red-600/60 hover:bg-red-600/80 border-red-700/70 hover:border-red-600/90'
  } else if (name === 'Room Zero') {
    return isMuted
      ? 'bg-gray-700/60 border-gray-600/70'
      : 'bg-gray-700/80 hover:bg-gray-600/90 border-gray-600/80 hover:border-gray-500/90'
  }
  return isMuted
    ? 'bg-gray-800/50 border-gray-700/30'
    : 'bg-gray-800/70 hover:bg-gray-700/70 border-gray-700/30 hover:border-gray-600/50'
}

export default function TeleportList({
  locations,
  currentRoomId,
  onTeleport,
  blockedReason = null,
}: TeleportListProps) {
  const isBlocked = !!blockedReason

  const mainLocations = locations.filter((l) => !VIP_ROOM_IDS.has(l.roomId))
  const vipLocations = locations.filter((l) => VIP_ROOM_IDS.has(l.roomId))

  const renderLocationButton = (location: TeleportLocation) => {
    const isCurrentRoom = location.roomId === currentRoomId
    const isDisabled = isCurrentRoom || isBlocked
    return (
      <button
        key={location.roomId}
        type="button"
        onClick={() => onTeleport(location.roomId)}
        disabled={isDisabled}
        className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-200 ${
          isDisabled
            ? `${getLocationColor(location.name, true)} text-gray-300 cursor-not-allowed ${isBlocked && !isCurrentRoom ? 'opacity-50' : ''}`
            : `${getLocationColor(location.name, false)} text-white cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.01]`
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-bold text-white">{location.name}</h3>
            {isCurrentRoom && (
              <span className="text-[10px] px-1.5 py-0.5 bg-white/20 rounded text-white/90 font-medium">
                Current
              </span>
            )}
            {location.description && (
              <span className="text-[11px] text-white/50 truncate hidden sm:inline">{location.description}</span>
            )}
          </div>
          {!isDisabled && (
            <Icon name="arrow" size={14} className="text-white/50 flex-shrink-0" />
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-white">Fast Travel</h2>
        <span className="ml-auto text-[10px] text-gray-500 uppercase tracking-widest">Esc to close</span>
      </div>

      {blockedReason && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-300/90">
          {blockedReason}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {mainLocations.map(renderLocationButton)}
      </div>

      {vipLocations.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-px flex-1 bg-gray-700/40" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">VIP</span>
            <div className="h-px flex-1 bg-gray-700/40" />
          </div>
          <div className="flex flex-col gap-2">
            {vipLocations.map(renderLocationButton)}
          </div>
        </>
      )}
    </div>
  )
}
