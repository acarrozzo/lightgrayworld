'use client'

import { useState } from 'react'
import Icon from './Icon'
import Compass from './Compass'
import GameChat from './GameChat'

interface GameRightSidebarProps {
  room: any
  onAction: (action: string) => void
  onClose?: () => void
}

export default function GameRightSidebar({ room, onAction, onClose }: GameRightSidebarProps) {
  const [activeTab, setActiveTab] = useState('nav')
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)

  const tabs = [
    { id: 'nav', label: 'Nav', icon: 'world', color: 'blue' },
    { id: 'chat', label: 'Chat', icon: 'question', color: 'green', hasNotification: hasUnreadMessages },
  ]

  const handleNewMessage = () => {
    if (activeTab !== 'chat') {
      setHasUnreadMessages(true)
    }
  }

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    if (tabId === 'chat') {
      setHasUnreadMessages(false)
    }
  }

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
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium relative ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-center">
              <Icon name={tab.icon} size={16} color={tab.color} className="mr-1" />
              {tab.label}
              {tab.hasNotification && (
                <div className="ml-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'nav' && (
          <div className="h-full flex flex-col">
            {/* Compass Navigation */}
            <div className="p-4 flex justify-center border-b border-gray-700 flex-shrink-0">
              <Compass room={room} onAction={onAction} />
            </div>
            
            {/* Additional navigation content can go here */}
            <div className="flex-1 p-4 overflow-y-auto min-h-0">
              <div className="text-gray-400 text-sm text-center">
                Additional navigation features coming soon...
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="h-full flex flex-col min-h-0">
            <GameChat onClose={onClose} onNewMessage={handleNewMessage} />
          </div>
        )}
      </div>
    </div>
  )
}
