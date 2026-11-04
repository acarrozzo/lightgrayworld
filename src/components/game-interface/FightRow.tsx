'use client'

import FightLedger from '@/components/FightLedger'
import { formatTimeAgo } from '@/components/player/PlayerRow'
import type { LedgerTurn } from '@/lib/fight-ledger'

/** A Battle Log row as the list route serves it: the summary, no turns. */
export interface FightSummary {
  id: string
  enemySlug: string
  enemyName: string
  outcome: string
  turnsCount: number
  totalDamageDealt: number
  totalDamageReceived: number
  maxSingleHit: number
  xpEarned: number
  goldEarned: number
  itemsDropped: string[]
  multiplayerBonus?: boolean
  createdAt: string
  /** The player as the fight began, and `hpEnd` where it left them. Null on rows older than the snapshot. */
  snapshot?: { hp?: number | null; hpMax?: number | null; hpEnd?: number | null } | null
}

interface FightRowProps {
  fight: FightSummary
  open: boolean
  onToggle: () => void
  /** The fight's turns: undefined while never asked for, null while on the way, [] when none were kept. */
  ledger?: LedgerTurn[] | null
  /** "2m ago" on the Char page, the date in the log. */
  when?: 'ago' | 'date'
}

const OUTCOME: Record<string, { label: string; text: string; edge: string }> = {
  WIN: { label: 'WIN', text: 'text-status-success', edge: 'border-l-status-success' },
  LOSS: { label: 'DIED', text: 'text-status-error', edge: 'border-l-status-error' },
  FLED: { label: 'FLED', text: 'text-fg-muted', edge: 'border-l-line-strong' },
}

/**
 * One fight, in the Char page's Recent fights and in the Battle log.
 *
 * Two lines on one surface, the outcome on the colored left edge. Line one
 * is the enemy and when; line two is the HP bar — your HP as the fight
 * ended against what you walked in with, the lost part dim, a death an
 * empty bar — and every number in one gray run: turns, dealt, took, best
 * hit. So a closed row already says how it went. Open adds only the loot
 * and the turns, one line each (`FightLedger` compact), drawn to the side
 * panel's width with nothing scrolling sideways.
 */
export default function FightRow({ fight, open, onToggle, ledger, when = 'ago' }: FightRowProps) {
  const outcome = OUTCOME[fight.outcome] ?? OUTCOME.LOSS
  const ts = new Date(fight.createdAt)
  const whenText = when === 'ago' ? formatTimeAgo(ts.getTime()) : ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const whenTitle = ts.toLocaleString()
  const bar = hpBar(fight, ledger)

  return (
    <div className={`overflow-hidden rounded-lg border border-l-[3px] border-line-subtle/60 bg-surface-panel/60 ${outcome.edge}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-col gap-1 px-2.5 py-1.5 text-left hover:bg-surface-raised/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
      >
        <span className="flex items-center gap-2 text-[12px]">
          <span className={`shrink-0 text-[9px] font-bold tracking-[0.06em] ${outcome.text}`}>{outcome.label}</span>
          <span className="min-w-0 flex-1 truncate font-semibold text-fg-bright">{fight.enemyName}</span>
          <span className="shrink-0 text-[9px] text-fg-disabled" title={whenTitle}>{whenText}</span>
          <span className={`shrink-0 text-[11px] text-fg-disabled transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
        </span>
        <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[9px] tabular-nums text-fg-muted">
          <span
            className={`flex h-1 w-16 shrink-0 overflow-hidden rounded-full ${bar.known ? 'bg-surface-raised' : 'border border-dashed border-line-subtle/60'}`}
            title={bar.title}
            aria-hidden="true"
          >
            {bar.known && (
              <>
                <span className="block h-full bg-resource-hp" style={{ width: `${bar.endPct}%` }} />
                <span className="block h-full bg-resource-hp/30" style={{ width: `${bar.lostPct}%` }} />
              </>
            )}
          </span>
          <span title={bar.title}>
            {bar.known ? <><b className="font-semibold text-fg-secondary">{bar.end}</b>/{bar.max}</> : <b className="font-semibold text-fg-disabled">—</b>}
          </span>
          <Dot />
          <span><b className="font-semibold text-fg-secondary">{fight.turnsCount}</b> turn{fight.turnsCount === 1 ? '' : 's'}</span>
          <Dot />
          <span>dealt <b className="font-semibold text-fg-secondary">{fight.totalDamageDealt}</b></span>
          <Dot />
          <span>took <b className="font-semibold text-fg-secondary">{fight.totalDamageReceived}</b></span>
          <Dot />
          <span className="truncate">best <b className="font-semibold text-fg-secondary">{fight.maxSingleHit}</b></span>
        </span>
      </button>

      {open && fight.outcome === 'WIN' && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 border-t border-line-subtle/40 px-2.5 py-1.5 text-[10px]">
          <span className="text-status-success">+{fight.xpEarned} XP</span>
          <span className="text-resource-gold">+{fight.goldEarned} gold</span>
          {fight.itemsDropped.map((item, i) => (
            <span key={`${item}-${i}`} className="text-stat-mag">{item}</span>
          ))}
          {fight.multiplayerBonus && <span className="text-resource-mp">group</span>}
        </div>
      )}
      {open && fight.outcome === 'FLED' && (
        <p className="border-t border-line-subtle/40 px-2.5 py-1.5 text-[10px] text-fg-muted">You broke off. The {fight.enemyName} kept its HP.</p>
      )}

      {open && (
        <div className="border-t border-line-subtle/40">
          {ledger === null || ledger === undefined ? (
            <p className="px-2.5 py-2 text-[11px] text-fg-muted">Loading the turns...</p>
          ) : (
            <FightLedger turns={ledger} enemyName={fight.enemyName} compact className="py-1" emptyText="No turn record for this fight (it predates the ledger)." />
          )}
        </div>
      )}
    </div>
  )
}

function Dot() {
  return <span className="text-line-strong" aria-hidden="true">·</span>
}

/**
 * The bar's numbers. The end HP is the snapshot's, or the last turn's reading
 * once the turns are loaded; the start is the snapshot's, held to the max so
 * an over-max opening (a capsule) still draws inside the track.
 */
function hpBar(fight: FightSummary, ledger: LedgerTurn[] | null | undefined) {
  const snap = fight.snapshot ?? null
  const max = typeof snap?.hpMax === 'number' && snap.hpMax > 0 ? snap.hpMax : null
  const fromLedger = ledger && ledger.length > 0 ? ledger[ledger.length - 1].hp.you : null
  const end = typeof snap?.hpEnd === 'number' ? snap.hpEnd : fight.outcome === 'LOSS' ? 0 : fromLedger
  if (max === null || end === null) {
    return { known: false as const, title: 'This fight predates the HP record.', end: null, max: null, endPct: 0, lostPct: 0 }
  }
  const start = Math.min(max, typeof snap?.hp === 'number' ? snap.hp : max)
  const endHeld = Math.max(0, Math.min(max, end))
  const endPct = Math.round((endHeld / max) * 100)
  const lostPct = Math.max(0, Math.round(((Math.max(start, endHeld) - endHeld) / max) * 100))
  return {
    known: true as const,
    title: `Walked in with ${start} of ${max} HP, left with ${endHeld}`,
    end: endHeld,
    max,
    endPct,
    lostPct,
  }
}
