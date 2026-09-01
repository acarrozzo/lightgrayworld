'use client'

import type { Player } from '@/lib/game-state'
import type { PartySnapshot } from '@/lib/socket'
import RosterPanel from './RosterPanel'
import PartyPanel from './PartyPanel'
import RanksPanel from './RanksPanel'
import DMPanel from './DMPanel'
import NotificationBadge from '@/components/NotificationBadge'
import SubTabButton from '../SubTabButton'
import { X } from 'lucide-react'

export type PlayersSubTab = 'roster' | 'party' | 'ranks' | 'dm'

type ProfileTarget = {
  id: string
  username: string
  level: number
  uIcon?: string | null
  uIconColor?: string | null
}

interface PlayersPanelProps {
  activeSubTab: PlayersSubTab
  onSubTabChange: (tab: PlayersSubTab) => void
  unreadDmCount: number
  onOpenWorldChat: () => void
  onClose: () => void
  onDMMessageSent: (payload: { message: string; recipientUsername?: string; recipientUserId: string }) => void
  // Roster + party surfaces
  party: PartySnapshot | null
  roomPlayers: Player[]
  currentPlayerId: string
  currentPlayer?: Player
  onOpenProfile: (player: ProfileTarget) => void
  onMessagePlayer: (player: Pick<Player, 'id' | 'username'>) => void
  onFollowPlayer: (targetId: string) => void
  onLeaveParty: () => void
  onRemovePartyMember: (memberId: string) => void
}

const SUB_TABS: { id: PlayersSubTab; label: string }[] = [
  { id: 'roster', label: 'Players' },
  { id: 'party', label: 'Party' },
  { id: 'ranks', label: 'Ranks' },
  { id: 'dm', label: 'DM' },
]

export default function PlayersPanel({
  activeSubTab,
  onSubTabChange,
  unreadDmCount,
  onOpenWorldChat,
  onClose,
  onDMMessageSent,
  party,
  roomPlayers,
  currentPlayerId,
  currentPlayer,
  onOpenProfile,
  onMessagePlayer,
  onFollowPlayer,
  onLeaveParty,
  onRemovePartyMember,
}: PlayersPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 gap-2 border-b border-line-subtle/50 py-2 pl-4 pr-12 md:pr-4">
        <div className="flex flex-1 flex-nowrap items-center justify-start gap-2">
          {SUB_TABS.map((tab) => {
            const showBadge = tab.id === 'dm' && unreadDmCount > 0
            const showPartySize = tab.id === 'party' && party
            return (
              <SubTabButton
                key={tab.id}
                active={activeSubTab === tab.id}
                color="pink"
                // Clicking the active sub-tab returns to Players, this panel's core content.
                onClick={() => onSubTabChange(activeSubTab === tab.id ? 'roster' : tab.id)}
              >
                {tab.label}
                {showPartySize && (
                  <span className="ml-1 text-[10px] text-fg-muted">
                    {party.size}/{party.maxSize}
                  </span>
                )}
                {showBadge && <NotificationBadge value={unreadDmCount} className="absolute -top-1 -right-1" />}
              </SubTabButton>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="hidden rounded-lg p-1.5 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright md:block"
          title="Close"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Every sub-tab owns its own scrolling. The old panel clipped its content
          here with overflow-hidden and no inner scroller, which made the roster
          unreachable past the fold. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSubTab === 'roster' && (
          <RosterPanel
            onOpenProfile={onOpenProfile}
            onMessage={onMessagePlayer}
            onFollow={onFollowPlayer}
            onOpenWorldChat={onOpenWorldChat}
          />
        )}

        {activeSubTab === 'party' && (
          <div className="h-full overflow-y-auto p-4">
            <PartyPanel
              party={party}
              roomPlayers={roomPlayers}
              currentPlayerId={currentPlayerId}
              currentPlayer={currentPlayer}
              onFollow={onFollowPlayer}
              onLeave={onLeaveParty}
              onRemove={onRemovePartyMember}
              onInspect={onOpenProfile}
              onMessage={onMessagePlayer}
            />
            {!party && roomPlayers.length <= 1 && (
              <p className="mt-3 text-xs leading-relaxed text-fg-muted">
                Parties form between players standing in the same room. Find someone on the
                Players tab, travel to them, then Follow to join up. Up to six travel together —
                members are pulled along with the leader.
              </p>
            )}
          </div>
        )}

        {activeSubTab === 'ranks' && <RanksPanel onOpenProfile={onOpenProfile} />}

        {activeSubTab === 'dm' && <DMPanel onClose={onClose} onMessageSent={onDMMessageSent} />}
      </div>
    </div>
  )
}
