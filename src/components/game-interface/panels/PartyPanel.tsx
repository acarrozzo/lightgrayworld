'use client'

import { Player } from '@/lib/game-state'
import { PartySnapshot } from '@/lib/socket'

interface PartyPanelProps {
  party: PartySnapshot | null
  roomPlayers: Player[]
  currentPlayerId: string
  onFollow: (targetId: string) => void
  onLeave: () => void
  onRemove: (memberId: string) => void
}

export default function PartyPanel({
  party,
  roomPlayers,
  currentPlayerId,
  onFollow,
  onLeave,
  onRemove,
}: PartyPanelProps) {
  const inParty = !!party
  const isLeader = !!party && party.leaderId === currentPlayerId

  // Players in this room you could follow (online, not yourself, not already partied with you).
  const partyIds = new Set<string>(party ? [party.leaderId, ...party.members.map((m) => m.id)] : [])
  const followable = roomPlayers.filter(
    (p) =>
      p.id !== currentPlayerId &&
      p.presenceStatus !== 'disconnected' &&
      !partyIds.has(p.id)
  )

  if (!inParty && followable.length === 0) return null

  return (
    <div className="rounded-lg border border-blue-900/40 bg-blue-950/10 p-3 space-y-2">
      {inParty && party ? (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-blue-300">
              Party <span className="text-xs text-gray-500">({party.size}/{party.maxSize})</span>
            </h4>
            <button
              onClick={onLeave}
              className="text-xs text-red-400/80 hover:text-red-300 underline underline-offset-2"
            >
              {isLeader ? 'Disband' : 'Leave'}
            </button>
          </div>

          <div className="space-y-1">
            {/* Leader */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-400" title="Party leader">★</span>
              <span className="text-gray-200 font-medium">{party.leader.username}</span>
              <span className="text-xs text-gray-500">Lv {party.leader.level}</span>
              <span className="text-[10px] text-gray-600">leader</span>
            </div>

            {/* Members */}
            {party.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm pl-5">
                <span className="text-gray-300">{m.username}</span>
                <span className="text-xs text-gray-500">Lv {m.level}</span>
                {isLeader && (
                  <button
                    onClick={() => onRemove(m.id)}
                    className="ml-auto text-[10px] text-red-400/70 hover:text-red-300 underline underline-offset-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h4 className="text-sm font-bold text-blue-300">Travel Together</h4>
          <div className="space-y-1">
            {followable.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-300">{p.username}</span>
                <span className="text-xs text-gray-500">Lv {p.level}</span>
                <button
                  onClick={() => onFollow(p.id)}
                  className="ml-auto text-[11px] px-2 py-0.5 rounded border border-blue-700/40 text-blue-300/90 hover:bg-blue-900/30 hover:text-blue-200 transition-colors"
                >
                  Follow
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
