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
      ? 'bg-resource-mp/40 border-resource-mp/60'
      : 'bg-resource-mp/60 hover:bg-resource-mp/80 border-resource-mp/70 hover:border-resource-mp/90'
  } else if (name === 'Grassy Field') {
    return isMuted
      ? 'bg-status-success/40 border-status-success/60'
      : 'bg-status-success/60 hover:bg-status-success/80 border-status-success/70 hover:border-status-success/90'
  } else if (name === 'Forest Crossroads') {
    return isMuted
      ? 'bg-status-success/40 border-status-success/60'
      : 'bg-status-success/60 hover:bg-status-success/80 border-status-success/70 hover:border-status-success/90'
  } else if (name === 'Red Town') {
    return isMuted
      ? 'bg-status-error/40 border-status-error/60'
      : 'bg-status-error/60 hover:bg-status-error/80 border-status-error/70 hover:border-status-error/90'
  } else if (name === 'Room Zero') {
    return isMuted
      ? 'bg-surface-hover/60 border-line-strong/70'
      : 'bg-surface-hover/80 hover:bg-surface-selected/90 border-line-strong/80 hover:border-line-strong/90'
  }
  return isMuted
    ? 'bg-surface-raised/50 border-line-subtle/30'
    : 'bg-surface-raised/70 hover:bg-surface-hover/70 border-line-subtle/30 hover:border-line-strong/50'
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
            ? `${getLocationColor(location.name, true)} text-fg-primary cursor-not-allowed ${isBlocked && !isCurrentRoom ? 'opacity-50' : ''}`
            : `${getLocationColor(location.name, false)} text-fg-bright cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.01]`
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-bold text-fg-bright">{location.name}</h3>
            {isCurrentRoom && (
              <span className="text-[10px] px-1.5 py-0.5 bg-fg-bright/20 rounded text-fg-bright/90 font-medium">
                Current
              </span>
            )}
            {location.description && (
              <span className="text-[11px] text-fg-bright/50 truncate hidden sm:inline">{location.description}</span>
            )}
          </div>
          {!isDisabled && (
            <Icon name="arrow" size={14} className="text-fg-bright/50 flex-shrink-0" />
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-fg-bright">Fast Travel</h2>
        <span className="ml-auto text-[10px] text-fg-muted uppercase tracking-widest">Esc to close</span>
      </div>

      {blockedReason && (
        <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-[11px] leading-relaxed text-status-error/90">
          {blockedReason}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {mainLocations.map(renderLocationButton)}
      </div>

      {vipLocations.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-px flex-1 bg-surface-hover/40" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-resource-gold/70">VIP</span>
            <div className="h-px flex-1 bg-surface-hover/40" />
          </div>
          <div className="flex flex-col gap-2">
            {vipLocations.map(renderLocationButton)}
          </div>
        </>
      )}
    </div>
  )
}
