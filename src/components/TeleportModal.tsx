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
        className="relative flex max-h-[85vh] w-[90vw] max-w-2xl flex-col overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-gray-700/50">
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
          <div className="space-y-3">
            {locations.map((location) => {
              const isCurrentRoom = location.roomId === currentRoomId
              return (
                <button
                  key={location.roomId}
                  type="button"
                  onClick={() => handleLocationClick(location.roomId)}
                  disabled={isCurrentRoom}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                    isCurrentRoom
                      ? 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-800/70 hover:bg-gray-700/70 border-gray-700/50 hover:border-gray-600/50 text-white cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{location.name}</h3>
                        {isCurrentRoom && (
                          <span className="text-xs px-2 py-0.5 bg-gray-700/50 rounded text-gray-400">
                            Current
                          </span>
                        )}
                      </div>
                      {location.description && (
                        <p className="text-sm text-gray-400 mt-1">{location.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Room ID: {location.roomId}</p>
                    </div>
                    {!isCurrentRoom && (
                      <Icon name="arrow" size={20} className="text-gray-400 ml-2" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-gray-700/50 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-gray-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

