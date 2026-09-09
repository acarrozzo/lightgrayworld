'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Swords, UserPlus, Users, Lock, LockOpen, X } from 'lucide-react'
import type { Player } from '@/lib/game-state'
import type { PartySnapshot } from '@/lib/socket'
import { buildSquad, followableHere, groupBonusPercent, type SquadMember, type SquadState } from '@/lib/party/squad'
import { usePresenceStore } from '@/store/presenceStore'
import { useLowHpAlerts } from '@/hooks/useLowHpAlerts'
import PlayerRow, { PlayerAvatar, type PlayerRowAction } from '@/components/player/PlayerRow'

/**
 * The party, as a band across the top of the room.
 *
 * The strip this replaces listed names and nothing else, so the one surface a
 * travelling party could always see told them nothing about each other. The
 * band's job is to answer "who is still standing" without being read: each
 * member wears their HP as a ring, their state as a corner pip, and the whole
 * tile turns when they are in trouble.
 *
 * It is deliberately a fixed height at any party size — six members cost what
 * two do, and it scrolls sideways rather than pushing the room down the page.
 * Detail is one tap away in the member sheet instead of always on screen.
 *
 * The live presence feed is subscribed to *here* rather than in the page above,
 * on purpose: presence deltas land on every action any player takes anywhere in
 * the world, and this component is the only thing that needs to redraw for them.
 */

interface PartySquadBarProps {
  party: PartySnapshot | null
  /** The room's occupants, self included — the co-location half of the merge. */
  roomPlayers: Player[]
  currentPlayerId: string
  /** The viewer's own live player; beats every feed for their own row. */
  self?: Player | null
  /** A teammate has just dropped into trouble — worth one line in the feed. */
  onLowHp?: (member: SquadMember) => void
  onFollow: (targetId: string) => void
  onLeave: () => void
  onRemove: (memberId: string) => void
  onSetClosed: (closed: boolean) => void
  onManage: () => void
  onMessage?: (target: { id: string; username: string }) => void
  onInspect?: (target: { id: string; username: string; level: number; uIcon?: string; uIconColor?: string }) => void
}

/** Ring colour by state — the same reading the pip and the border give. */
const RING_TOKEN: Record<SquadState, string> = {
  down: 'var(--status-error)',
  fighting: 'var(--resource-hp)',
  hurt: 'var(--status-error)',
  idle: 'var(--resource-hp)',
  offline: 'var(--surface-selected)',
  ready: 'var(--resource-hp)',
}

const TILE_TONE: Record<SquadState, string> = {
  down: 'border-status-error/70 bg-status-error/15',
  fighting: 'border-status-error/60 bg-status-error/10',
  hurt: 'border-status-warning/60 bg-status-warning/10',
  idle: 'border-status-warning/35 bg-surface-raised/25',
  offline: 'border-line-subtle/60 bg-surface-raised/15 opacity-50',
  ready: 'border-line-subtle/70 bg-surface-raised/25',
}

const LABEL_TONE: Record<SquadState, string> = {
  down: 'text-status-error',
  fighting: 'text-status-error',
  hurt: 'text-status-warning',
  idle: 'text-status-warning/80',
  offline: 'text-fg-muted',
  ready: 'text-fg-muted',
}

/** A ring that reads as a health bar bent into a circle. */
function VitalRing({ member }: { member: SquadMember }) {
  const filled = member.hpPct ?? 0
  const color = RING_TOKEN[member.state]
  return (
    <div className="relative h-9 w-9 grid place-items-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${filled}%, color-mix(in srgb, var(--surface-raised) 90%, transparent) 0)`,
          WebkitMaskImage: 'radial-gradient(circle, transparent 13px, #000 13.5px)',
          maskImage: 'radial-gradient(circle, transparent 13px, #000 13.5px)',
        }}
      />
      <PlayerAvatar uIcon={member.uIcon} uIconColor={member.uIconColor} />
    </div>
  )
}

function StatePip({ member }: { member: SquadMember }) {
  if (member.state === 'fighting') {
    return (
      <span
        className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-surface-canvas bg-status-error text-fg-bright"
        title={member.battleEnemyName ? `Fighting a ${member.battleEnemyName}` : 'In battle'}
      >
        <Swords size={9} aria-hidden="true" />
      </span>
    )
  }
  if (member.state === 'down') {
    return (
      <span
        className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-surface-canvas bg-status-error text-[9px] font-bold text-fg-bright"
        title="Fallen"
      >
        ✕
      </span>
    )
  }
  if (member.state === 'idle' || member.state === 'offline') {
    return (
      <span
        className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-surface-canvas bg-status-warning text-[9px] font-bold text-surface-canvas"
        title={member.state === 'idle' ? 'Idle' : 'Offline'}
      >
        z
      </span>
    )
  }
  if (member.isLeader) {
    return (
      <span
        className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-surface-canvas bg-accent text-[9px] font-bold text-fg-on-accent"
        title="Party leader"
      >
        ★
      </span>
    )
  }
  return null
}

function MemberTile({
  member,
  alert,
  onOpen,
}: {
  member: SquadMember
  alert: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${member.username} — ${member.statusLabel}`}
      aria-label={`${member.username}, level ${member.level}, ${member.statusLabel}${member.isLeader ? ', party leader' : ''}`}
      className={`relative flex w-[62px] shrink-0 flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 transition-all duration-200 hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-[0.97] ${
        member.isSelf ? 'border-resource-mp/55 bg-resource-mp/12' : TILE_TONE[member.state]
      } ${alert ? 'animate-pulse' : ''}`}
    >
      <span className="relative">
        <VitalRing member={member} />
        <StatePip member={member} />
      </span>

      {/* MP as a hairline: present when it matters, never competing with HP. */}
      <span className="h-[3px] w-8 overflow-hidden rounded-full bg-surface-raised/80">
        <span
          className="block h-full rounded-full bg-resource-mp"
          style={{ width: `${member.mpPct ?? 0}%` }}
        />
      </span>

      <span className={`max-w-full truncate text-[9.5px] ${member.isSelf ? 'text-fg-bright' : 'text-fg-secondary'}`}>
        {member.isSelf ? 'You' : member.username}
      </span>
      <span className={`max-w-full truncate text-[8px] uppercase tracking-wide tabular-nums ${LABEL_TONE[member.state]}`}>
        {member.statusLabel}
      </span>
    </button>
  )
}

function FollowTile({ player, onFollow }: { player: Player; onFollow: () => void }) {
  return (
    <button
      type="button"
      onClick={onFollow}
      title={`Follow ${player.username}`}
      aria-label={`Follow ${player.username}`}
      className="flex w-[62px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-resource-mp/45 px-1 py-2 text-resource-mp/90 transition-colors hover:border-resource-mp hover:bg-resource-mp/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <UserPlus size={14} aria-hidden="true" />
      <span className="max-w-full truncate text-[9.5px]">{player.username}</span>
      <span className="text-[8px] uppercase tracking-wide text-resource-mp/60">follow</span>
    </button>
  )
}

/** The party's own controls, kept out of the tiles so the tiles stay about people. */
function PartyPill({
  party,
  groupBonus,
  isLeader,
  onLeave,
  onSetClosed,
  onManage,
}: {
  party: PartySnapshot
  groupBonus: number
  isLeader: boolean
  onLeave: () => void
  onSetClosed: (closed: boolean) => void
  onManage: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Party options"
        className="flex h-full w-[58px] flex-col items-center justify-center gap-0.5 rounded-lg border border-resource-mp/40 bg-resource-mp/10 px-1 py-2 transition-colors hover:bg-resource-mp/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Users size={12} className="text-resource-mp" aria-hidden="true" />
        <span className="text-[9px] font-bold uppercase tracking-wide text-resource-mp">
          {party.size}/{party.maxSize}
        </span>
        {/* The strongest mechanical reason to travel together, before the fight
            rather than only inside the battle panel. */}
        {groupBonus > 0 && (
          <span className="text-[8px] font-semibold tabular-nums text-status-success" title={`+${groupBonus}% attack and defence while you fight together`}>
            +{groupBonus}%
          </span>
        )}
        {party.closed && <Lock size={9} className="text-status-warning" aria-label="Closed party" />}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-line-subtle bg-surface-overlay p-1.5 shadow-lg shadow-shadow/50">
          <button
            type="button"
            onClick={() => {
              onManage()
              setOpen(false)
            }}
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover hover:text-fg-bright"
          >
            Manage party
          </button>
          {isLeader && (
            <button
              type="button"
              onClick={() => {
                onSetClosed(!party.closed)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover hover:text-fg-bright"
            >
              {party.closed ? <LockOpen size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
              {party.closed ? 'Open to new followers' : 'Close to new followers'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onLeave()
              setOpen(false)
            }}
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-status-error/80 hover:bg-status-error/15 hover:text-status-error"
          >
            {isLeader ? 'Disband party' : 'Leave party'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Everything a tile does not have room for, on demand. */
function MemberSheet({
  member,
  isLeader,
  onClose,
  onRemove,
  onMessage,
  onInspect,
}: {
  member: SquadMember
  isLeader: boolean
  onClose: () => void
  onRemove: (memberId: string) => void
  onMessage?: (target: { id: string; username: string }) => void
  onInspect?: (target: { id: string; username: string; level: number; uIcon?: string; uIconColor?: string }) => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const actions: PlayerRowAction[] = []
  if (onInspect) {
    actions.push({
      label: 'View',
      onClick: () => {
        onInspect({
          id: member.id,
          username: member.username,
          level: member.level,
          uIcon: member.uIcon ?? undefined,
          uIconColor: member.uIconColor ?? undefined,
        })
        onClose()
      },
    })
  }
  if (!member.isSelf && onMessage) {
    actions.push({
      label: 'Msg',
      onClick: () => {
        onMessage({ id: member.id, username: member.username })
        onClose()
      },
    })
  }
  if (!member.isSelf && isLeader) {
    actions.push({
      label: 'Remove',
      variant: 'danger',
      onClick: () => {
        onRemove(member.id)
        onClose()
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-line-subtle bg-surface-panel shadow-2xl shadow-shadow"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${member.username} details`}
      >
        <div className="flex items-center justify-between border-b border-line-subtle/60 px-3 py-2">
          <h2 className="text-sm font-semibold text-fg-bright">
            {member.username}
            {member.isLeader && (
              <span className="ml-2 rounded-sm border border-status-warning/50 bg-status-warning/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-status-warning">
                Leader
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-bright"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-2 py-1.5">
          <PlayerRow
            row={{
              id: member.id,
              username: member.username,
              level: member.level,
              uIcon: member.uIcon,
              uIconColor: member.uIconColor,
              stats: member.stats,
              role: member.isLeader ? 'leader' : 'member',
              isSelf: member.isSelf,
            }}
            actions={actions}
          />
        </div>

        {member.state === 'fighting' && member.battleEnemyName && (
          <p className="border-t border-line-subtle/60 px-3 py-2 text-[11px] text-status-error">
            Fighting a {member.battleEnemyName}. The party cannot travel until this fight ends.
          </p>
        )}
        {member.state === 'hurt' && (
          <p className="border-t border-line-subtle/60 px-3 py-2 text-[11px] text-status-warning">
            Badly hurt — {member.hp}/{member.hpMax} HP.
          </p>
        )}
      </div>
    </div>
  )
}

export default function PartySquadBar({
  party,
  roomPlayers,
  currentPlayerId,
  self,
  onLowHp,
  onFollow,
  onLeave,
  onRemove,
  onSetClosed,
  onManage,
  onMessage,
  onInspect,
}: PartySquadBarProps) {
  const [openMemberId, setOpenMemberId] = useState<string | null>(null)
  const presenceById = usePresenceStore((s) => s.byUserId)
  const isLeader = !!party && party.leaderId === currentPlayerId

  const members = useMemo(
    () => buildSquad({ party, roomPlayers, presenceById, currentPlayerId, self }),
    [party, roomPlayers, presenceById, currentPlayerId, self]
  )
  const followable = useMemo(
    () => followableHere(roomPlayers, party, currentPlayerId),
    [roomPlayers, party, currentPlayerId]
  )
  const groupBonus = useMemo(
    () => groupBonusPercent(roomPlayers, party, currentPlayerId),
    [roomPlayers, party, currentPlayerId]
  )

  const noop = useRef(() => {}).current
  const alertIds = useLowHpAlerts(members, onLowHp ?? noop)

  const openMember = members.find((m) => m.id === openMemberId) ?? null

  // Nothing to say: no party, and nobody here to start one with. Checked after
  // the hooks, which must run on every render whatever the bar decides to draw.
  if (!party && followable.length === 0) return null

  return (
    <>
      <div
        className="flex items-stretch gap-1.5 overflow-x-auto border-b border-line-subtle/60 bg-surface-panel/70 px-2.5 py-2 lg:pr-14"
        role="group"
        aria-label="Party"
      >
        {party && (
          <PartyPill
            party={party}
            groupBonus={groupBonus}
            isLeader={isLeader}
            onLeave={onLeave}
            onSetClosed={onSetClosed}
            onManage={onManage}
          />
        )}

        {members.map((member) => (
          <MemberTile
            key={member.id}
            member={member}
            alert={Boolean(alertIds?.has(member.id))}
            onOpen={() => setOpenMemberId(member.id)}
          />
        ))}

        {/* Joining lives in the same object as belonging: the people you could
            travel with sit beside the people you are travelling with. */}
        {followable.map((p) => (
          <FollowTile key={p.id} player={p} onFollow={() => onFollow(p.id)} />
        ))}
      </div>

      {openMember && (
        <MemberSheet
          member={openMember}
          isLeader={isLeader}
          onClose={() => setOpenMemberId(null)}
          onRemove={onRemove}
          onMessage={onMessage}
          onInspect={onInspect}
        />
      )}
    </>
  )
}
