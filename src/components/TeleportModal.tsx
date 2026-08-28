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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[85vh] w-[90vw] max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700/30 bg-gray-900 shadow-2xl shadow-black/40"
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

        <div className="flex-1 bg-gray-950/40 px-6 py-6 min-h-0 overflow-auto">
          <div className="space-y-4">
            {locations.map((location) => {
              const isCurrentRoom = location.roomId === currentRoomId
              
              // Get location-specific background color
              const getLocationColor = (name: string) => {
                if (name === 'The Lobby' || name === 'Lobby') {
                  return isCurrentRoom
                    ? 'bg-blue-400/40 border-blue-400/60'
                    : 'bg-blue-400/60 hover:bg-blue-400/80 border-blue-500/70 hover:border-blue-400/90'
                } else if (name === 'Grassy Field') {
                  return isCurrentRoom
                    ? 'bg-green-500/40 border-green-500/60'
                    : 'bg-green-500/60 hover:bg-green-500/80 border-green-600/70 hover:border-green-500/90'
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
              
              return (
                <button
                  key={location.roomId}
                  type="button"
                  onClick={() => handleLocationClick(location.roomId)}
                  disabled={isCurrentRoom}
                  className={`w-full text-left px-5 py-4 rounded-lg border-2 transition-all duration-200 ${
                    isCurrentRoom
                      ? `${getLocationColor(location.name)} text-gray-300 cursor-not-allowed`
                      : `${getLocationColor(location.name)} text-white cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.02]`
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-base font-bold text-white">{location.name}</h3>
                        {isCurrentRoom && (
                          <span className="text-xs px-2 py-1 bg-white/20 rounded-md text-white/90 font-medium">
                            Current
                          </span>
                        )}
                      </div>
                      {location.description && (
                        <p className="text-sm text-white/80 leading-relaxed">{location.description}</p>
                      )}
                    </div>
                    {!isCurrentRoom && (
                      <Icon name="arrow" size={20} className="text-white/70 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
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

