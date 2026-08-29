'use client'

import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'

/**
 * The one player-row vocabulary, shared by the party list, the global roster, and
 * the room's "Others here" chips.
 *
 * These three surfaces previously each had their own card and each knew a different
 * subset of the truth — only the room chip understood idle/disconnected, only the
 * party row understood inBattle and partyLeaderId, and the old global list understood
 * neither. Anything presence-, battle-, or party-related belongs here so the three
 * cannot disagree again.
 */

export type PlayerPresenceStatus = 'active' | 'idle' | 'disconnected'

/** Live numbers for a player. Every field is optional: ghosts and roster rows for
 *  offline players legitimately have no current vitals. */
export interface PlayerRowStats {
  hp?: number
  hpMax?: number
  mp?: number
  mpMax?: number
  str?: number | null
  dex?: number | null
  mag?: number | null
  def?: number | null
  strMod?: number | null
  dexMod?: number | null
  magMod?: number | null
  defMod?: number | null
  presenceStatus?: PlayerPresenceStatus
  inBattle?: boolean
  partyLeaderId?: string | null
}

export interface PlayerRowData {
  id: string
  username: string
  level: number
  uIcon?: string | null
  uIconColor?: string | null
  /** Live stats; absent when the player isn't in a snapshot we have. */
  stats?: PlayerRowStats
  /** 'leader'/'member' = in the viewer's party, 'here' = co-located, 'roster' = anywhere. */
  role?: 'leader' | 'member' | 'here' | 'roster'
  /** Marks the leader of a foreign party shown among co-located players. */
  isLeader?: boolean
  /** Marks the viewing player's own row. */
  isSelf?: boolean
  /** Location, shown by the roster. */
  roomId?: string | null
  roomName?: string | null
  /** Epoch ms; shown for idle and offline rows. */
  lastSeen?: number | null
}

export interface PlayerRowAction {
  label: string
  onClick: () => void
  variant?: 'plain' | 'follow' | 'danger'
  /** Tooltip; also carries the reason when disabled. */
  title?: string
  disabled?: boolean
}

export function pct(cur?: number, max?: number): number {
  if (!max || max <= 0 || typeof cur !== 'number') return 0
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)))
}

/** Effective stat = base allocation + equipment modifier (matches combat's baseStr). */
export function effective(base?: number | null, mod?: number | null): number | undefined {
  if (base == null && mod == null) return undefined
  return (base ?? 0) + (mod ?? 0)
}

export function formatTimeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Presence styling vocabulary. Kept in one place because "what does idle look like"
 * is exactly the thing that drifted between the room chip and the global list.
 */
export const PRESENCE_META: Record<
  PlayerPresenceStatus,
  { label: string; dot: string; text: string }
> = {
  active: { label: 'Online', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  idle: { label: 'Idle', dot: 'bg-amber-500', text: 'text-amber-400' },
  disconnected: { label: 'Offline', dot: 'bg-slate-500', text: 'text-slate-400' },
}

export function PlayerAvatar({
  uIcon,
  uIconColor,
  size = 'sm',
}: {
  uIcon?: string | null
  uIconColor?: string | null
  size?: 'sm' | 'md'
}) {
  const coloredAvatar = useColoredAvatar(uIcon || DEFAULT_PLAYER_AVATAR, uIconColor || DEFAULT_AVATAR_COLOR)
  const box = size === 'md' ? 'h-12 w-8' : 'h-7 w-5'
  return (
    <div className={`relative flex ${box} items-center justify-center shrink-0`}>
      {coloredAvatar ? (
        <div className={box} dangerouslySetInnerHTML={{ __html: coloredAvatar }} />
      ) : (
        <span className="text-[10px] text-violet-200/70">…</span>
      )}
    </div>
  )
}

export function MiniBars({ stats }: { stats?: PlayerRowStats }) {
  if (!stats || typeof stats.hp !== 'number') {
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

export function CoreStats({ stats }: { stats?: PlayerRowStats }) {
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

export function ActionButton({ label, onClick, variant = 'plain', title, disabled }: PlayerRowAction) {
  const base = 'text-[10px] leading-none transition-colors'
  const styles = disabled
    ? 'px-1.5 py-0.5 rounded border border-gray-700/40 text-gray-600 cursor-not-allowed'
    : variant === 'follow'
      ? 'px-1.5 py-0.5 rounded border border-blue-700/40 text-blue-300/90 hover:bg-blue-900/30 hover:text-blue-200'
      : variant === 'danger'
        ? 'text-red-400/70 hover:text-red-300'
        : 'text-gray-400/80 hover:text-gray-200'
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} className={`${base} ${styles}`}>
      {label}
    </button>
  )
}

/** You / Leader / In Battle / idle tags shown after the username. */
export function PlayerBadges({ row }: { row: PlayerRowData }) {
  const presence = row.stats?.presenceStatus
  return (
    <>
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
      {presence === 'idle' && <span className="text-[9px] text-yellow-600/80">idle</span>}
    </>
  )
}

/**
 * One player, one row. `actions` is supplied by the surface rendering it — the row
 * itself has no opinion about what you may do to a player, which is what keeps it
 * usable from both the party list and the global roster.
 */
export default function PlayerRow({
  row,
  actions = [],
  showStats = true,
  showLocation = false,
}: {
  row: PlayerRowData
  actions?: PlayerRowAction[]
  showStats?: boolean
  /** Roster rows show where the player is; party rows are co-located by definition. */
  showLocation?: boolean
}) {
  const presence = row.stats?.presenceStatus ?? 'active'
  // Disconnected players read as faded; idle players keep full opacity (tag only).
  const dimmed = presence === 'disconnected'
  const highlightName = row.role === 'leader' || row.isLeader || row.isSelf

  return (
    <div className={`flex items-center gap-2 px-1.5 py-1 ${dimmed ? 'opacity-50' : ''}`}>
      <PlayerAvatar uIcon={row.uIcon} uIconColor={row.uIconColor} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`truncate text-xs ${highlightName ? 'text-gray-200 font-medium' : 'text-gray-300'}`}>
            {row.username}
          </span>
          <span className="text-[10px] text-gray-500">Lv{row.level}</span>
          <PlayerBadges row={row} />
        </div>

        {showLocation && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[9px]">
            <span className={`h-1.5 w-1.5 rounded-full ${PRESENCE_META[presence].dot}`} />
            <span className="truncate text-gray-500">
              {row.roomName || row.roomId || 'Unknown'}
              {row.roomId && row.roomName ? <span className="text-gray-600"> · {row.roomId}</span> : null}
            </span>
            {presence === 'disconnected' && row.lastSeen ? (
              <span className="text-gray-600">{formatTimeAgo(row.lastSeen)}</span>
            ) : null}
          </div>
        )}

        {showStats && (
          <>
            <MiniBars stats={row.stats} />
            <CoreStats stats={row.stats} />
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {actions.map((action) => (
          <ActionButton key={action.label} {...action} />
        ))}
      </div>
    </div>
  )
}
