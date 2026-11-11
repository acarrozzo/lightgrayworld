'use client'

import { useMemo } from 'react'
import type { BossRestView, LairBossView } from '@/lib/types/room'
import { useCountdown } from './useCountdown'
import { formatCountdown, formatRestMinutes } from '@/lib/boss-rest-client'
import BossInfo, { Chevron, type BoardPlayer } from './BossInfo'

/** The dial's radius and circumference, for the ring that empties. */
const RING_R = 26
const RING_C = 2 * Math.PI * RING_R

interface LairBossBoxProps {
  boss: LairBossView
  /** Set while the boss is defeated for this player; null when it is simply not here yet. */
  bossRest: BossRestView | null
  onAction: (action: string | { type: string; data?: unknown }) => void | Promise<void>
  /** Boss Info (the leaderboard, the enemy's page) is unfolded inside this box. */
  boardOpen?: boolean
  /** Fold or unfold Boss Info inside this box. */
  onToggleBoard?: () => void
  /** Open a player's card from a name on the Leaderboard. */
  onOpenPlayer?: (player: BoardPlayer) => void
  /** The clock crossed zero on this page: the boss is back in the roll. */
  onEnded?: () => void
  disabled?: boolean
}

/**
 * The lair's boss box, drawn whenever the boss is not standing in the room
 * (5 Nov 2026: "the enemy box should show in the room all the time"). Two
 * states:
 *
 * - DEFEATED: the box dimmed and blue, a ring dial that empties like a clock
 *   (the gap starts at twelve and sweeps clockwise) with the time left in the
 *   middle, the enemy's icon all but gone, the Boss Chest button where
 *   Attack was, then Boss Info, and the temporary tester while the server
 *   says so.
 * - NOT HERE: the rest is over (or the boss has never been met here) and it
 *   has not rolled yet. The box is grey, and Attack is the hunt: in a lair the
 *   swing calls the boss out every time (5 Nov 2026), and costs a turn. Any
 *   other turn spent here is answered by a stir line (game-data/lair-lines.js)
 *   in the room's own line slot under this box, served by the server.
 *   Boss Info sits right of the box's main button in every state.
 *
 * While the boss stands, the room card's live enemy box takes over. In every
 * state Boss Info unfolds inside the box, under the stats.
 *
 * The deadline is taken from the server's seconds count at receipt, not from
 * `restingUntil` against this device's clock.
 */
export default function LairBossBox({ boss, bossRest, onAction, boardOpen = false, onToggleBoard, onOpenPlayer, onEnded, disabled = false }: LairBossBoxProps) {
  const deadline = useMemo(
    () => (bossRest ? Date.now() + bossRest.secondsRemaining * 1000 : null),
    // A fresh payload for the same rest keeps its deadline; a new rest (a new kill) resets it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bossRest?.slug, bossRest?.restingUntil]
  )
  const left = useCountdown(deadline, onEnded)
  const defeated = Boolean(bossRest) && left > 0
  const fraction = bossRest && bossRest.totalSeconds > 0 ? Math.min(1, Math.max(0, left / bossRest.totalSeconds)) : 0
  const chest = defeated ? bossRest!.chest : null
  const restMinutes = bossRest?.restMinutes ?? 0

  const info = onToggleBoard && <BossInfoButton name={boss.name} open={boardOpen} onToggle={onToggleBoard} disabled={disabled} />

  return (
    <div
      className={`inline-flex max-w-full flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
        defeated ? 'border-status-info/45 bg-status-info/10' : 'border-line-subtle/40 bg-surface-raised/20'
      }`}
      role="status"
      aria-label={defeated ? `${boss.name} defeated, returns in ${formatCountdown(left)}` : `${boss.name} is not here yet`}
    >
      <img
        src={`/icons/enemy/${encodeURIComponent(boss.name)}.svg`}
        alt=""
        className={`h-12 w-12 shrink-0 object-contain brightness-0 invert ${defeated ? 'opacity-[0.12]' : 'opacity-30'}`}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-fg-muted">{boss.name}</span>
          <span className="shrink-0 rounded border border-resource-gold/40 bg-resource-gold/15 px-1 text-[10px] font-bold text-resource-gold">
            {boss.rank === 'boss' ? 'BOSS' : 'MINI-BOSS'}
          </span>
          {defeated ? (
            <span className="shrink-0 rounded border border-status-info/50 bg-status-info/15 px-1 text-[10px] font-bold text-status-info">DEFEATED</span>
          ) : (
            <span className="shrink-0 rounded bg-surface-raised/60 px-1 text-[10px] text-fg-muted">not here</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-muted">
          <span className="text-sm font-bold text-fg-bright">Lv. {boss.level}</span>
          <span className="text-fg-disabled">·</span>
          <span>{boss.hp} HP</span>
          <span className="text-fg-disabled">·</span>
          <span>ATT <span className="font-semibold text-fg-primary">{boss.att}</span></span>
          <span>DEF <span className="font-semibold text-fg-primary">{boss.def}</span></span>
          {restMinutes > 0 && (
            <>
              <span className="text-fg-disabled">·</span>
              <span title="How long it stays down after you beat it">Cooldown {formatRestMinutes(restMinutes)}</span>
            </>
          )}
        </div>
        {!defeated && (
          <p className="mt-1 text-[11px] text-fg-muted">
            Not here right now. Attack to call it out{boss.isAggressive ? '' : '; it will not strike first'}.
          </p>
        )}
      </div>

      {defeated && (
        /* The dial: a ring that empties like a clock. The circle is mirrored
           and turned so its dash starts at twelve and runs counter-clockwise,
           which is what makes the remaining arc end at twelve as the gap
           sweeps clockwise from it. */
        <div className="relative grid h-[60px] w-[60px] shrink-0 place-items-center" title={`Returns in ${formatCountdown(left)}`}>
          <svg className="absolute inset-0" style={{ transform: 'rotate(90deg) scaleX(-1)' }} viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">
            <circle cx="30" cy="30" r={RING_R} fill="none" className="stroke-fg-bright/10" strokeWidth="4" />
            <circle
              cx="30"
              cy="30"
              r={RING_R}
              fill="none"
              className="stroke-status-info transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - fraction)}
            />
          </svg>
          <span className="relative text-[11px] font-semibold tabular-nums text-status-info">{formatCountdown(left)}</span>
        </div>
      )}

      <div className="flex basis-full items-center justify-end gap-2 @md:basis-auto @md:ml-1">
        {defeated && chest && (
          <button
            type="button"
            onClick={() => onAction(chest.action)}
            disabled={disabled || chest.opened}
            title={chest.opened ? `You already emptied the ${chest.label}. It fills when the ${boss.name} is back and down again.` : `Open the ${chest.label}: once per kill`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed ${
              chest.opened ? 'bg-surface-raised text-fg-muted opacity-70' : 'fill-mood-treasure'
            }`}
          >
            <img src="/icons/chest.svg" alt="" className={`h-4 w-4 brightness-0 invert ${chest.opened ? 'opacity-50' : ''}`} />
            <span className={chest.opened ? 'line-through' : ''}>{chest.label}</span>
          </button>
        )}
        {!defeated && (
          <button
            type="button"
            onClick={() => onAction('attack')}
            disabled={disabled}
            title={`Swing to call the ${boss.name} out. It comes every time, and the swing costs a turn.`}
            className="shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold fill-action-attack shadow-sm transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Attack
          </button>
        )}
        {info}
        {defeated && bossRest!.testReset && (
          <button
            type="button"
            onClick={() => onAction({ type: 'boss_rest_reset', data: { enemySlug: boss.slug } })}
            disabled={disabled}
            title="Testing only: clears your clock for this boss so it can roll again"
            className="rounded-md border border-dashed border-status-error/60 px-2.5 py-1 text-[11px] font-semibold text-status-error disabled:opacity-40"
          >
            Reset timer <span className="ml-1 rounded border border-status-error/50 bg-status-error/10 px-1 text-[9px]">TEST</span>
          </button>
        )}
      </div>

      {boardOpen && <BossInfo slug={boss.slug} name={boss.name} onOpenPlayer={onOpenPlayer} />}
    </div>
  )
}

/** The Boss Info toggle, shared with the standing enemy's box in the room card. */
export function BossInfoButton({ name, open, onToggle, disabled = false }: { name: string; open: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={open}
      title={open ? 'Fold Boss Info away' : `The ${name}: who has beaten it and how, and everything about it`}
      className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 ${
        open ? 'border-surface-raised bg-surface-raised text-fg-bright' : 'border-line-strong bg-surface-raised text-fg-bright'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        Boss Info
        <Chevron open={open} />
      </span>
    </button>
  )
}
