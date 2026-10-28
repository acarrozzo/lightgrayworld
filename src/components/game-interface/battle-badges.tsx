'use client'

/**
 * The small tags a fight's two sides wear: a level, a rank, the turn.
 * Shared by the battle HUD at the top of the screen and the battle card
 * beneath it, so the two never drift apart.
 */

export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 px-1.5 py-0.5 rounded border border-line-strong/50 bg-surface-raised/60 shrink-0">
      <span className="text-[9px] font-semibold text-fg-muted uppercase tracking-wide leading-none">Lv</span>
      <span className="text-sm font-black text-fg-bright leading-none tabular-nums">{level}</span>
    </span>
  )
}

/** BOSS / MINI-BOSS beside the level: the same gold tag the room card wears. */
export function RankBadge({ rank }: { rank: 'boss' | 'miniboss' }) {
  return (
    <span className="shrink-0 rounded border border-resource-gold/40 bg-resource-gold/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none text-resource-gold">
      {rank === 'boss' ? 'Boss' : 'Mini-boss'}
    </span>
  )
}

/**
 * "Turn N" between the two sides. With `onOpen` it is a chip that opens the
 * fight's ledger — the Room chip's idea, applied to time: the fight so far,
 * a tap away without moving anything on the pinned card.
 */
export function TurnChip({ turn, onOpen, size }: { turn: number; onOpen?: () => void; size: 'sm' | 'md' }) {
  const label = size === 'sm' ? 'text-[8px]' : 'text-[9px]'
  const number = size === 'sm' ? 'text-[10px]' : 'text-[11px]'
  const inner = (
    <>
      Turn <span className={`${number} font-semibold tracking-normal text-fg-secondary tabular-nums`}>{turn}</span>
    </>
  )
  if (!onOpen) {
    return <span className={`whitespace-nowrap ${label} uppercase tracking-widest text-fg-muted`}>{inner}</span>
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      title="The fight so far, turn by turn"
      aria-label={`Turn ${turn}. Open the fight's turn-by-turn ledger`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line-strong/50 bg-surface-raised/40 px-2 py-0.5 ${label} uppercase tracking-widest text-fg-muted transition-colors hover:border-combat-damage/50 hover:text-fg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}
    >
      {inner}
      <svg className="h-2.5 w-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    </button>
  )
}
