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

const GOLD = { color: 'var(--combat-crit)' }

/**
 * The level-up card, centred: a gold medal with the new level in it, then
 * what the level gave as a row of tiles. One button leads to the Char page,
 * where Training and Core points are both spent; Skill Points have their own
 * when there is something to learn. Once the points are gone the card has
 * done its job, and Close takes the button's place.
 *
 * A level gained by winning a fight is not shown here at all: the victory
 * card carries it as a band (BattlePanel), so there is one card, not two.
 */
export default function LevelUpAlert({ data, onClose, onTrainNow, onSpendCorePoints, onSpendSkillPoints, tpAvailable, cpAvailable, spAvailable, canSpendSp }: LevelUpAlertProps) {
  const toSpend = Math.max(0, tpAvailable) + Math.max(0, cpAvailable)
  const spent = toSpend <= 0
  const gains: Array<{ label: string; value: string; tone: string }> = [
    { label: 'Training Points', value: `+${data.tpGained}`, tone: 'text-resource-gold' },
    { label: 'Core Points', value: `+${data.cpGained}`, tone: 'text-accent' },
    { label: 'Skill Points', value: `+${data.spGained}`, tone: 'text-stat-mag' },
    { label: 'Max HP', value: `+${data.hpGained}`, tone: 'text-resource-hp' },
    { label: 'Max MP', value: `+${data.mpGained}`, tone: 'text-resource-mp' },
  ].filter((gain) => gain.value !== '+0')
  const button = 'h-11 rounded-lg px-4 text-sm font-black uppercase tracking-widest transition-all'

  return (
    <div
      className="mx-4 mt-4 overflow-hidden rounded-xl border border-status-warning/80 shadow-2xl"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--resource-gold) 10%, var(--surface-canvas)) 0%, color-mix(in srgb, var(--resource-gold) 18%, var(--surface-canvas)) 40%, color-mix(in srgb, var(--resource-gold) 10%, var(--surface-canvas)) 100%)' }}
      role="status"
      aria-label={`Level up. You have reached level ${data.newLevel}.`}
    >
      {/* Banner */}
      <div
        className="relative flex items-center justify-center border-b border-status-warning/40 px-10 py-2.5"
        style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--resource-gold) 25%, transparent), transparent)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg leading-none" style={{ ...GOLD, filter: 'drop-shadow(0 0 8px var(--combat-crit))' }} aria-hidden="true">★</span>
          <p className="text-lg font-black uppercase tracking-widest" style={{ ...GOLD, textShadow: '0 0 20px color-mix(in srgb, var(--combat-crit) 50%, transparent), 0 0 40px color-mix(in srgb, var(--combat-crit) 25%, transparent)' }}>
            Level Up!
          </p>
          <span className="text-lg leading-none" style={{ ...GOLD, filter: 'drop-shadow(0 0 8px var(--combat-crit))' }} aria-hidden="true">★</span>
        </div>
        <button onClick={onClose} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-fg-muted transition-colors hover:text-status-warning" aria-label="Dismiss level up alert">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* The medal, centred: the new level in a gold ring. */}
      <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-status-warning/80">You have reached</p>
        <div
          className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-[3px]"
          style={{
            borderColor: 'var(--combat-crit)',
            background: 'radial-gradient(circle, color-mix(in srgb, var(--resource-gold) 32%, var(--surface-canvas)) 0%, color-mix(in srgb, var(--resource-gold) 8%, var(--surface-canvas)) 70%)',
            boxShadow: '0 0 36px color-mix(in srgb, var(--resource-gold) 50%, transparent), inset 0 0 18px color-mix(in srgb, var(--combat-crit) 28%, transparent)',
          }}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-status-warning/80">Level</span>
          <span className="text-6xl font-black leading-none tabular-nums" style={{ ...GOLD, textShadow: '0 0 30px color-mix(in srgb, var(--combat-crit) 60%, transparent), 0 2px 0 var(--surface-canvas)' }}>
            {data.newLevel}
          </span>
        </div>
      </div>

      <div className="mx-6 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--resource-gold), var(--combat-crit), var(--resource-gold), transparent)' }} />

      {/* What the level gave, as a centred row of tiles. */}
      <div className="flex flex-wrap items-stretch justify-center gap-2 px-4 py-4">
        {gains.map((gain) => (
          <div
            key={gain.label}
            className="flex min-w-[5.25rem] flex-col items-center justify-center rounded-lg border border-status-warning/25 px-2.5 py-2"
            style={{ background: 'linear-gradient(135deg, var(--surface-panel), var(--surface-raised))' }}
          >
            <span className={`text-xl font-black leading-none tabular-nums ${gain.tone}`}>{gain.value}</span>
            <span className="mt-1 whitespace-nowrap text-[10px] tracking-wide text-fg-muted">{gain.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2 px-4 pb-4">
        {spent ? (
          <span className={`${button} flex flex-1 items-center justify-center whitespace-nowrap bg-surface-raised text-fg-disabled`}>Points spent ✓</span>
        ) : (
          <button
            type="button"
            onClick={tpAvailable > 0 ? onTrainNow : onSpendCorePoints}
            className={`${button} flex-1 whitespace-nowrap fill-resource-gold hover:brightness-110`}
            style={{ boxShadow: '0 0 14px color-mix(in srgb, var(--resource-gold) 35%, transparent)' }}
          >
            Spend {toSpend} {toSpend === 1 ? 'point' : 'points'}
          </button>
        )}
        {canSpendSp && (
          <button
            type="button"
            onClick={onSpendSkillPoints}
            className={`${button} flex-1 whitespace-nowrap border border-stat-mag/70 text-stat-mag hover:bg-stat-mag/15`}
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
