'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Hourglass, UserPlus, Users, Lock, LockOpen, X } from 'lucide-react'
import type { Player } from '@/lib/game-state'
import type { PartySnapshot } from '@/lib/socket'
import {
  buildOutsiders,
  buildSquad,
  groupBonusPercent,
  type RoomDanger,
  type SquadMember,
  type SquadState,
} from '@/lib/party/squad'
import { MAX_PARTY_NAME } from '@/lib/party/party-limits'
import { usePresenceStore } from '@/store/presenceStore'
import { useLowHpAlerts } from '@/hooks/useLowHpAlerts'
import PlayerRow, { PlayerAvatar, type PlayerRowAction } from '@/components/player/PlayerRow'

/**
 * The party, as a band across the top of the room.
 *
 * The strip this replaces listed names and nothing else, so the one surface a
 * travelling party could always see told them nothing about each other. The
 * band's job is to answer "who is still standing" without being read: the whole
 * tile takes the colour of the worst true thing about that person, and says the
 * same thing in words underneath. No corner glyphs — a coloured dot is a legend
 * the player has to learn before it tells them anything.
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
  /** The room everyone is standing in, read against each member's own level. */
  roomDanger?: RoomDanger | null
  currentPlayerId: string
  /** The viewer's own live player; beats every feed for their own row. */
  self?: Player | null
  /** A teammate has just dropped into trouble — worth one line in the feed. */
  onLowHp?: (member: SquadMember) => void
  /** People we have asked to lead us and not yet heard back from. */
  pendingFollowIds?: Set<string>
  onFollow: (targetId: string) => void
  onLeave: () => void
  onRemove: (memberId: string) => void
  onSetClosed: (closed: boolean) => void
  onSetName: (name: string) => void
  onManage: () => void
  onMessage?: (target: { id: string; username: string }) => void
  onInspect?: (target: { id: string; username: string; level: number; uIcon?: string; uIconColor?: string }) => void
}

/** HP fill by state — the same reading the pip and the border give. */
const HP_FILL: Record<SquadState, string> = {
  down: 'bg-status-error',
  fighting: 'bg-status-error',
  hurt: 'bg-status-error',
  idle: 'bg-resource-hp',
  offline: 'bg-surface-selected',
  safe: 'bg-status-success',
  ready: 'bg-resource-hp',
}

/**
 * The whole tile carries the reading, not just the pip.
 *
 * Red means a fight is happening to this person — the viewer's own tile
 * included, because "am I in a fight" is the first thing the bar is asked.
 * Green means nothing in this room can hurt them at their level.
 */
const TILE_TONE: Record<SquadState, string> = {
  down: 'border-status-error/70 bg-status-error/20',
  fighting: 'border-status-error/70 bg-status-error/20',
  hurt: 'border-status-warning/60 bg-status-warning/10',
  idle: 'border-status-warning/35 bg-surface-raised/25',
  offline: 'border-line-subtle/60 bg-surface-raised/15 opacity-50',
  safe: 'border-status-success/50 bg-status-success/10',
  ready: 'border-line-subtle/70 bg-surface-raised/25',
}

const LABEL_TONE: Record<SquadState, string> = {
  down: 'text-status-error',
  fighting: 'text-status-error',
  hurt: 'text-status-warning',
  idle: 'text-status-warning/80',
  offline: 'text-fg-muted',
  safe: 'text-status-success',
  ready: 'text-fg-muted',
}

/**
 * HP over MP, the same stacked pair the header and every player row use.
 *
 * HP is the thicker of the two and takes its colour from the member's state, so
 * a tile in trouble reads red from across the bar; MP stays a hairline underneath
 * because it is context, not the thing you are scanning for.
 */
function VitalBars({ member }: { member: SquadMember }) {
  return (
    <span className="flex w-full flex-col gap-[2px]">
      <span className="h-[4px] w-full overflow-hidden rounded-full bg-surface-raised/80">
        <span
          className={`block h-full rounded-full ${HP_FILL[member.state]}`}
          style={{ width: `${member.hpPct ?? 0}%` }}
        />
      </span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-surface-raised/80">
        <span
          className="block h-full rounded-full bg-resource-mp"
          style={{ width: `${member.mpPct ?? 0}%` }}
        />
      </span>
    </span>
  )
}

function MemberTile({
  member,
  alert,
  pending,
  onOpen,
  onFollow,
}: {
  member: SquadMember
  alert: boolean
  pending?: boolean
  onOpen: () => void
  /** Present only for someone outside the party: the one-tap way to ask to join. */
  onFollow?: () => void
}) {
  const outsider = !member.inParty
  return (
    <div className="flex w-[104px] shrink-0 flex-col">
      <button
        type="button"
        onClick={onOpen}
        title={`${member.username} — level ${member.level}, ${member.statusLabel}`}
        aria-label={`${member.username}, level ${member.level}, ${member.statusLabel}${
          member.isLeader ? ', party leader' : ''
        }${outsider ? ', not in your party' : ''}`}
        className={`flex w-full flex-1 flex-col items-center gap-1 rounded-lg border px-2 pb-1.5 pt-2 transition-all duration-200 hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-[0.98] ${
          TILE_TONE[member.state]
        } ${outsider ? 'border-dashed' : ''} ${
          member.isSelf ? 'ring-1 ring-inset ring-resource-mp/50' : ''
        } ${alert ? 'animate-pulse' : ''}`}
      >
        <PlayerAvatar uIcon={member.uIcon} uIconColor={member.uIconColor} />

        <VitalBars member={member} />

        <span className={`max-w-full truncate text-[10px] ${member.isSelf ? 'text-fg-bright' : 'text-fg-secondary'}`}>
          {member.isSelf ? 'You' : member.username}
        </span>

        {/* Level and role in words. Everything the tile says is readable text —
            a coloured dot in a corner is a legend the player has to learn. */}
        <span className="flex max-w-full items-center gap-1">
          <span className="text-[9px] tabular-nums text-fg-muted">Lv {member.level}</span>
          {member.isLeader && (
            <span className="text-[8px] font-bold uppercase tracking-wide text-status-warning">Lead</span>
          )}
        </span>

        <span className={`max-w-full truncate text-[8.5px] uppercase tracking-wide tabular-nums ${LABEL_TONE[member.state]}`}>
          {member.statusLabel}
        </span>
      </button>

      {/* A separate control, not nested in the tile's own button: the tile tells
          you who they are, this asks them to take you along. */}
      {onFollow && (
        <button
          type="button"
          onClick={onFollow}
          disabled={pending}
          title={
            pending
              ? `Waiting for ${member.username} to answer`
              : `Ask ${member.username} to lead you`
          }
          aria-label={
            pending
              ? `Waiting for ${member.username} to answer your request to follow them`
              : `Ask ${member.username} to lead you`
          }
          className={`mt-1 flex w-full items-center justify-center gap-1 rounded-md border py-1 text-[9px] font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
            pending
              ? 'cursor-not-allowed border-line-subtle/50 text-fg-muted'
              : 'border-resource-mp/45 text-resource-mp/90 hover:bg-resource-mp/20 hover:text-resource-mp'
          }`}
        >
          {pending ? <Hourglass size={10} aria-hidden="true" /> : <UserPlus size={10} aria-hidden="true" />}
          {pending ? 'Pending' : 'Follow'}
        </button>
      )}
    </div>
  )
}

/**
 * The scrim-and-panel both party dialogs share.
 *
 * The party controls used to hang off the pill as an absolutely-positioned
 * popover, which the bar's own horizontal scroll container clipped — the menu
 * was there, and unreachable. A dialog escapes the container entirely, and it
 * is the same object the member sheet already opens, so tapping anything in the
 * bar behaves the same way.
 */
function SheetShell({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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
        aria-label={label}
      >
        {children}
      </div>
    </div>
  )
}

function SheetHeader({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line-subtle/60 px-3 py-2">
      <h2 className="min-w-0 truncate text-sm font-semibold text-fg-bright">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="ml-2 shrink-0 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-bright"
      >
        <X size={14} />
      </button>
    </div>
  )
}

/** The party's own controls, kept out of the tiles so the tiles stay about people. */
function PartyPill({
  party,
  groupBonus,
  isLeader,
  onLeave,
  onSetClosed,
  onSetName,
  onManage,
}: {
  party: PartySnapshot
  groupBonus: number
  isLeader: boolean
  onLeave: () => void
  onSetClosed: (closed: boolean) => void
  onSetName: (name: string) => void
  onManage: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(party.name ?? '')

  // Reopening starts from whatever the party is called now, not from a draft
  // abandoned two rooms ago.
  useEffect(() => {
    if (open) setDraftName(party.name ?? '')
  }, [open, party.name])

  const close = useCallback(() => setOpen(false), [])
  const trimmed = draftName.trim()
  const nameChanged = trimmed !== (party.name ?? '')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${party.name ?? 'Party'} options`}
        title={party.name ?? 'Party'}
        className="flex w-[104px] shrink-0 flex-col items-center justify-center gap-0.5 self-stretch rounded-lg border border-resource-mp/40 bg-resource-mp/10 px-2 py-2 transition-colors hover:bg-resource-mp/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <span className="flex max-w-full items-center gap-1">
          <Users size={11} className="shrink-0 text-resource-mp" aria-hidden="true" />
          {/* The party's name, or the word itself when it has none. */}
          <span className="truncate text-[10px] font-bold uppercase tracking-wide text-resource-mp">
            {party.name ?? 'Party'}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tabular-nums text-fg-secondary">
            {party.size}/{party.maxSize}
          </span>
          {/* The strongest mechanical reason to travel together, before the fight
              rather than only inside the battle panel. */}
          {groupBonus > 0 && (
            <span
              className="text-[9px] font-semibold tabular-nums text-status-success"
              title={`+${groupBonus}% attack and defence while you fight together`}
            >
              +{groupBonus}%
            </span>
          )}
        </span>
        {party.closed && (
          <span className="text-[8px] font-bold uppercase tracking-wide text-status-warning">Closed</span>
        )}
      </button>

      {open && (
        <SheetShell label="Party options" onClose={close}>
          <SheetHeader
            title={
              <>
                {party.name ?? 'Party'}{' '}
                <span className="text-xs font-normal text-fg-muted">
                  {party.size}/{party.maxSize}
                </span>
              </>
            }
            onClose={close}
          />

          {isLeader && (
            <form
              className="flex items-end gap-2 border-b border-line-subtle/60 px-3 py-2.5"
              onSubmit={(event) => {
                event.preventDefault()
                if (nameChanged) onSetName(trimmed)
                close()
              }}
            >
              <label className="min-w-0 flex-1 text-[10px] uppercase tracking-wide text-fg-muted">
                Party name
                <input
                  type="text"
                  value={draftName}
                  maxLength={MAX_PARTY_NAME}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="The Unwashed"
                  className="mt-1 w-full rounded border border-line-subtle/60 bg-surface-sunken px-2 py-1 text-xs text-fg-primary placeholder:text-fg-disabled focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-line-focus/40"
                />
              </label>
              <button
                type="submit"
                disabled={!nameChanged}
                className="shrink-0 rounded border border-line-subtle px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-bright disabled:cursor-not-allowed disabled:opacity-40"
              >
                {trimmed ? 'Name it' : 'Clear'}
              </button>
            </form>
          )}

          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                onManage()
                close()
              }}
              className="block w-full rounded px-2 py-2 text-left text-xs text-fg-secondary hover:bg-surface-hover hover:text-fg-bright"
            >
              Manage party
            </button>
            {isLeader && (
              <button
                type="button"
                onClick={() => {
                  onSetClosed(!party.closed)
                  close()
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-fg-secondary hover:bg-surface-hover hover:text-fg-bright"
              >
                {party.closed ? <LockOpen size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                {party.closed ? 'Open to new followers' : 'Close to new followers'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onLeave()
                close()
              }}
              className="block w-full rounded px-2 py-2 text-left text-xs text-status-error/80 hover:bg-status-error/15 hover:text-status-error"
            >
              {isLeader ? 'Disband party' : 'Leave party'}
            </button>
          </div>
        </SheetShell>
      )}
    </>
  )
}

/** Everything a tile does not have room for, on demand. */
function MemberSheet({
  member,
  isLeader,
  pending,
  onClose,
  onRemove,
  onFollow,
  onMessage,
  onInspect,
}: {
  member: SquadMember
  isLeader: boolean
  pending?: boolean
  onClose: () => void
  onRemove: (memberId: string) => void
  onFollow: (targetId: string) => void
  onMessage?: (target: { id: string; username: string }) => void
  onInspect?: (target: { id: string; username: string; level: number; uIcon?: string; uIconColor?: string }) => void
}) {
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
  if (!member.inParty) {
    actions.push({
      label: pending ? 'Pending' : 'Follow',
      variant: 'follow',
      disabled: pending,
      title: pending ? `Waiting for ${member.username} to answer` : undefined,
      onClick: () => {
        onFollow(member.id)
        onClose()
      },
    })
  }
  if (member.inParty && !member.isSelf && isLeader) {
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
    <SheetShell label={`${member.username} details`} onClose={onClose}>
      <SheetHeader
        title={
          <>
            {member.username}
            {member.isLeader && (
              <span className="ml-2 rounded-sm border border-status-warning/50 bg-status-warning/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-status-warning">
                Leader
              </span>
            )}
          </>
        }
        onClose={onClose}
      />

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
      {member.state === 'safe' && (
        <p className="border-t border-line-subtle/60 px-3 py-2 text-[11px] text-status-success">
          Nothing in this room is a threat at level {member.level}.
        </p>
      )}
      {!member.inParty && (
        <p className="border-t border-line-subtle/60 px-3 py-2 text-[11px] text-fg-muted">
          {pending
            ? `Waiting for ${member.username} to answer. Walking away withdraws the request.`
            : member.leadsOwnParty
              ? `${member.username} already leads a party. Following asks to join it.`
              : `${member.username} has to agree to lead you. Following asks them.`}
        </p>
      )}
    </SheetShell>
  )
}

export default function PartySquadBar({
  party,
  roomDanger,
  roomPlayers,
  currentPlayerId,
  self,
  onLowHp,
  pendingFollowIds,
  onFollow,
  onLeave,
  onRemove,
  onSetClosed,
  onSetName,
  onManage,
  onMessage,
  onInspect,
}: PartySquadBarProps) {
  const [openMemberId, setOpenMemberId] = useState<string | null>(null)
  const presenceById = usePresenceStore((s) => s.byUserId)
  const isLeader = !!party && party.leaderId === currentPlayerId

  const members = useMemo(
    () => buildSquad({ party, roomDanger, roomPlayers, presenceById, currentPlayerId, self }),
    [party, roomDanger, roomPlayers, presenceById, currentPlayerId, self]
  )
  // The people standing here who are not with you, described exactly as your
  // own party is — so "should I follow them" is answerable from the bar.
  const outsiders = useMemo(
    () => buildOutsiders({ party, roomDanger, roomPlayers, presenceById, currentPlayerId }),
    [party, roomDanger, roomPlayers, presenceById, currentPlayerId]
  )
  const groupBonus = useMemo(
    () => groupBonusPercent(roomPlayers, party, currentPlayerId),
    [roomPlayers, party, currentPlayerId]
  )

  const noop = useRef(() => {}).current
  const alertIds = useLowHpAlerts(members, onLowHp ?? noop)

  const openMember =
    members.find((m) => m.id === openMemberId) ?? outsiders.find((m) => m.id === openMemberId) ?? null

  // Nothing to say: no party, and nobody here to start one with. Checked after
  // the hooks, which must run on every render whatever the bar decides to draw.
  if (!party && outsiders.length === 0) return null

  return (
    <>
      <div
        className="mx-4 mt-4 flex items-stretch gap-1.5 overflow-x-auto rounded-lg border border-line-subtle/60 bg-surface-panel/70 px-2.5 py-2 lg:pr-14"
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
            onSetName={onSetName}
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
            travel with sit beside the people you are travelling with, drawn the
            same way, with a dashed edge for "not yours" and a follow button. */}
        {outsiders.map((member) => (
          <MemberTile
            key={member.id}
            member={member}
            alert={false}
            pending={pendingFollowIds?.has(member.id)}
            onOpen={() => setOpenMemberId(member.id)}
            onFollow={() => onFollow(member.id)}
          />
        ))}
      </div>

      {openMember && (
        <MemberSheet
          member={openMember}
          isLeader={isLeader}
          pending={pendingFollowIds?.has(openMember.id)}
          onClose={() => setOpenMemberId(null)}
          onRemove={onRemove}
          onFollow={onFollow}
          onMessage={onMessage}
          onInspect={onInspect}
        />
      )}
    </>
  )
}
