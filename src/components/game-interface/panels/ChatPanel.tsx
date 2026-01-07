'use client'

import { X, MessageSquare, ArrowRight, MessagesSquare, Users, Sword } from 'lucide-react'
import UsersDisplay from '@/components/UsersDisplay'

interface ChatPanelProps {
  onOpenWorldChat: () => void
  onClose: () => void
}

export default function ChatPanel({
  onOpenWorldChat,
  onClose,
}: ChatPanelProps) {
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
          <h3 className="text-lg font-semibold text-white">Chat</h3>
          <p className="text-gray-400 text-sm leading-relaxed mt-2">
            Access all communication and game actions through the world feed panel on the right.
          </p>
        </div>
        
        <button
          onClick={onOpenWorldChat}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl font-medium flex items-center gap-2 group"
        >
          <MessageSquare size={16} />
          <span>Open World Chat</span>
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="flex flex-col md:flex-row gap-3 pt-2">
          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 hover:border-gray-600/40 transition-colors flex-1">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-md bg-purple-500/8 border border-purple-500/15 flex-shrink-0">
                <MessagesSquare size={16} className="text-purple-400/80" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-300 mb-1 text-sm">Shout (World Chat)</div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  Broadcast messages to all players using the "World Chat" input mode in the right panel.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 hover:border-gray-600/40 transition-colors flex-1">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-md bg-blue-500/8 border border-blue-500/15 flex-shrink-0">
                <Users size={16} className="text-blue-400/80" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-300 mb-1 text-sm">Say (Room Chat)</div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  Communicate with players in your current room using the "Room Chat" input mode.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 hover:border-gray-600/40 transition-colors flex-1">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/8 border border-amber-500/15 flex-shrink-0">
                <Sword size={16} className="text-amber-400/80" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-300 mb-1 text-sm">Take Action</div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  Perform custom game actions like "examine cabin" or "attack guard" using the "Action" input mode.
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-700/50 pt-6">
          <UsersDisplay />
        </div>
      </div>
    </div>
  )
}

