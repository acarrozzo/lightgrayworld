'use client'

import { Crown, Swords } from 'lucide-react'
import type { SquadMember, SquadState } from '@/lib/party/squad'
import { PlayerAvatar, formatTimeAgo } from '@/components/player/PlayerRow'

/**
 * One party member, drawn the same way everywhere the party is shown.
 *
 * Three sizes of the same object, all reading one `SquadMember`:
 *
 * - `MemberCard`: identity, vitals with numbers, and a "now" line that says the
 *   one thing you would act on. In a fight the line becomes a miniature of the
 *   battle panel — enemy, enemy HP, the last exchange, the turn.
 * - `MemberRow`: one line per person, for lists.
 * - `StateRing` / `HairBar`: the pieces the rail's chips are built from.
 *
 * Colour is by state, never by role: the state ladder in squad.ts decides
 * what the worst true thing about a person is, and every size draws that.
 */

/** Ring colour by state, on the avatar. Offline and ready wear none. */
export const RING_TONE: Record<SquadState, string> = {
  down: 'ring-status-error',
  fighting: 'ring-status-error',
  hurt: 'ring-status-warning',
  idle: 'ring-status-warning/50',
  offline: 'ring-transparent',
  safe: 'ring-status-success',
  ready: 'ring-transparent',
}

/** Text colour for the state word. */
export const LABEL_TONE: Record<SquadState, string> = {
  down: 'text-status-error',
  fighting: 'text-status-error',
  hurt: 'text-status-warning',
  idle: 'text-status-warning/80',
  offline: 'text-fg-muted',
  safe: 'text-status-success',
  ready: 'text-fg-muted',
}

/** HP fill by state: red when it is the thing that is wrong, green when nothing is. */
const HP_FILL: Record<SquadState, string> = {
  down: 'bg-status-error',
  fighting: 'bg-status-error',
  hurt: 'bg-status-error',
  idle: 'bg-resource-hp',
  offline: 'bg-surface-selected',
  safe: 'bg-status-success',
  ready: 'bg-resource-hp',
}

export function HairBar({
  pct,
  fill,
  height = 'h-[3px]',
}: {
  pct: number | null
  fill: string
  height?: string
}) {
  return (
    <span className={`block w-full overflow-hidden rounded-full bg-surface-raised/80 ${height}`}>
      <span className={`block h-full rounded-full ${fill}`} style={{ width: `${pct ?? 0}%` }} />
    </span>
  )
}

/** The avatar in a ring the colour of the member's state. */
export function StateRing({
  member,
  size = 'sm',
  pulse = false,
  className = '',
}: {
  member: SquadMember
  size?: 'sm' | 'md'
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md ring-2 ring-offset-2 ring-offset-surface-panel ${
        RING_TONE[member.state]
      } ${member.state === 'down' ? 'grayscale' : ''} ${pulse ? 'animate-pulse' : ''} ${className}`}
    >
      <PlayerAvatar uIcon={member.uIcon} uIconColor={member.uIconColor} size={size} />
    </span>
  )
}

/** HP over MP, always; a fight adds the enemy's HP as a thinner third line. */
export function VitalHairs({ member, height }: { member: SquadMember; height?: string }) {
  const fighting = member.state === 'fighting' && member.battle?.enemyHpPct != null
  return (
    <span className="flex w-full flex-col gap-[2px]">
      <HairBar pct={member.hpPct} fill={HP_FILL[member.state]} height={height} />
      <HairBar pct={member.mpPct} fill="bg-resource-mp" height={height} />
      {fighting && <HairBar pct={member.battle!.enemyHpPct} fill="bg-enemy-hostile" height="h-[2px]" />}
    </span>
  )
}

function idleAgo(member: SquadMember): string {
  return member.lastSeen ? formatTimeAgo(member.lastSeen) : ''
}

/**
 * The one line under the vitals: what this person is doing, said so the viewer
 * knows whether to do anything about it.
 */
export function NowLine({ member }: { member: SquadMember }) {
  const tone = LABEL_TONE[member.state]
  switch (member.state) {
    case 'fighting': {
      const enemy = member.battleEnemyName ?? member.battle?.enemyName ?? 'something'
      const glance = member.battle
      return (
        <div className={`flex flex-col gap-1 ${tone}`}>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1 text-fg-secondary">
              <Swords size={11} aria-hidden="true" className="shrink-0 text-status-error" />
              <span className="truncate">{enemy}</span>
            </span>
            {glance?.enemyHpPct != null && (
              <span className="shrink-0 tabular-nums text-status-error">
                {glance.enemyHp != null && glance.enemyHpMax != null
                  ? `${glance.enemyHp}/${glance.enemyHpMax}`
                  : `${glance.enemyHpPct}%`}
              </span>
            )}
          </div>
          {glance?.enemyHpPct != null ? (
            <>
              <HairBar pct={glance.enemyHpPct} fill="bg-enemy-hostile" height="h-[4px]" />
              <div className="flex gap-3 text-[10px] tabular-nums text-fg-muted">
                {glance.lastHit != null && (
                  <span>
                    hit <b className="font-semibold text-combat-damage">{glance.lastHit}</b>
                  </span>
                )}
                {glance.lastTook != null && (
                  <span>
                    took <b className="font-semibold text-status-warning">{glance.lastTook}</b>
                  </span>
                )}
                {glance.turn != null && (
                  <span>
                    turn <b className="font-semibold text-fg-secondary">{glance.turn}</b>
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-[10px] text-fg-muted">The party cannot travel until this fight ends.</span>
          )}
        </div>
      )
    }
    case 'hurt':
      return <div className={`text-[11px] ${tone}`}>Badly hurt · needs rest before the next room</div>
    case 'down':
      return <div className={`text-[11px] ${tone}`}>Fallen · waking in the Plane of Rebirth</div>
    case 'idle':
      return <div className={`text-[11px] ${tone}`}>Idle{idleAgo(member) ? ` ${idleAgo(member)}` : ''}</div>
    case 'offline':
      return <div className={`text-[11px] ${tone}`}>Offline{idleAgo(member) ? ` ${idleAgo(member)}` : ''}</div>
    case 'safe':
      return <div className={`text-[11px] ${tone}`}>Safe here at level {member.level}</div>
    default:
      if (!member.inParty) {
        return (
          <div className="text-[11px] text-fg-muted">
            {member.leadsOwnParty ? 'Leads a party · following asks to join it' : 'Not with you · following asks them to lead'}
          </div>
        )
      }
      return <div className={`text-[11px] ${tone}`}>Ready</div>
  }
}

export interface MemberAction {
  label: string
  onClick: () => void
  variant?: 'plain' | 'primary' | 'danger'
  disabled?: boolean
  title?: string
}

const ACTION_TONE: Record<NonNullable<MemberAction['variant']>, string> = {
  plain: 'border-line-strong text-fg-secondary hover:bg-surface-hover hover:text-fg-bright',
  primary: 'border-resource-mp/50 text-resource-mp hover:bg-resource-mp/20',
  danger: 'border-status-error/40 text-status-error hover:bg-status-error/15',
}

export function MemberActions({ actions }: { actions: MemberAction[] }) {
  if (!actions.length) return null
  return (
    <div className="flex gap-1.5">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.title}
          className={`flex-1 rounded-md border py-1.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-40 ${
            ACTION_TONE[action.variant ?? 'plain']
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

function Badges({ member }: { member: SquadMember }) {
  return (
    <>
      {member.isLeader && (
        <span className="inline-flex items-center text-status-warning" title="Party leader" aria-label="Party leader">
          <Crown size={10} aria-hidden="true" />
        </span>
      )}
      {member.isSelf && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-resource-mp">You</span>
      )}
      {!member.inParty && member.leadsOwnParty && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-fg-muted">Leads a party</span>
      )}
    </>
  )
}

/** The card. Identity, vitals with numbers, the now line, then whatever the surface lets you do. */
export function MemberCard({
  member,
  actions = [],
  className = '',
}: {
  member: SquadMember
  actions?: MemberAction[]
  className?: string
}) {
  const hasVitals = typeof member.hp === 'number'
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-2.5 ${
        member.inParty ? 'border-line-subtle/70' : 'border-dashed border-line-subtle/70'
      } bg-surface-raised/20 ${member.isSelf ? 'ring-1 ring-inset ring-resource-mp/40' : ''} ${
        member.state === 'offline' ? 'opacity-60' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <StateRing member={member} size="md" className="ml-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-fg-bright">{member.username}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-fg-muted">Lv {member.level}</span>
            <Badges member={member} />
          </div>
        </div>
      </div>

      {hasVitals ? (
        <div className="grid grid-cols-[18px_1fr_44px] items-center gap-x-1.5 gap-y-1 text-[10px] text-fg-muted">
          <span>HP</span>
          <HairBar pct={member.hpPct} fill={HP_FILL[member.state]} height="h-[5px]" />
          <span className="text-right tabular-nums text-fg-secondary">
            {member.hp}/{member.hpMax}
          </span>
          <span>MP</span>
          <HairBar pct={member.mpPct} fill="bg-resource-mp" height="h-[3px]" />
          <span className="text-right tabular-nums text-fg-secondary">
            {member.mp}/{member.mpMax}
          </span>
        </div>
      ) : (
        <div className="text-[10px] italic text-fg-disabled">stats unavailable</div>
      )}

      <div className="border-t border-line-subtle/60 pt-2">
        <NowLine member={member} />
      </div>

      <MemberActions actions={actions} />
    </div>
  )
}

/** One line per person: ring, name, level, the two bars, and the state in a few words. */
export function MemberRow({
  member,
  actions = [],
  onOpen,
}: {
  member: SquadMember
  actions?: MemberAction[]
  /** Tapping the row itself opens the member; the actions are separate controls. */
  onOpen?: () => void
}) {
  const inner = (
    <>
      <StateRing member={member} className="ml-0.5" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate text-xs ${member.isSelf || member.isLeader ? 'font-medium text-fg-bright' : 'text-fg-primary'}`}>
            {member.username}
          </span>
          <span className="text-[10px] tabular-nums text-fg-muted">Lv {member.level}</span>
          <Badges member={member} />
        </span>
        <VitalHairs member={member} />
      </span>
      <span className={`shrink-0 text-right text-[10px] tabular-nums ${LABEL_TONE[member.state]}`}>
        {member.statusLabel}
      </span>
    </>
  )
  return (
    <div className={`flex items-center gap-2 py-1.5 ${member.state === 'offline' ? 'opacity-60' : ''}`}>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-surface-hover/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          aria-label={`${member.username}, level ${member.level}, ${member.statusLabel}`}
        >
          {inner}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5">{inner}</div>
      )}
      {actions.length > 0 && (
        <div className="flex shrink-0 items-center gap-1">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title}
              className={`rounded border px-1.5 py-0.5 text-[10px] leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                ACTION_TONE[action.variant ?? 'plain']
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
