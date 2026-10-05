'use client'

import { LevelUpPayload } from '@/lib/socket'

interface LevelUpAlertProps {
  data: LevelUpPayload
  onClose: () => void
  onTrainNow: () => void
  onSpendCorePoints: () => void
  /** Opens the Skills & Spells book. Only reachable while `canSpendSp` is true. */
  onSpendSkillPoints: () => void
  /** Total Training Points available to spend */
  tpAvailable: number
  /** Total Core Points available to spend */
  cpAvailable: number
  /** Total Skill Points available to spend */
  spAvailable: number
  /**
   * Whether to offer the SP button at all. SP buys nothing until a teacher has
   * been met, so the caller only turns this on from level 5 and only when the
   * book actually has a row this SP can pay for.
   */
  canSpendSp: boolean
}

const GOLD_TEXT = { color: 'var(--combat-crit)', textShadow: '0 0 14px color-mix(in srgb, var(--combat-crit) 45%, transparent)' }

export default function LevelUpAlert({ data, onClose, onTrainNow, onSpendCorePoints, onSpendSkillPoints, tpAvailable, cpAvailable, spAvailable, canSpendSp }: LevelUpAlertProps) {
  // Training and Core points are spent on the Char page, so one button leads
  // there for both. Once both are gone the card has done its job: the button
  // dims to a receipt and Close takes its place as the thing to press.
  const toSpend = Math.max(0, tpAvailable) + Math.max(0, cpAvailable)
  const spent = toSpend <= 0
  const gains: Array<{ value: number; unit: string; title: string; color: string }> = [
    { value: data.tpGained, unit: 'TP', title: 'Training Points', color: 'var(--resource-gold)' },
    { value: data.cpGained, unit: 'CP', title: 'Core Points', color: 'var(--accent)' },
    { value: data.spGained, unit: 'SP', title: 'Skill Points', color: 'var(--hue-green)' },
    { value: data.hpGained, unit: 'HP', title: 'Max HP', color: 'var(--resource-hp)' },
    { value: data.mpGained, unit: 'MP', title: 'Max MP', color: 'var(--resource-mp)' },
  ].filter((gain) => gain.value > 0)
  const button = 'h-9 rounded-lg px-3 text-xs font-black uppercase tracking-widest transition-all'

  return (
    // A small card that still feels like a prize: a gold edge and a glowing
    // number, with everything it has to say in three short rows.
    <div
      className="mx-4 mt-4 overflow-hidden rounded-xl border border-status-warning/80 shadow-xl"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--resource-gold) 9%, var(--surface-canvas)), color-mix(in srgb, var(--resource-gold) 16%, var(--surface-canvas)) 45%, color-mix(in srgb, var(--resource-gold) 9%, var(--surface-canvas)))' }}
      role="status"
      aria-label={`Level up. You have reached level ${data.newLevel}.`}
    >
      {/* The news, on one line: Level Up, and the level. */}
      <div
        className="flex items-center gap-2 border-b border-status-warning/40 py-2 pl-4 pr-2"
        style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--resource-gold) 22%, transparent), transparent)' }}
      >
        <span className="text-base leading-none" style={{ filter: 'drop-shadow(0 0 6px var(--combat-crit))', color: 'var(--combat-crit)' }} aria-hidden="true">★</span>
        <p className="text-sm font-black uppercase tracking-widest" style={GOLD_TEXT}>Level Up!</p>
        <p className="ml-auto flex items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-status-warning/80">Level</span>
          <span className="text-2xl font-black leading-none tabular-nums" style={GOLD_TEXT}>{data.newLevel}</span>
        </p>
        <button onClick={onClose} className="rounded p-1 text-fg-muted transition-colors hover:text-status-warning" aria-label="Dismiss level up alert">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* What the level gave, as one line of small gains. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5">
        {gains.map((gain) => (
          <span key={gain.unit} className="flex items-baseline gap-1 tabular-nums" title={gain.title}>
            <span className="text-base font-black" style={{ color: gain.color }}>+{gain.value}</span>
            <span className="text-[10px] font-bold" style={{ color: gain.color }}>{gain.unit}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 px-3 pb-3">
        {spent ? (
          <span className={`${button} flex flex-1 items-center justify-center bg-surface-raised text-fg-disabled`}>Points spent ✓</span>
        ) : (
          <button
            type="button"
            onClick={tpAvailable > 0 ? onTrainNow : onSpendCorePoints}
            className={`${button} flex-1 whitespace-nowrap`}
            style={{
              background: 'var(--resource-gold)',
              color: 'color-mix(in srgb, var(--resource-gold) 10%, var(--surface-canvas))',
              boxShadow: '0 0 14px color-mix(in srgb, var(--resource-gold) 35%, transparent)',
            }}
          >
            Spend {toSpend} {toSpend === 1 ? 'point' : 'points'}
          </button>
        )}
        {canSpendSp && (
          <button
            type="button"
            onClick={onSpendSkillPoints}
            className={`${button} flex-1 whitespace-nowrap border border-hue-green/70 text-hue-green hover:bg-hue-green/15`}
          >
            Spend SP ({spAvailable})
          </button>
        )}
        {spent && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close level up alert"
            className={`${button} flex-1 border border-status-warning/70 bg-surface-raised text-fg-bright hover:bg-surface-hover`}
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
