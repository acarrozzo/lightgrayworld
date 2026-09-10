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
 * - `MemberAvatar` / `StateBadge` / `HairBar`: the pieces the rail's chips are
 *   built from.
 *
 * State is carried by a word, not by a ring. The avatars are portrait sprites
 * authored at 100×150 and drawn at 20×28, and an outline around one of those is
 * both easy to miss and, for two of the seven states, not drawn at all — ready
 * and offline were told apart by opacity alone. A badge names the state in the
 * state's own colour, and every member carries one, so it sits in the same
 * place on every chip.
 */

/** Badge colours by state. Same vocabulary as the shared player row's tags. */
export const BADGE_TONE: Record<SquadState, string> = {
  down: 'border-status-error/60 bg-status-error/25 text-status-error',
  fighting: 'border-status-error/60 bg-status-error/25 text-status-error',
  hurt: 'border-status-warning/60 bg-status-warning/20 text-status-warning',
  idle: 'border-status-warning/35 bg-status-warning/10 text-status-warning/80',
  offline: 'border-line-subtle/60 bg-surface-raised/40 text-fg-muted',
  safe: 'border-status-success/50 bg-status-success/15 text-status-success',
  ready: 'border-line-subtle/60 bg-surface-raised/40 text-fg-muted',
}

/** Text colour for the state where it is written without a badge around it. */
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

/**
 * The enemy's health, wherever it is drawn beside somebody's own.
 *
 * Deliberately not `enemy-hostile`: in the default theme that role resolves to
 * the same hex as `resource-hp`, so a teammate's enemy and a teammate's health
 * drew an identical bar. The boss red is the one enemy tone that differs.
 */
export const ENEMY_FILL = 'bg-enemy-boss'

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

/** The member's sprite. No ring, at any size — the badge says the state. */
export function MemberAvatar({
  member,
  size = 'sm',
  className = '',
}: {
  member: SquadMember
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${
        member.state === 'down' ? 'grayscale' : ''
      } ${className}`}
    >
      <PlayerAvatar uIcon={member.uIcon} uIconColor={member.uIconColor} size={size} />
    </span>
  )
}

/**
 * The state, in a word, in the state's colour.
 *
 * A fighting member's badge names what they are fighting and how much of it is
 * left, which is the one status worth more than a single word.
 */
export function StateBadge({
  member,
  className = '',
  showTitle = true,
}: {
  member: SquadMember
  className?: string
  /**
   * The badge truncates, so in a list its own tooltip is the only way to read a
   * long state. In the rail it is off: hovering there opens the peek card, and
   * a browser tooltip firing over the top of it is the thing the card replaced.
   */
  showTitle?: boolean
}) {
  return (
    <span
      title={showTitle ? member.statusLabel : undefined}
      className={`inline-block max-w-full truncate rounded-sm border px-1 py-px text-[8px] font-bold uppercase leading-[1.5] tracking-wide ${
        BADGE_TONE[member.state]
      } ${className}`}
    >
      {member.statusLabel}
    </span>
  )
}

/**
 * What a teammate is fighting, drawn the way the teammate is: a name with the
 * level after it, then a health bar with its numbers.
 *
 * This replaced a badge that read "Rock Scorpion 30%". An enemy is a character
 * with a name, a level and health, and squeezing it into a status pill made it
 * look like a property of the player rather than the thing they are up against.
 * The divider above it is doing real work: without it, two health bars in a
 * column invite the reading that the lower one is also the teammate's.
 */
export function EnemyMini({ member }: { member: SquadMember }) {
  const glance = member.battle
  const name = member.battleEnemyName ?? glance?.enemyName ?? 'Unknown'
  const hp = glance?.enemyHp
  const hpMax = glance?.enemyHpMax
  return (
    <span className="flex flex-col gap-[2px] border-t border-line-subtle/50 pt-[2px]">
      <span className="flex min-w-0 items-center gap-0.5 text-[9px] leading-none text-status-error">
        <Swords size={8} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{name}</span>
        {glance?.enemyLevel != null && (
          <span className="shrink-0 tabular-nums text-fg-muted">Lv{glance.enemyLevel}</span>
        )}
      </span>
      <span className="flex items-center gap-1">
        <HairBar pct={glance?.enemyHpPct ?? null} fill={ENEMY_FILL} height="h-[3px]" />
        <span className="shrink-0 text-[8px] leading-none tabular-nums text-fg-secondary">
          {typeof hp === 'number' && typeof hpMax === 'number' ? `${hp}/${hpMax}` : '—'}
        </span>
      </span>
    </span>
  )
}

/** HP over MP. What they are fighting is drawn by EnemyMini, not as a third bar. */
export function VitalHairs({ member, height }: { member: SquadMember; height?: string }) {
  return (
    <span className="flex w-full flex-col gap-[2px]">
      <HairBar pct={member.hpPct} fill={HP_FILL[member.state]} height={height} />
      <HairBar pct={member.mpPct} fill="bg-resource-mp" height={height} />
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
              {glance?.enemyLevel != null && (
                <span className="shrink-0 tabular-nums text-fg-muted">Lv {glance.enemyLevel}</span>
              )}
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
              <HairBar pct={glance.enemyHpPct} fill={ENEMY_FILL} height="h-[4px]" />
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

/** Crown for the leader, "You" for the viewer. Role only — state is the badge's job. */
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
  bare = false,
}: {
  member: SquadMember
  actions?: MemberAction[]
  className?: string
  /** Drop the card's own panel, for a surface that already draws one. */
  bare?: boolean
}) {
  const hasVitals = typeof member.hp === 'number'
  const shell = bare
    ? ''
    : `rounded-lg border p-2.5 bg-surface-raised/20 ${
        member.inParty ? 'border-line-subtle/70' : 'border-dashed border-line-subtle/70'
      } ${member.isSelf ? 'ring-1 ring-inset ring-resource-mp/40' : ''}`
  return (
    <div
      className={`flex flex-col gap-2 ${shell} ${member.state === 'offline' ? 'opacity-60' : ''} ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <MemberAvatar member={member} size="md" className="ml-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-fg-bright">{member.username}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-fg-muted">Lv {member.level}</span>
            <Badges member={member} />
          </div>
          <StateBadge member={member} className="mt-1" />
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

/** One line per person: sprite, name, level, the two bars, and the state as a badge. */
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
      <MemberAvatar member={member} className="ml-0.5" />
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
      <StateBadge member={member} className="max-w-[92px] shrink-0" />
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
