'use client'

import { useMemo } from 'react'
import type { Player } from '@/lib/game-state'
import type { PartySnapshot } from '@/lib/socket'
import { buildOutsiders, buildSquad, groupBonusPercent, type SquadMember } from '@/lib/party/squad'
import { usePresenceStore } from '@/store/presenceStore'
import { usePartyBattleStore } from '@/store/partyBattleStore'
import { MemberCard, MemberRow, type MemberAction } from '../party/MemberCard'

type InspectTarget = Pick<Player, 'id' | 'username' | 'level' | 'uIcon' | 'uIconColor'>

interface PartyPanelProps {
  party: PartySnapshot | null
  roomPlayers: Player[]
  currentPlayerId: string
  currentPlayer?: Player
  /** People we have asked to lead us and not yet heard back from. */
  pendingFollowIds?: Set<string>
  onFollow: (targetId: string) => void
  onLeave: () => void
  onRemove: (memberId: string) => void
  onInspect?: (targetPlayer: InspectTarget) => void
  onMessage?: (targetPlayer: Pick<Player, 'id' | 'username'>) => void
}

/**
 * The party in full, under Players ▸ Party.
 *
 * The same `SquadMember` the rail draws as a chip is drawn here as a card, so
 * the two cannot disagree about what a teammate is doing. Below the party,
 * the people standing here that you could follow, as rows — the room's own
 * "Others here" is where following usually starts; this is the long-form view.
 */
export default function PartyPanel({
  party,
  roomPlayers,
  currentPlayerId,
  currentPlayer,
  pendingFollowIds,
  onFollow,
  onLeave,
  onRemove,
  onInspect,
  onMessage,
}: PartyPanelProps) {
  const presenceById = usePresenceStore((s) => s.byUserId)
  const glanceById = usePartyBattleStore((s) => s.byUserId)
  const isLeader = !!party && party.leaderId === currentPlayerId

  const members = useMemo(
    () =>
      buildSquad({
        party,
        roomPlayers,
        presenceById,
        currentPlayerId,
        self: currentPlayer ?? null,
        glanceById,
      }),
    [party, roomPlayers, presenceById, currentPlayerId, currentPlayer, glanceById]
  )
  const outsiders = useMemo(
    () => buildOutsiders({ party, roomPlayers, presenceById, currentPlayerId }),
    [party, roomPlayers, presenceById, currentPlayerId]
  )
  const groupBonus = useMemo(
    () => groupBonusPercent(roomPlayers, party, currentPlayerId),
    [roomPlayers, party, currentPlayerId]
  )

  const memberActions = (member: SquadMember): MemberAction[] => {
    const actions: MemberAction[] = []
    if (!member.isSelf && onMessage) {
      actions.push({ label: 'Message', variant: 'primary', onClick: () => onMessage({ id: member.id, username: member.username }) })
    }
    if (onInspect) {
      actions.push({
        label: 'View',
        onClick: () =>
          onInspect({
            id: member.id,
            username: member.username,
            level: member.level,
            uIcon: member.uIcon ?? undefined,
            uIconColor: member.uIconColor ?? undefined,
          }),
      })
    }
    if (isLeader && !member.isSelf && !member.isLeader) {
      actions.push({ label: 'Remove', variant: 'danger', onClick: () => onRemove(member.id) })
    }
    return actions
  }

  const outsiderActions = (member: SquadMember): MemberAction[] => {
    const pending = pendingFollowIds?.has(member.id) ?? false
    return [
      {
        label: pending ? 'Asked…' : 'Follow',
        variant: 'primary',
        disabled: pending,
        title: pending ? `Waiting for ${member.username} to answer` : `Ask ${member.username} to lead you`,
        onClick: () => onFollow(member.id),
      },
    ]
  }

  if (!party && outsiders.length === 0) return null

  return (
    <div className="space-y-4">
      {party && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-resource-mp">
              {party.name ?? 'Party'}{' '}
              <span className="text-[10px] font-normal text-fg-muted">
                {party.size}/{party.maxSize}
              </span>
              {groupBonus > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold text-status-success" title="Attack and defence bonus while you fight together here">
                  +{groupBonus}%
                </span>
              )}
              {party.closed && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-status-warning">Closed</span>}
            </h4>
            <button
              type="button"
              onClick={onLeave}
              className="text-[10px] text-status-error/80 underline underline-offset-2 hover:text-status-error"
            >
              {isLeader ? 'Disband' : 'Leave'}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((member) => (
              <MemberCard key={member.id} member={member} actions={memberActions(member)} />
            ))}
          </div>
        </section>
      )}

      {outsiders.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-xs font-bold text-resource-mp">Also here</h4>
          <p className="text-[10px] text-fg-muted">
            {party ? 'Following someone else switches you to their party.' : 'Follow someone to travel together. They have to agree to lead you.'}
          </p>
          <div className="divide-y divide-line-subtle/40">
            {outsiders.map((member) => (
              <MemberRow key={member.id} member={member} actions={outsiderActions(member)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
