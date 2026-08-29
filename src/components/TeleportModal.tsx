'use client'

import Icon from './Icon'

export interface TeleportLocation {
  roomId: string
  name: string
  description?: string
}

interface TeleportModalProps {
  isOpen: boolean
  onClose: () => void
  locations: TeleportLocation[]
  onTeleport: (roomId: string) => void
  currentRoomId?: string
}

const VIP_ROOM_IDS = new Set(['000', '088'])

export default function TeleportModal({ isOpen, onClose, locations, onTeleport, currentRoomId }: TeleportModalProps) {
  const handleLocationClick = (roomId: string) => {
    if (roomId === currentRoomId) {
      onClose()
      return
    }
    onTeleport(roomId)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  const mainLocations = locations.filter((l) => !VIP_ROOM_IDS.has(l.roomId))
  const vipLocations = locations.filter((l) => VIP_ROOM_IDS.has(l.roomId))

  // Get location-specific background color
  const getLocationColor = (name: string, isCurrentRoom: boolean) => {
    if (name === 'The Lobby' || name === 'Lobby') {
      return isCurrentRoom
        ? 'bg-blue-400/40 border-blue-400/60'
        : 'bg-blue-400/60 hover:bg-blue-400/80 border-blue-500/70 hover:border-blue-400/90'
    } else if (name === 'Grassy Field') {
      return isCurrentRoom
        ? 'bg-green-500/40 border-green-500/60'
        : 'bg-green-500/60 hover:bg-green-500/80 border-green-600/70 hover:border-green-500/90'
    } else if (name === 'Forest Crossroads') {
      return isCurrentRoom
        ? 'bg-emerald-700/40 border-emerald-700/60'
        : 'bg-emerald-700/60 hover:bg-emerald-700/80 border-emerald-800/70 hover:border-emerald-700/90'
    } else if (name === 'Room Zero') {
      return isCurrentRoom
        ? 'bg-gray-700/60 border-gray-600/70'
        : 'bg-gray-700/80 hover:bg-gray-600/90 border-gray-600/80 hover:border-gray-500/90'
    }
    // Default color for other locations
    return isCurrentRoom
      ? 'bg-gray-800/50 border-gray-700/30'
      : 'bg-gray-800/70 hover:bg-gray-700/70 border-gray-700/30 hover:border-gray-600/50'
  }

  const renderLocationButton = (location: TeleportLocation) => {
    const isCurrentRoom = location.roomId === currentRoomId
    return (
      <button
        key={location.roomId}
        type="button"
        onClick={() => handleLocationClick(location.roomId)}
        disabled={isCurrentRoom}
        className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all duration-200 ${
          isCurrentRoom
            ? `${getLocationColor(location.name, true)} text-gray-300 cursor-not-allowed`
            : `${getLocationColor(location.name, false)} text-white cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.01]`
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="text-sm font-bold text-white">{location.name}</h3>
            {isCurrentRoom && (
              <span className="text-[10px] px-1.5 py-0.5 bg-white/20 rounded text-white/90 font-medium">
                Current
              </span>
            )}
            {location.description && (
              <span className="text-xs text-white/50 hidden sm:inline">{location.description}</span>
            )}
          </div>
          {!isCurrentRoom && (
            <Icon name="arrow" size={14} className="text-white/50 flex-shrink-0" />
          )}
        </div>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[85vh] w-[90vw] max-w-md flex-col overflow-hidden rounded-xl border border-gray-700/30 bg-gray-900 shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-gray-700/30">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-lg font-semibold text-white">Fast Travel</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-gray-400 transition-colors hover:text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              aria-label="Close teleport menu"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-gray-950/40 px-4 py-4 min-h-0 overflow-auto">
          <div className="space-y-2">
            {mainLocations.map(renderLocationButton)}
          </div>

          {vipLocations.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-5 mb-2">
                <div className="h-px flex-1 bg-gray-700/40" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">VIP</span>
                <div className="h-px flex-1 bg-gray-700/40" />
              </div>
              <div className="space-y-2">
                {vipLocations.map(renderLocationButton)}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-700/30 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-700/80 px-4 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

