'use client'

import Icon from './Icon'
import GameChat from './GameChat'

interface GameRightSidebarProps {
  room: any
  onAction: (action: string) => void
  onClose?: () => void
  onOpenMap?: (src: string, title: string) => void
}

export default function GameRightSidebar({ room, onAction, onClose, onOpenMap }: GameRightSidebarProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Mobile close button */}
      {onClose && (
        <div className="lg:hidden flex justify-end p-2 border-b border-gray-700">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      )}
      
      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden min-h-0">
        <GameChat onClose={onClose} />
      </div>
    </div>
  )
}
