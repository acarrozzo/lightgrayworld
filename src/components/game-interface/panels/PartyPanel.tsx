'use client'

import { Player } from '@/lib/game-state'
import { PartySnapshot } from '@/lib/socket'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'

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

// Identity + role merged with live stats looked up from roomPlayers.
interface RowData {
  id: string
  username: string
  level: number
  uIcon?: string | null
  uIconColor?: string | null
  /** Live stats, present only when the person is in the current room snapshot. */
  stats?: Player
  role: 'leader' | 'member' | 'here'
  /** Marks the leader of a foreign party shown in the "Also here" section. */
  isLeader?: boolean
  /** Marks the viewing player's own row. */
  isSelf?: boolean
}

function pct(cur: number, max: number): number {
  if (!max || max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)))
}

function Avatar({ uIcon, uIconColor }: { uIcon?: string | null; uIconColor?: string | null }) {
  const coloredAvatar = useColoredAvatar(uIcon || DEFAULT_PLAYER_AVATAR, uIconColor || DEFAULT_AVATAR_COLOR)
  return (
    <div className="relative flex h-7 w-5 items-center justify-center shrink-0">
      {coloredAvatar ? (
        <div className="h-7 w-5" dangerouslySetInnerHTML={{ __html: coloredAvatar }} />
      ) : (
        <span className="text-[10px] text-violet-200/70">…</span>
      )}
    </div>
  )
}

function MiniBars({ stats }: { stats?: Player }) {
  if (!stats) {
    return <span className="text-[9px] text-gray-600 italic">stats unavailable</span>
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <div className="h-1 w-10 rounded-full bg-gray-800/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-600"
            style={{ width: `${pct(stats.hp, stats.hpMax)}%` }}
          />
        </div>
        <span className="text-[9px] text-gray-500 tabular-nums">
          {stats.hp}/{stats.hpMax}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-1 w-10 rounded-full bg-gray-800/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
            style={{ width: `${pct(stats.mp, stats.mpMax)}%` }}
          />
        </div>
        <span className="text-[9px] text-gray-500 tabular-nums">
          {stats.mp}/{stats.mpMax}
        </span>
      </div>
    </div>
  )
}

// Effective stat = base allocation + equipment modifier (matches combat's baseStr).
function effective(base?: number | null, mod?: number | null): number | undefined {
  if (base == null && mod == null) return undefined
  return (base ?? 0) + (mod ?? 0)
}

function CoreStats({ stats }: { stats?: Player }) {
  if (!stats) return null
  // The four core stats may be absent on stale/ghost snapshots; skip rendering then.
  // Value colors match the core-stat palette used in CharPanel.
  const entries: { label: string; value?: number; color: string }[] = [
    { label: 'STR', value: effective(stats.str, stats.strMod), color: 'text-red-400' },
    { label: 'DEX', value: effective(stats.dex, stats.dexMod), color: 'text-emerald-400' },
    { label: 'MAG', value: effective(stats.mag, stats.magMod), color: 'text-sky-400' },
    { label: 'DEF', value: effective(stats.def, stats.defMod), color: 'text-amber-400' },
  ]
  if (entries.every((e) => e.value == null)) return null
  return (
    <div className="mt-0.5 flex items-center gap-2">
      {entries.map((e) => (
        <span key={e.label} className="flex items-center gap-0.5 text-[9px] tabular-nums">
          <span className="text-gray-500 uppercase tracking-wide">{e.label}</span>
          <span className={e.color}>{e.value ?? '–'}</span>
        </span>
      ))}
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  variant = 'plain',
}: {
  label: string
  onClick: () => void
  variant?: 'plain' | 'follow' | 'danger'
}) {
  const base = 'text-[10px] leading-none transition-colors'
  const styles =
    variant === 'follow'
      ? 'px-1.5 py-0.5 rounded border border-blue-700/40 text-blue-300/90 hover:bg-blue-900/30 hover:text-blue-200'
      : variant === 'danger'
        ? 'text-red-400/70 hover:text-red-300'
        : 'text-gray-400/80 hover:text-gray-200'
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {label}
    </button>
  )
}

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
  // Disconnected players read as faded; idle players keep full opacity (tag only).
  const dimmed = row.stats?.presenceStatus === 'disconnected'
  const highlightName = row.role === 'leader' || row.isLeader || row.isSelf
  // A player who belongs to a party but doesn't lead it: you can only follow the
  // leader, so suppress the Follow button on non-leader members.
  const isPartyMemberNotLeader =
    !!row.stats?.partyLeaderId && row.stats.partyLeaderId !== row.id

  return (
    <div className={`flex items-center gap-2 px-1.5 py-1 ${dimmed ? 'opacity-50' : ''}`}>
      <Avatar uIcon={row.uIcon} uIconColor={row.uIconColor} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-xs ${highlightName ? 'text-gray-200 font-medium' : 'text-gray-300'}`}>
            {row.username}
          </span>
          <span className="text-[10px] text-gray-500">Lv{row.level}</span>
          {row.isSelf && (
            <span className="rounded-sm border border-blue-400/60 bg-blue-500/25 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-blue-200">
              You
            </span>
          )}
          {(row.role === 'leader' || row.isLeader) && (
            <span
              className="rounded-sm border border-yellow-400/50 bg-yellow-400/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-yellow-300"
              title="Party leader"
            >
              Leader
            </span>
          )}
          {row.stats?.inBattle && (
            <span
              className="rounded-sm border border-red-400/60 bg-red-500/25 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-red-200"
              title="Currently in battle"
            >
              In Battle
            </span>
          )}
          {row.stats?.presenceStatus === 'idle' && (
            <span className="text-[9px] text-yellow-600/80">idle</span>
          )}
        </div>
        <MiniBars stats={row.stats} />
        <CoreStats stats={row.stats} />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onInspect && (
          <ActionButton
            label="View"
            onClick={() =>
              onInspect({
                id: row.id,
                username: row.username,
                level: row.level,
                uIcon: row.uIcon ?? undefined,
                uIconColor: row.uIconColor ?? undefined,
              })
            }
          />
        )}
        {!row.isSelf && onMessage && (
          <ActionButton
            label="Msg"
            onClick={() => onMessage({ id: row.id, username: row.username })}
          />
        )}
        {!row.isSelf && row.role === 'here' && onFollow && !isPartyMemberNotLeader && (
          <ActionButton label="Follow" variant="follow" onClick={() => onFollow(row.id)} />
        )}
        {row.role === 'member' && onRemove && (
          <ActionButton label="Remove" variant="danger" onClick={() => onRemove(row.id)} />
        )}
      </div>
    </div>
  )
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
