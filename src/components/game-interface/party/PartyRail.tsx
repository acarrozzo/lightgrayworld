'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Lock, LockOpen, MessageSquare, Users, X } from 'lucide-react'
import type { Player } from '@/lib/game-state'
import type { PartyFollowRequestPayload, PartySnapshot } from '@/lib/socket'
import { buildSquad, groupBonusPercent, type RoomDanger, type SquadMember } from '@/lib/party/squad'
import { MAX_PARTY_NAME } from '@/lib/party/party-limits'
import { usePresenceStore } from '@/store/presenceStore'
import { usePartyBattleStore } from '@/store/partyBattleStore'
import { useWorldFeedStore, type WorldFeedEntry } from '@/store/worldFeedStore'
import { useLowHpAlerts } from '@/hooks/useLowHpAlerts'
import { HairBar, MemberCard, StateRing, type MemberAction } from './MemberCard'

/**
 * The party, as a rail under the header.
 *
 * Forty pixels, always on screen, any party size: every member is a chip —
 * avatar in a ring the colour of the worst true thing about them, name with
 * the level after it, HP over MP, and a third enemy-coloured hairline while
 * they fight. The viewer is drawn the same as everyone else, so the rail reads
 * as one row of one object. The leader wears a small crown; no edge or border
 * means anything. The rail ends in the party's chat, with a count of what has
 * been said since they last looked. Detail is one tap away in a sheet.
 *
 * What is deliberately *not* here: the people standing in the room who are not
 * in the party. They belong to the room, and the room's "Others here" draws
 * them, with Follow. A rail that mixed the two asked the player to tell a
 * dashed border from a solid one to know who they were travelling with.
 *
 * Presence, the party's fight glances and the feed are subscribed to here
 * rather than in the page above, on purpose: they change on every action any
 * player takes anywhere, and this component is the only thing that redraws.
 */

interface PartyRailProps {
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
  /** People asking to follow the viewer, oldest first. */
  followRequests?: PartyFollowRequestPayload[]
  onAnswerFollow?: (requesterId: string, accept: boolean) => void
  onLeave: () => void
  onRemove: (memberId: string) => void
  onSetClosed: (closed: boolean) => void
  onSetName: (name: string) => void
  onManage: () => void
  onSendChat?: (message: string) => boolean
  onMessage?: (target: { id: string; username: string }) => void
  onInspect?: (target: { id: string; username: string; level: number; uIcon?: string; uIconColor?: string }) => void
}

/* ───────────────────────── sheet ───────────────────────── */

/**
 * The one dialog every tap in the rail opens. A bottom sheet on a phone — the
 * thumb is already at the bottom, and the rail stays visible above the scrim —
 * and a centred dialog on a wide screen.
 */
function Sheet({
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim lg:items-center lg:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-xl border border-line-subtle bg-surface-panel shadow-2xl shadow-shadow lg:rounded-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-surface-selected lg:hidden" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}

function SheetHeader({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-line-subtle/60 px-3 py-2">
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

/* ───────────────────────── party options ───────────────────────── */

function PartyOptionsSheet({
  party,
  groupBonus,
  isLeader,
  onClose,
  onLeave,
  onSetClosed,
  onSetName,
  onManage,
}: {
  party: PartySnapshot
  groupBonus: number
  isLeader: boolean
  onClose: () => void
  onLeave: () => void
  onSetClosed: (closed: boolean) => void
  onSetName: (name: string) => void
  onManage: () => void
}) {
  const [draftName, setDraftName] = useState(party.name ?? '')
  const trimmed = draftName.trim()
  const nameChanged = trimmed !== (party.name ?? '')

  return (
    <Sheet label="Party options" onClose={onClose}>
      <SheetHeader
        title={
          <>
            {party.name ?? 'Party'}{' '}
            <span className="text-xs font-normal text-fg-muted">
              {party.size}/{party.maxSize}
            </span>
          </>
        }
        onClose={onClose}
      />

      {groupBonus > 0 && (
        <p className="border-b border-line-subtle/60 px-3 py-2 text-[11px] text-status-success">
          +{groupBonus}% attack and defence while you fight together here.
        </p>
      )}

      {isLeader && (
        <form
          className="flex items-end gap-2 border-b border-line-subtle/60 px-3 py-2.5"
          onSubmit={(event) => {
            event.preventDefault()
            if (nameChanged) onSetName(trimmed)
            onClose()
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
            onClose()
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
              onClose()
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
            onClose()
          }}
          className="block w-full rounded px-2 py-2 text-left text-xs text-status-error/80 hover:bg-status-error/15 hover:text-status-error"
        >
          {isLeader ? 'Disband party' : 'Leave party'}
        </button>
      </div>
    </Sheet>
  )
}

/* ───────────────────────── member sheet ───────────────────────── */

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
  onMessage?: PartyRailProps['onMessage']
  onInspect?: PartyRailProps['onInspect']
}) {
  const actions: MemberAction[] = []
  if (!member.isSelf && onMessage) {
    actions.push({
      label: 'Message',
      variant: 'primary',
      onClick: () => {
        onMessage({ id: member.id, username: member.username })
        onClose()
      },
    })
  }
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
  if (isLeader && !member.isSelf && !member.isLeader) {
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
    <Sheet label={`${member.username}, party member`} onClose={onClose}>
      <SheetHeader title={member.isSelf ? 'You' : member.username} onClose={onClose} />
      <div className="p-2">
        <MemberCard member={member} actions={actions} className="border-transparent bg-transparent" />
      </div>
    </Sheet>
  )
}

/* ───────────────────────── chat ───────────────────────── */

/** Chat lines are the party entries a person typed; notices are the rest. */
const isPartyChat = (entry: WorldFeedEntry) => entry.type === 'party' && entry.eventType === 'party-chat'

function ChatLine({ entry }: { entry: WorldFeedEntry }) {
  if (isPartyChat(entry)) {
    const sep = entry.message.indexOf(': ')
    const text = sep >= 0 ? entry.message.slice(sep + 2) : entry.message
    return (
      <div className="flex gap-1.5 text-xs">
        <span className={`shrink-0 font-semibold ${entry.isSelf ? 'text-resource-mp' : 'text-channel-dm'}`}>
          {entry.isSelf ? 'You' : entry.actor}
        </span>
        <span className="min-w-0 break-words text-fg-primary">{text}</span>
      </div>
    )
  }
  return (
    <div className={`text-[11px] italic ${entry.level === 'error' ? 'text-status-error' : 'text-fg-muted'}`}>
      {entry.message}
    </div>
  )
}

function ChatSheet({
  party,
  hereCount,
  entries,
  onSend,
  onClose,
}: {
  party: PartySnapshot
  hereCount: number
  entries: WorldFeedEntry[]
  onSend?: (message: string) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message || !onSend) return
    if (onSend(message)) setDraft('')
  }

  return (
    <Sheet label="Party chat" onClose={onClose}>
      <SheetHeader
        title={
          <>
            <span className="text-channel-dm">Party chat</span>{' '}
            <span className="text-xs font-normal text-fg-muted">
              {party.name ?? 'Party'} · {hereCount} here
            </span>
          </>
        }
        onClose={onClose}
      />
      <div ref={listRef} className="flex min-h-[160px] flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2">
        {entries.length === 0 ? (
          <p className="my-auto text-center text-[11px] text-fg-muted">Nothing said yet. Only your party reads this.</p>
        ) : (
          entries.map((entry) => <ChatLine key={entry.id} entry={entry} />)
        )}
      </div>
      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-line-subtle/60 p-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tell the party…"
          aria-label="Party chat message"
          className="min-w-0 flex-1 rounded-md border border-line-subtle/60 bg-surface-sunken px-2.5 py-1.5 text-xs text-fg-primary placeholder:text-fg-disabled focus:border-channel-dm/60 focus:outline-none focus:ring-1 focus:ring-line-focus/40"
        />
        <button
          type="submit"
          disabled={!draft.trim() || !onSend}
          className="shrink-0 rounded-md bg-channel-dm px-3 py-1.5 text-xs font-semibold text-fg-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </Sheet>
  )
}

/* ───────────────────────── follow asks ───────────────────────── */

function useSecondsLeft(expiresAt: number): number {
  const compute = () => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  const [left, setLeft] = useState(compute)
  useEffect(() => {
    setLeft(compute())
    const timer = setInterval(() => setLeft(compute()), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt])
  return left
}

const ASK_TTL_S = 60

/**
 * Somebody wants to follow the viewer. It used to be a modal in the middle of
 * the screen; a leader mid-fight does not need the fight covered. The ask
 * sits under the rail with its minute draining, and the fight goes on.
 */
function FollowAsk({
  request,
  onAnswer,
}: {
  request: PartyFollowRequestPayload
  onAnswer: (requesterId: string, accept: boolean) => void
}) {
  const left = useSecondsLeft(request.expiresAt)
  const r = 8
  const c = 2 * Math.PI * r
  const fraction = Math.min(1, left / ASK_TTL_S)
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border border-resource-mp/45 bg-resource-mp/10 px-2.5 py-2"
      role="status"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0 -rotate-90">
        <circle cx="11" cy="11" r={r} fill="none" className="stroke-surface-raised" strokeWidth="3" />
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          className="stroke-resource-mp transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
        />
      </svg>
      <div className="min-w-0 flex-1 text-[11px] leading-tight">
        <div className="text-fg-bright">
          <b className="font-semibold">{request.requesterName}</b>{' '}
          <span className="text-fg-muted">Lv {request.requesterLevel}</span> wants to follow you
        </div>
        <div className="text-[10px] text-fg-muted">
          {request.wouldBecomeLeader
            ? 'Say yes and you lead: they travel where you travel.'
            : 'They would join your party.'}{' '}
          {left}s left.
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAnswer(request.requesterId, true)}
        className="shrink-0 rounded-md border border-resource-mp/50 px-2.5 py-1.5 text-[11px] font-bold text-resource-mp transition-colors hover:bg-resource-mp/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        {request.wouldBecomeLeader ? 'Lead them' : 'Let them in'}
      </button>
      <button
        type="button"
        onClick={() => onAnswer(request.requesterId, false)}
        className="shrink-0 rounded-md px-1.5 py-1.5 text-[11px] text-fg-muted transition-colors hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        Not now
      </button>
    </div>
  )
}

/* ───────────────────────── chips ───────────────────────── */

/** HP fill by state, the same reading the ring gives. */
const CHIP_HP_FILL: Record<SquadMember['state'], string> = {
  down: 'bg-status-error',
  fighting: 'bg-status-error',
  hurt: 'bg-status-error',
  idle: 'bg-resource-hp',
  offline: 'bg-surface-selected',
  safe: 'bg-status-success',
  ready: 'bg-resource-hp',
}

/**
 * One member. Name with the level after it, then HP over MP for everyone — the
 * viewer included, so the rail reads as one row of the same object. The leader
 * wears a small crown after their name; nothing about the chip's edge means
 * anything. A fight adds a third, enemy-coloured hairline underneath.
 */
function Chip({ member, pulse, onOpen }: { member: SquadMember; pulse: boolean; onOpen: () => void }) {
  const vitals =
    typeof member.hp === 'number' ? `${member.hp}/${member.hpMax} HP, ${member.mp}/${member.mpMax} MP` : 'no vitals'
  const label = `${member.isSelf ? 'You' : member.username}, level ${member.level}, ${vitals}, ${member.statusLabel}${
    member.isLeader ? ', party leader' : ''
  }`
  const nameTone =
    member.state === 'fighting' || member.state === 'hurt' || member.state === 'down'
      ? 'text-status-error'
      : member.isSelf
        ? 'text-fg-bright'
        : 'text-fg-secondary'
  const fighting = member.state === 'fighting' && member.battle?.enemyHpPct != null
  return (
    <button
      type="button"
      onClick={onOpen}
      title={label}
      aria-label={label}
      className={`flex shrink-0 items-center gap-1.5 rounded-md py-0.5 pl-1 pr-1.5 transition-colors hover:bg-surface-hover/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        member.state === 'offline' ? 'opacity-50' : ''
      }`}
    >
      <StateRing member={member} pulse={pulse} />
      <span className="flex w-14 flex-col gap-[3px]">
        <span className={`flex min-w-0 items-center gap-0.5 text-[10px] leading-none ${nameTone}`}>
          <span className="truncate">{member.isSelf ? 'You' : member.username}</span>
          {member.isLeader && (
            <Crown size={8} className="shrink-0 text-status-warning" aria-hidden="true" />
          )}
          <span className="shrink-0 tabular-nums text-fg-muted">Lv{member.level}</span>
        </span>
        <HairBar pct={member.hpPct} fill={CHIP_HP_FILL[member.state]} />
        <HairBar pct={member.mpPct} fill="bg-resource-mp" />
        {fighting && <HairBar pct={member.battle!.enemyHpPct} fill="bg-enemy-hostile" height="h-[2px]" />}
      </span>
    </button>
  )
}

/* ───────────────────────── the rail ───────────────────────── */

export default function PartyRail({
  party,
  roomDanger,
  roomPlayers,
  currentPlayerId,
  self,
  onLowHp,
  followRequests = [],
  onAnswerFollow,
  onLeave,
  onRemove,
  onSetClosed,
  onSetName,
  onManage,
  onSendChat,
  onMessage,
  onInspect,
}: PartyRailProps) {
  const [open, setOpen] = useState<null | { kind: 'member'; id: string } | { kind: 'party' } | { kind: 'chat' }>(null)
  const presenceById = usePresenceStore((s) => s.byUserId)
  const glanceById = usePartyBattleStore((s) => s.byUserId)
  const feedEntries = useWorldFeedStore((s) => s.entries)
  const isLeader = !!party && party.leaderId === currentPlayerId

  const members = useMemo(
    () => buildSquad({ party, roomDanger, roomPlayers, presenceById, currentPlayerId, self, glanceById }),
    [party, roomDanger, roomPlayers, presenceById, currentPlayerId, self, glanceById]
  )
  const groupBonus = useMemo(
    () => groupBonusPercent(roomPlayers, party, currentPlayerId),
    [roomPlayers, party, currentPlayerId]
  )
  const hereCount = useMemo(() => {
    const here = new Set(roomPlayers.map((p) => p.id))
    return members.filter((m) => here.has(m.id)).length
  }, [members, roomPlayers])

  const noop = useRef(() => {}).current
  const pulsing = useLowHpAlerts(members, onLowHp ?? noop)

  // The party channel: what the party said, and the lines about it. Only the
  // lines somebody else typed count as unread — a notice is not a message,
  // and your own words are not news.
  const partyEntries = useMemo(() => feedEntries.filter((e) => e.type === 'party').slice(-80), [feedEntries])
  const [lastReadTs, setLastReadTs] = useState(() => Date.now())
  const chatOpen = open?.kind === 'chat'
  useEffect(() => {
    if (chatOpen) setLastReadTs(Date.now())
  }, [chatOpen, partyEntries.length])
  const unread = useMemo(
    () => partyEntries.filter((e) => isPartyChat(e) && !e.isSelf && e.ts > lastReadTs).length,
    [partyEntries, lastReadTs]
  )

  const close = useCallback(() => setOpen(null), [])
  const openMember = open?.kind === 'member' ? members.find((m) => m.id === open.id) ?? null : null

  // Nothing to draw: no party and nobody asking. Checked after the hooks, which
  // must run on every render whatever the rail decides to show.
  if (!party && followRequests.length === 0) return null

  return (
    <>
      <div className="shrink-0 border-b border-line-subtle/60 bg-surface-panel/95 shadow-[0_6px_14px_-12px_var(--shadow)]">
        {party && (
          <div
            className="flex h-10 items-center gap-1 overflow-x-auto px-2 lg:pr-14 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Party"
          >
            <button
              type="button"
              onClick={() => setOpen({ kind: 'party' })}
              aria-haspopup="dialog"
              aria-label={`${party.name ?? 'Party'} options`}
              title={party.name ?? 'Party'}
              className="mr-1.5 flex h-8 shrink-0 flex-col justify-center gap-[3px] rounded-md px-1.5 text-left transition-colors hover:bg-surface-hover/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <span className="flex max-w-[92px] items-center gap-1">
                <Users size={10} className="shrink-0 text-resource-mp" aria-hidden="true" />
                <span className="truncate text-[9px] font-bold uppercase leading-none tracking-wide text-resource-mp">
                  {party.name ?? 'Party'}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[9px] leading-none tabular-nums text-fg-muted">
                {party.size}/{party.maxSize}
                {groupBonus > 0 && (
                  <span className="font-semibold text-status-success" title={`+${groupBonus}% attack and defence while you fight together`}>
                    +{groupBonus}%
                  </span>
                )}
                {party.closed && <Lock size={8} className="text-status-warning" aria-label="Closed to new followers" />}
              </span>
            </button>

            {members.map((member) => (
              <Chip
                key={member.id}
                member={member}
                pulse={pulsing.has(member.id)}
                onOpen={() => setOpen({ kind: 'member', id: member.id })}
              />
            ))}

            <button
              type="button"
              onClick={() => setOpen({ kind: 'chat' })}
              aria-haspopup="dialog"
              aria-label={unread > 0 ? `Party chat, ${unread} unread` : 'Party chat'}
              title="Party chat"
              className="relative ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-channel-dm/45 bg-channel-dm/10 text-channel-dm transition-colors hover:bg-channel-dm/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <MessageSquare size={13} aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-status-error px-1 text-[8px] font-bold text-fg-bright">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          </div>
        )}

        {followRequests.length > 0 && onAnswerFollow && (
          <div className="flex flex-col gap-1.5 px-2 pb-2 pt-1.5">
            {followRequests.map((request) => (
              <FollowAsk key={request.requesterId} request={request} onAnswer={onAnswerFollow} />
            ))}
          </div>
        )}
      </div>

      {openMember && (
        <MemberSheet
          member={openMember}
          isLeader={isLeader}
          onClose={close}
          onRemove={onRemove}
          onMessage={onMessage}
          onInspect={onInspect}
        />
      )}
      {open?.kind === 'party' && party && (
        <PartyOptionsSheet
          party={party}
          groupBonus={groupBonus}
          isLeader={isLeader}
          onClose={close}
          onLeave={onLeave}
          onSetClosed={onSetClosed}
          onSetName={onSetName}
          onManage={onManage}
        />
      )}
      {open?.kind === 'chat' && party && (
        <ChatSheet party={party} hereCount={hereCount} entries={partyEntries} onSend={onSendChat} onClose={close} />
      )}
    </>
  )
}
