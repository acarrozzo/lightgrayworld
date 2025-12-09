'use client'

import { useState } from 'react'
import GameFeed, { FeedControlHandlers } from './GameFeed'
import GameChat from './GameChat'
import Icon from './Icon'
import type { Room } from '@/lib/game-state'

interface GameTabsProps {
  room: Room | null
  actionResult?: any
  onRegisterFeedControls?: (handlers: FeedControlHandlers) => void
  onClose?: () => void
}

type TabType = 'feed' | 'world-chat' | 'room-chat'

export default function GameTabs({ room, actionResult, onRegisterFeedControls, onClose }: GameTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('feed')

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'feed'
              ? 'text-white border-b-2 border-blue-500 bg-gray-900'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab('world-chat')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'world-chat'
              ? 'text-white border-b-2 border-blue-500 bg-gray-900'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          World Chat
        </button>
        <button
          onClick={() => setActiveTab('room-chat')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'room-chat'
              ? 'text-white border-b-2 border-blue-500 bg-gray-900'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          Room Chat
        </button>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-3 text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <Icon name="x" size={20} />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'feed' && (
          <GameFeed 
            room={room} 
            actionResult={actionResult} 
            onRegisterControls={onRegisterFeedControls}
          />
        )}
        {activeTab === 'world-chat' && (
          <GameChat onClose={onClose} />
        )}
        {activeTab === 'room-chat' && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-gray-400 text-lg mb-2">Room Chat</p>
              <p className="text-gray-500 text-sm">Coming Soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

