'use client'

import ChatPanel from './ChatPanel'
import DMPanel from './DMPanel'
import NotificationBadge from '@/components/NotificationBadge'
import SubTabButton from '../SubTabButton'

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
        <div className="flex-1 flex items-center justify-start gap-2 flex-nowrap">
          {SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id
            const showBadge = tab.id === 'dm' && unreadDmCount > 0
            return (
              <SubTabButton
                key={tab.id}
                active={isActive}
                color="pink"
                onClick={() => onSubTabChange(tab.id)}
              >
                {tab.label}
                {showBadge && <NotificationBadge value={unreadDmCount} className="absolute -top-1 -right-1" />}
              </SubTabButton>
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
