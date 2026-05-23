'use client'

import ChatPanel from './ChatPanel'
import DMPanel from './DMPanel'

export type PlayersSubTab = 'players' | 'dm'

interface PlayersPanelProps {
  activeSubTab: PlayersSubTab
  onSubTabChange: (tab: PlayersSubTab) => void
  unreadDmCount: number
  onOpenWorldChat: () => void
  onClose: () => void
  onDMMessageSent: (payload: { message: string; recipientUsername?: string; recipientUserId: string }) => void
}

const SUB_TABS: { id: PlayersSubTab; label: string }[] = [
  { id: 'players', label: 'Players' },
  { id: 'dm', label: 'DM' },
]

export default function PlayersPanel({
  activeSubTab,
  onSubTabChange,
  unreadDmCount,
  onOpenWorldChat,
  onClose,
  onDMMessageSent,
}: PlayersPanelProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-2 border-b border-gray-700/50 pl-4 pr-12 md:pr-4 py-2 flex-shrink-0">
        <div className="flex-1 flex items-center justify-center gap-2 flex-nowrap">
          {SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id
            const showBadge = tab.id === 'dm' && unreadDmCount > 0
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSubTabChange(tab.id)}
                className={`relative px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center rounded-lg shadow-sm hover:shadow flex-shrink-0 ${
                  isActive
                    ? 'border-1 border-pink-500 hover:border-pink-400 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300'
                    : 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {showBadge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white">
                    {unreadDmCount > 99 ? '99+' : unreadDmCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeSubTab === 'players' ? (
          <ChatPanel onOpenWorldChat={onOpenWorldChat} onClose={onClose} />
        ) : (
          <DMPanel onClose={onClose} onMessageSent={onDMMessageSent} />
        )}
      </div>
    </div>
  )
}
