'use client'

import type { Player } from '@/lib/game-state'
import type { PartySnapshot } from '@/lib/socket'
import RosterPanel from './RosterPanel'
import PartyPanel from './PartyPanel'
import RanksPanel from './RanksPanel'
import DMPanel from './DMPanel'

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
  onOpenWorldChat: () => void
  onClose: () => void
  onDMMessageSent: (payload: { message: string; recipientUsername?: string; recipientUserId: string }) => void
  // Roster + party surfaces
  party: PartySnapshot | null
  roomPlayers: Player[]
  currentPlayerId: string
  currentPlayer?: Player
  /** The room everyone is standing in, for the per-member safety reading. */
  roomDanger?: { dangerLevel?: number | null; isSafe?: boolean | null } | null
  pendingFollowIds?: Set<string>
  onOpenProfile: (player: ProfileTarget) => void
  onMessagePlayer: (player: Pick<Player, 'id' | 'username'>) => void
  onFollowPlayer: (targetId: string) => void
  onLeaveParty: () => void
  onRemovePartyMember: (memberId: string) => void
}

/** The Players tab's pages. The sub-tabs themselves are in the tab's header, drawn by GameInterface. */
export const PLAYER_SUB_TABS: { id: PlayersSubTab; label: string }[] = [
  { id: 'roster', label: 'Players' },
  { id: 'party', label: 'Party' },
  { id: 'ranks', label: 'Ranks' },
  { id: 'dm', label: 'DM' },
]

export default function PlayersPanel({
  activeSubTab,
  onOpenWorldChat,
  onClose,
  onDMMessageSent,
  party,
  roomPlayers,
  currentPlayerId,
  currentPlayer,
  roomDanger,
  pendingFollowIds,
  onOpenProfile,
  onMessagePlayer,
  onFollowPlayer,
  onLeaveParty,
  onRemovePartyMember,
}: PlayersPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
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
              roomDanger={roomDanger}
              pendingFollowIds={pendingFollowIds}
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
