'use client'

import type { ReactNode } from 'react'
import { foeCalc, fxLabel, missLabel, supportLabel, youCalc, type LedgerTurn } from '@/lib/fight-ledger'

interface FightLedgerProps {
  turns: LedgerTurn[]
  /** The enemy's name, for its column head. */
  enemyName: string
  /** Mark the last row as the turn that just happened (the live fight). */
  highlightLast?: boolean
  /** What to say when there are no rows: an older record, or a fight not yet begun. */
  emptyText?: string
  /** Scroll the newest row into view when the list first draws (the live sheet). */
  scrollToEnd?: boolean
  /**
   * One line per turn — your blow, its blow, both HP, the arithmetic small
   * beside the number — for the side panel's width, where the table's four
   * columns can only scroll sideways. A long turn wraps; nothing scrolls.
   */
  compact?: boolean
  className?: string
}

/**
 * The fight, turn by turn.
 *
 * One table for every place history is read: the Turn chip's sheet during a
 * fight, the Battle Log card after it, the World Tool player page. Each row
 * is the server's own reading of that turn (`lib/fight-ledger`): what you did
 * and the arithmetic under it (raw − block), what the enemy did back and what
 * it left on you, and both HP after. Colors follow the battle card — your
 * strike in attack red, a spell in MAG purple, a potion or re-gear in the
 * accent, a miss in the card's miss purple, the enemy's hit in defeat red and
 * its special in the crit tone — so a row reads like the readout did when the
 * turn happened. No hooks: a server page can draw it too.
 */
export default function FightLedger({ turns, enemyName, highlightLast = false, emptyText = 'No turn record for this fight.', scrollToEnd = false, compact = false, className = '' }: FightLedgerProps) {
  if (turns.length === 0) {
    return <p className={`px-3 py-4 text-sm text-fg-muted ${className}`}>{emptyText}</p>
  }
  if (compact) {
    return (
      <div className={`text-[10px] tabular-nums ${className}`}>
        <div className="grid grid-cols-[18px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-1.5 px-2.5 pb-0.5 pt-1 text-[8px] uppercase tracking-[0.06em] text-fg-disabled">
          <span>#</span>
          <span>You</span>
          <span className="truncate">{enemyName}</span>
          <span className="text-right">HP</span>
        </div>
        {turns.map((row, index) => {
          const isLast = index === turns.length - 1
          const now = highlightLast && isLast
          return (
            <div
              key={`${row.t}-${index}`}
              ref={scrollToEnd && isLast ? scrollIntoViewOnMount : undefined}
              className={`grid grid-cols-[18px_minmax(0,1fr)_minmax(0,1fr)_auto] items-baseline gap-x-1.5 px-2.5 py-[3px] ${now ? 'bg-accent/10' : ''}`}
              aria-current={now ? 'step' : undefined}
            >
              <span className="text-[9px] font-bold text-fg-disabled">{row.t}</span>
              <span className="min-w-0 text-fg-secondary"><CompactYou you={row.you} /></span>
              <span className="min-w-0 text-fg-secondary"><CompactFoe foe={row.foe} /></span>
              {/* Sized to its numbers, never clipped: four-digit HP on both
                  sides still fits, and the MP takes its own line under them. */}
              <span className="whitespace-nowrap text-right text-[9px] text-fg-muted">
                <b className={`font-semibold ${row.hp.you === 0 ? 'text-combat-defeat' : 'text-fg-secondary'}`}>{row.hp.you}</b>
                ·
                <b className={`font-semibold ${row.hp.foe === 0 ? 'text-combat-victory' : 'text-fg-secondary'}`}>{row.hp.foe}</b>
                {row.mp !== null && <span className="block text-[8px] leading-tight text-resource-mp">{row.mp} MP</span>}
              </span>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[480px] border-collapse text-xs tabular-nums">
        <thead>
          <tr className="text-left text-[9px] font-semibold uppercase tracking-widest text-fg-disabled">
            <th scope="col" className="w-8 px-2 pb-1.5 pt-1 font-semibold">#</th>
            <th scope="col" className="px-2 pb-1.5 pt-1 font-semibold">You</th>
            <th scope="col" className="px-2 pb-1.5 pt-1 font-semibold">{enemyName}</th>
            <th scope="col" className="w-[7.5rem] px-2 pb-1.5 pt-1 text-right font-semibold">HP after</th>
          </tr>
        </thead>
        <tbody>
          {turns.map((row, index) => {
            const isLast = index === turns.length - 1
            const now = highlightLast && isLast
            return (
              <tr
                key={`${row.t}-${index}`}
                ref={scrollToEnd && isLast ? scrollIntoViewOnMount : undefined}
                className={`border-t border-line-subtle/40 align-top ${now ? 'bg-accent/10' : ''}`}
                aria-current={now ? 'step' : undefined}
              >
                <td className="px-2 py-1.5 text-fg-disabled">{row.t}</td>
                <td className="px-2 py-1.5"><YouCell you={row.you} /></td>
                <td className="px-2 py-1.5"><FoeCell foe={row.foe} /></td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right text-fg-muted">
                  <span className="text-[9px] uppercase tracking-wider">you </span>
                  <span className={`font-semibold ${row.hp.you === 0 ? 'text-combat-defeat' : 'text-fg-bright'}`}>{row.hp.you}</span>
                  <span className="mx-1 text-fg-disabled">·</span>
                  <span className="text-[9px] uppercase tracking-wider">foe </span>
                  <span className={`font-semibold ${row.hp.foe === 0 ? 'text-combat-victory' : 'text-fg-bright'}`}>{row.hp.foe}</span>
                  {row.mp !== null && (
                    <span className="ml-1 text-[10px] text-resource-mp">{row.mp} MP</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// A ref callback, not an effect, so the component stays hook-free and
// server-safe; it runs once when the last row mounts.
function scrollIntoViewOnMount(node: HTMLElement | null) {
  if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' })
}

/** The small gray arithmetic beside a compact row's number. */
function Small({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-[9px] text-fg-disabled">{children}</span>
}

/** Your side of a compact turn, on one line: what you did, the number, the arithmetic. */
function CompactYou({ you }: { you: LedgerTurn['you'] }) {
  if (you.kind === 'none') return <span className="italic text-fg-disabled">—</span>
  if (you.kind === 'stone') return <span className="italic text-fg-muted">stone</span>
  if (you.kind === 'support') {
    return (
      <>
        <span className="font-semibold text-accent-hover">{you.name ?? 'something'}</span>
        <Small>{supportLabel(you.verb).toLowerCase()}{you.effect ? ` · ${you.effect}` : ''}</Small>
      </>
    )
  }
  const tone = you.kind === 'spell' ? 'text-stat-mag' : 'text-combat-damage'
  const bits: string[] = []
  if (you.miss) bits.push(missLabel(you.miss))
  else {
    const calc = youCalc(you)
    if (calc) bits.push(calc)
  }
  if (you.cost !== null) bits.push(`−${you.cost} MP`)
  for (const helper of you.helpers) bits.push(`+${helper.dmg} ${helper.name}`)
  return (
    <>
      <span className={`font-semibold ${you.miss ? 'text-hue-purple' : tone}`}>{you.miss ? 'Miss' : (you.name ?? 'Strike')}</span>
      {!you.miss && <b className="ml-1 font-bold text-fg-bright">{you.dmg}</b>}
      {bits.length > 0 && <Small>{bits.join(' · ')}</Small>}
    </>
  )
}

/** The enemy's side of a compact turn, on one line. */
function CompactFoe({ foe }: { foe: LedgerTurn['foe'] }) {
  const fx = foe.fx.map((f) => fxLabel(f))
  if (foe.kind === 'none') {
    return (
      <>
        <span className="italic text-fg-disabled">{foe.fx.length > 0 ? '' : '—'}</span>
        {fx.length > 0 && <Small>{fx.join(' · ')}</Small>}
      </>
    )
  }
  if (foe.kind === 'heal') {
    return (
      <>
        <span className="font-semibold text-combat-heal">Heals</span>
        {fx.length > 0 && <Small>{fx.join(' · ')}</Small>}
      </>
    )
  }
  if (foe.kind === 'windup') {
    return (
      <>
        <span className="font-semibold text-status-warning">Winds up</span>
        <Small>{foe.name ?? 'something'} next turn</Small>
      </>
    )
  }
  const tone = foe.kind === 'special'
    ? 'text-combat-crit'
    : foe.type === 'MAGIC' ? 'text-stat-mag' : foe.type === 'RANGED' ? 'text-stat-dex' : 'text-combat-defeat'
  const label = foe.name ?? (foe.type === 'MAGIC' ? 'Spell' : 'Hit')
  const bits: string[] = []
  if (foe.dodged) bits.push('dodged')
  else {
    const calc = foeCalc(foe)
    if (calc) bits.push(calc)
  }
  for (const hit of foe.hits) bits.push(hit.dodged ? 'dodged' : `+${hit.dmg}${hit.name ? ` ${hit.name}` : hit.pack ? ' pack' : ''}`)
  bits.push(...fx)
  return (
    <>
      <span className={`font-semibold ${tone}`}>{label}</span>
      <b className={`ml-1 font-bold ${foe.dmg === 0 ? 'text-fg-disabled' : 'text-fg-bright'}`}>{foe.dmg}</b>
      {bits.length > 0 && <Small>{bits.join(' · ')}</Small>}
    </>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return <div className="mt-0.5 text-[10px] leading-tight text-fg-muted">{children}</div>
}

function YouCell({ you }: { you: LedgerTurn['you'] }) {
  if (you.kind === 'none') {
    return <span className="italic text-fg-disabled">—</span>
  }
  if (you.kind === 'stone') {
    return (
      <>
        <span className="font-semibold italic text-fg-muted">STONE</span>
        <Sub>you could not act</Sub>
      </>
    )
  }
  if (you.kind === 'support') {
    return (
      <>
        <span className="text-[9px] uppercase tracking-wider text-fg-disabled">{supportLabel(you.verb)} </span>
        <span className="font-semibold text-accent-hover">{you.name ?? 'something'}</span>
        {you.effect && <Sub><span className="text-accent-hover">{you.effect}</span></Sub>}
      </>
    )
  }
  const tone = you.kind === 'spell' ? 'text-stat-mag' : 'text-combat-damage'
  const label = you.name ?? 'Strike'
  const calc = youCalc(you)
  const extras: ReactNode[] = []
  if (you.miss) extras.push(<span key="miss" className="text-hue-purple">{missLabel(you.miss)}</span>)
  else if (calc) extras.push(<span key="calc">{calc}</span>)
  if (you.cost !== null) extras.push(<span key="mp" className="text-resource-mp">−{you.cost} MP</span>)
  for (const helper of you.helpers) {
    extras.push(
      <span key={helper.name} className="text-combat-victory">
        + {helper.name} {helper.dmg}
      </span>
    )
  }
  return (
    <>
      <span className={`font-semibold ${you.miss ? 'text-hue-purple' : tone}`}>{you.miss ? 'Miss' : label}</span>
      {!you.miss && <span className="ml-1 font-bold text-fg-bright">{you.dmg}</span>}
      {you.miss && you.name && <span className="ml-1 text-fg-muted">{you.name}</span>}
      {extras.length > 0 && <Sub>{joinNodes(extras)}</Sub>}
    </>
  )
}

function FoeCell({ foe }: { foe: LedgerTurn['foe'] }) {
  const fx = foe.fx.map((f) => <span key={f.k}>{fxLabel(f)}</span>)
  if (foe.kind === 'none') {
    return (
      <>
        <span className="italic text-fg-disabled">—</span>
        {fx.length > 0 && <Sub>{joinNodes(fx)}</Sub>}
      </>
    )
  }
  if (foe.kind === 'heal') {
    return (
      <>
        <span className="font-semibold text-combat-heal">Heals</span>
        {fx.length > 0 && <Sub>{joinNodes(fx)}</Sub>}
      </>
    )
  }
  if (foe.kind === 'windup') {
    return (
      <>
        <span className="font-semibold text-status-warning">Winds up</span>
        <Sub>{foe.name ? `${foe.name} lands next turn` : 'something lands next turn'}</Sub>
      </>
    )
  }
  // A special names itself in the crit tone. An ordinary hit wears its type,
  // as the card does: a caster's is a Spell in MAG blue, an archer's a Hit in
  // DEX green, anything else a Hit in red.
  const tone = foe.kind === 'special'
    ? 'text-combat-crit'
    : foe.type === 'MAGIC' ? 'text-stat-mag' : foe.type === 'RANGED' ? 'text-stat-dex' : 'text-combat-defeat'
  const label = foe.name ?? (foe.type === 'MAGIC' ? 'Spell' : 'Hit')
  const extras: ReactNode[] = []
  const calc = foeCalc(foe)
  if (foe.dodged) extras.push(<span key="dodge" className="text-hue-purple">you dodged</span>)
  else if (calc) extras.push(<span key="calc">{calc}</span>)
  for (const [i, hit] of foe.hits.entries()) {
    extras.push(
      <span key={`hit-${i}`}>
        {hit.dodged ? 'dodged' : `+${hit.dmg}`}
        {hit.name ? ` ${hit.name}` : hit.pack ? ' pack' : ''}
      </span>
    )
  }
  extras.push(...fx)
  const nothing = foe.dmg === 0
  return (
    <>
      <span className={`font-semibold ${tone}`}>{label}</span>
      <span className={`ml-1 font-bold ${nothing ? 'text-fg-disabled' : 'text-fg-bright'}`}>{foe.dmg}</span>
      {extras.length > 0 && <Sub>{joinNodes(extras)}</Sub>}
    </>
  )
}

function joinNodes(nodes: ReactNode[]): ReactNode {
  return nodes.map((node, i) => (
    <span key={i}>
      {i > 0 && <span className="mx-1 text-fg-disabled">·</span>}
      {node}
    </span>
  ))
}
