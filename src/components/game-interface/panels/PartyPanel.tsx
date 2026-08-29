'use client'

import { Player } from '@/lib/game-state'
import { PartySnapshot } from '@/lib/socket'
import PlayerRow, { type PlayerRowAction, type PlayerRowData } from '@/components/player/PlayerRow'

type InspectTarget = Pick<Player, 'id' | 'username' | 'level' | 'uIcon' | 'uIconColor'>

interface PartyPanelProps {
  party: PartySnapshot | null
  roomPlayers: Player[]
  currentPlayerId: string
  currentPlayer?: Player
  onFollow: (targetId: string) => void
  onLeave: () => void
  onRemove: (memberId: string) => void
  onInspect?: (targetPlayer: InspectTarget) => void
  onMessage?: (targetPlayer: Pick<Player, 'id' | 'username'>) => void
}

// Identity + role merged with live stats looked up from roomPlayers. The row shape
// itself lives in components/player/PlayerRow so the roster renders players the same way.
type RowData = PlayerRowData & { role: 'leader' | 'member' | 'here' }

// Builds this surface's action set and hands it to the shared row. Party rows can
// remove members and follow co-located players; the roster offers a different set.
function PlayerStatRow({
  row,
  onFollow,
  onRemove,
  onInspect,
  onMessage,
}: {
  row: RowData
  onFollow?: (id: string) => void
  onRemove?: (id: string) => void
  onInspect?: (targetPlayer: InspectTarget) => void
  onMessage?: (targetPlayer: Pick<Player, 'id' | 'username'>) => void
}) {
  // A player who belongs to a party but doesn't lead it: you can only follow the
  // leader, so suppress the Follow button on non-leader members.
  const isPartyMemberNotLeader =
    !!row.stats?.partyLeaderId && row.stats.partyLeaderId !== row.id

  const actions: PlayerRowAction[] = []
  if (onInspect) {
    actions.push({
      label: 'View',
      onClick: () =>
        onInspect({
          id: row.id,
          username: row.username,
          level: row.level,
          uIcon: row.uIcon ?? undefined,
          uIconColor: row.uIconColor ?? undefined,
        }),
    })
  }
  if (!row.isSelf && onMessage) {
    actions.push({ label: 'Msg', onClick: () => onMessage({ id: row.id, username: row.username }) })
  }
  if (!row.isSelf && row.role === 'here' && onFollow && !isPartyMemberNotLeader) {
    actions.push({ label: 'Follow', variant: 'follow', onClick: () => onFollow(row.id) })
  }
  if (row.role === 'member' && onRemove) {
    actions.push({ label: 'Remove', variant: 'danger', onClick: () => onRemove(row.id) })
  }

  return <PlayerRow row={row} actions={actions} />
}

export default function PartyPanel({
  party,
  roomPlayers,
  currentPlayerId,
  currentPlayer,
  onFollow,
  onLeave,
  onRemove,
  onInspect,
  onMessage,
}: PartyPanelProps) {
  const inParty = !!party
  const isLeader = !!party && party.leaderId === currentPlayerId

  // O(1) lookup of live stats (hp/mp, presence, avatar) for anyone in this room.
  const statsById = new Map<string, Player>(roomPlayers.map((p) => [p.id, p]))

  // Build party rows (leader first), merging identity/role with live room stats.
  const partyRows: RowData[] = []
  if (party) {
    partyRows.push({
      id: party.leader.id,
      username: party.leader.username,
      level: party.leader.level,
      uIcon: party.leader.uIcon,
      uIconColor: party.leader.uIconColor,
      stats: statsById.get(party.leader.id),
      role: 'leader',
      isSelf: party.leader.id === currentPlayerId,
    })
    for (const m of party.members) {
      partyRows.push({
        id: m.id,
        username: m.username,
        level: m.level,
        uIcon: m.uIcon,
        uIconColor: m.uIconColor,
        stats: statsById.get(m.id),
        role: 'member',
        isSelf: m.id === currentPlayerId,
      })
    }
  }

  // Players in this room you could follow (online, not yourself, not already partied).
  const partyIds = new Set<string>(party ? [party.leaderId, ...party.members.map((m) => m.id)] : [])
  const hereRows: RowData[] = roomPlayers
    .filter(
      (p) =>
        p.id !== currentPlayerId &&
        p.presenceStatus !== 'disconnected' &&
        !partyIds.has(p.id)
    )
    .map((p) => ({
      id: p.id,
      username: p.username,
      level: p.level,
      uIcon: p.uIcon,
      uIconColor: p.uIconColor,
      stats: p,
      role: 'here' as const,
    }))

  // Group co-located non-party players by the foreign party they belong to. A foreign
  // party only renders as a group when 2+ of its members are actually here together;
  // anyone else (solo, or a lone party member whose group isn't co-located) is flat.
  const byLeader = new Map<string, RowData[]>()
  for (const row of hereRows) {
    const leaderId = row.stats?.partyLeaderId
    const key = leaderId ? `party:${leaderId}` : `solo:${row.id}`
    if (!byLeader.has(key)) byLeader.set(key, [])
    byLeader.get(key)!.push(row)
  }
  const foreignParties: { leaderId: string; rows: RowData[] }[] = []
  const soloRows: RowData[] = []
  for (const [key, rows] of byLeader) {
    if (key.startsWith('party:') && rows.length >= 2) {
      const leaderId = key.slice('party:'.length)
      // Always render the leader first within a foreign party group.
      const ordered = [...rows].sort((a, b) =>
        a.id === leaderId ? -1 : b.id === leaderId ? 1 : 0
      )
      foreignParties.push({ leaderId, rows: ordered })
    } else {
      soloRows.push(...rows)
    }
  }

  if (!inParty && hereRows.length === 0) return null

  // Always show yourself when the list is present. In a party you already appear in the
  // party box; otherwise prepend your own row to the flat list.
  if (!inParty) {
    const selfStats = currentPlayer ?? statsById.get(currentPlayerId)
    if (selfStats) {
      soloRows.unshift({
        id: selfStats.id,
        username: selfStats.username,
        level: selfStats.level,
        uIcon: selfStats.uIcon,
        uIconColor: selfStats.uIconColor,
        stats: selfStats,
        role: 'here',
        isSelf: true,
      })
    }
  }

  return (
    <div className="rounded-lg border border-blue-900/40 bg-blue-950/10 p-3 space-y-2">
      {inParty && party && (
        <div className="rounded-md border border-blue-500/50 bg-blue-900/15 p-2 space-y-1.5 shadow-[0_0_0_1px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-300">
              Party <span className="text-[10px] text-gray-500">({party.size}/{party.maxSize})</span>
            </h4>
            <button
              onClick={onLeave}
              className="text-[10px] text-red-400/80 hover:text-red-300 underline underline-offset-2"
            >
              {isLeader ? 'Disband' : 'Leave'}
            </button>
          </div>

          <div className="divide-y divide-blue-900/20">
            {partyRows.map((row) => (
              <PlayerStatRow
                key={row.id}
                row={row}
                onRemove={isLeader ? onRemove : undefined}
                onInspect={onInspect}
                onMessage={onMessage}
              />
            ))}
          </div>
        </div>
      )}

      {hereRows.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-blue-300">Also here</h4>

          {/* Other parties sharing this room, each in its own subtle container. */}
          {foreignParties.map((grp) => (
            <div
              key={grp.leaderId}
              className="rounded-md border border-blue-800/30 bg-blue-900/10 p-2 space-y-1"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-300/60">
                Party
              </div>
              <div className="divide-y divide-blue-900/20">
                {grp.rows.map((row) => (
                  <PlayerStatRow
                    key={row.id}
                    row={{ ...row, isLeader: row.id === grp.leaderId }}
                    onFollow={onFollow}
                    onInspect={onInspect}
                    onMessage={onMessage}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Unpartied players (and lone members). */}
          {soloRows.length > 0 && (
            <div className="divide-y divide-gray-800/40">
              {soloRows.map((row) => (
                <PlayerStatRow
                  key={row.id}
                  row={row}
                  onFollow={onFollow}
                  onInspect={onInspect}
                  onMessage={onMessage}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
