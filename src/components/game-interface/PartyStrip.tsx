'use client'

import type { Player } from '@/lib/game-state'
import type { PartySnapshot } from '@/lib/socket'
import { PlayerAvatar } from '@/components/player/PlayerRow'

/**
 * Condensed party state for the explore sidebar.
 *
 * Full party management lives in the Players tab now, but two things have to stay
 * next to the room: knowing at a glance who you're travelling with, and being able
 * to follow someone standing right here. Following is co-location-based, so hiding
 * it behind a tab switch would mean leaving the view that tells you co-location
 * exists. Everything else defers to "Manage".
 */

interface PartyStripProps {
  party: PartySnapshot | null
  roomPlayers: Player[]
  currentPlayerId: string
  onFollow: (targetId: string) => void
  onLeave: () => void
  onManage: () => void
}

export default function PartyStrip({
  party,
  roomPlayers,
  currentPlayerId,
  onFollow,
  onLeave,
  onManage,
}: PartyStripProps) {
  const isLeader = !!party && party.leaderId === currentPlayerId
  const partyIds = new Set<string>(party ? [party.leaderId, ...party.members.map((m) => m.id)] : [])

  // Same rule as the full panel: online, not you, not already partied with you, and
  // — since you can only follow a leader — not somebody else's rank-and-file member.
  const followable = roomPlayers.filter(
    (p) =>
      p.id !== currentPlayerId &&
      p.presenceStatus !== 'disconnected' &&
      !partyIds.has(p.id) &&
      !(p.partyLeaderId && p.partyLeaderId !== p.id)
  )

  if (!party && followable.length === 0) return null

  return (
    <div className="rounded-lg border border-resource-mp/40 bg-resource-mp/10 p-2.5 space-y-2">
      {party && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-resource-mp">
              Party <span className="text-[10px] text-fg-muted">({party.size}/{party.maxSize})</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={onManage}
                className="text-[10px] text-fg-secondary underline underline-offset-2 hover:text-fg-bright"
              >
                Manage
              </button>
              <button
                onClick={onLeave}
                className="text-[10px] text-status-error/80 underline underline-offset-2 hover:text-status-error"
              >
                {isLeader ? 'Disband' : 'Leave'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {[party.leader, ...party.members].map((member) => (
              <div key={member.id} className="flex items-center gap-1">
                <PlayerAvatar uIcon={member.uIcon} uIconColor={member.uIconColor} />
                <span
                  className={`text-[11px] ${
                    member.id === party.leaderId ? 'font-medium text-fg-bright' : 'text-fg-secondary'
                  }`}
                >
                  {member.username}
                  {member.id === currentPlayerId ? ' (you)' : ''}
                </span>
                {member.id === party.leaderId && (
                  <span className="text-[8px] font-bold uppercase tracking-wide text-status-warning/80">lead</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {followable.length > 0 && (
        <div className={party ? 'border-t border-resource-mp/30 pt-2' : ''}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-resource-mp/60">
              Also here
            </span>
            {!party && (
              <button
                onClick={onManage}
                className="text-[10px] text-fg-secondary underline underline-offset-2 hover:text-fg-bright"
              >
                Manage
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {followable.map((p) => (
              <button
                key={p.id}
                onClick={() => onFollow(p.id)}
                title={`Follow ${p.username}`}
                className="flex items-center gap-1 rounded border border-resource-mp/40 px-1.5 py-0.5 text-[10px] text-resource-mp/90 transition-colors hover:bg-resource-mp/30 hover:text-resource-mp"
              >
                <span className="max-w-[90px] truncate">{p.username}</span>
                <span className="text-resource-mp/60">follow</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
