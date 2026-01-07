'use client'

import { X, Home, ArrowRight } from 'lucide-react'

interface HomePanelProps {
  onTeleport: (toRoomId: string) => void
  onClose: () => void
}

export default function HomePanel({
  onTeleport,
  onClose,
}: HomePanelProps) {
  return (
    <div className="relative w-full h-full">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
        title="Close"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Home</h3>
          <p className="text-gray-400 text-sm leading-relaxed mt-2">
            Make your home truly yours! Customize your own space and add your own items to create a personalized sanctuary in the world.
          </p>
        </div>
        
        <button
          onClick={() => {
            // Placeholder - functionality to be implemented later
          }}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl font-medium flex items-center gap-2 group"
        >
          <Home size={16} />
          <span>Take me Home</span>
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Teleport Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Teleport to:</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onTeleport('999')}
              className="px-2 py-1 bg-blue-400/50 hover:bg-blue-400/70 border border-blue-500/50 hover:border-blue-400/70 text-white rounded text-xs transition-all duration-200"
            >
              The Lobby
            </button>
            <button
              onClick={() => onTeleport('001')}
              className="px-2 py-1 bg-green-500/50 hover:bg-green-500/70 border border-green-600/50 hover:border-green-500/70 text-white rounded text-xs transition-all duration-200"
            >
              Grassy Field
            </button>
            <button
              onClick={() => onTeleport('000')}
              className="px-2 py-1 bg-gray-700/70 hover:bg-gray-600/70 border border-gray-600/50 hover:border-gray-500/50 text-white rounded text-xs transition-all duration-200"
            >
              Room Zero
            </button>
            <button
              onClick={() => onTeleport('088')}
              className="px-2 py-1 bg-gray-900/70 hover:bg-gray-900/90 border border-gray-700/50 hover:border-amber-300/70 text-gray-300 rounded text-xs transition-all duration-200"
            >
              Solar Office
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

