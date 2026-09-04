'use client'

import { LevelUpPayload } from '@/lib/socket'

interface LevelUpAlertProps {
  data: LevelUpPayload
  onClose: () => void
  onTrainNow: () => void
  onSpendCorePoints: () => void
  /** Total Training Points available to spend */
  tpAvailable: number
  /** Total Core Points available to spend */
  cpAvailable: number
}

export default function LevelUpAlert({ data, onClose, onTrainNow, onSpendCorePoints, tpAvailable, cpAvailable }: LevelUpAlertProps) {
  // Every level grants at least one TP, so zero means it has been spent —
  // from this card or from the Character panel. That is the moment the card
  // has done its job: Train Now dims to a receipt and a big Close appears
  // under the row, so the player is not hunting for the corner X.
  const trained = tpAvailable <= 0
  const coreSpent = cpAvailable <= 0
  const spentButton = 'flex rounded-lg py-3 px-3 font-black tracking-widest uppercase items-center justify-center bg-surface-raised text-fg-disabled cursor-default'

  return (
    <div className="mx-4 mt-4 rounded-xl overflow-hidden shadow-2xl border border-status-warning/80"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--resource-gold) 10%, var(--surface-canvas)) 0%, color-mix(in srgb, var(--resource-gold) 18%, var(--surface-canvas)) 40%, color-mix(in srgb, var(--resource-gold) 10%, var(--surface-canvas)) 100%)' }}
    >
      {/* Header */}
      <div className="relative flex items-center justify-center px-4 py-4 border-b border-status-warning/40"
        style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--resource-gold) 13%, transparent), color-mix(in srgb, var(--resource-gold) 25%, transparent), color-mix(in srgb, var(--resource-gold) 13%, transparent), transparent)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px var(--combat-crit))' }}>★</span>
          <p className="text-xl font-black tracking-widest uppercase"
            style={{ color: 'var(--combat-crit)', textShadow: '0 0 20px color-mix(in srgb, var(--combat-crit) 50%, transparent), 0 0 40px color-mix(in srgb, var(--combat-crit) 25%, transparent)' }}
          >
            Level Up!
          </p>
          <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px var(--combat-crit))' }}>★</span>
        </div>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-fg-muted hover:text-status-warning transition-colors p-1 rounded"
          aria-label="Dismiss level up alert"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Level badge */}
      <div className="flex flex-col items-center pt-5 pb-3 gap-1">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-status-warning/80">You have reached</p>
        <div className="flex items-center gap-2">
          <span className="text-5xl font-black tabular-nums"
            style={{ color: 'var(--combat-crit)', textShadow: '0 0 30px color-mix(in srgb, var(--combat-crit) 60%, transparent), 0 2px 0 var(--surface-canvas)' }}
          >
            {data.newLevel}
          </span>
        </div>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-status-warning/80">level</p>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px mb-4"
        style={{ background: 'linear-gradient(90deg, transparent, var(--resource-gold), var(--combat-crit), var(--resource-gold), transparent)' }}
      />

      {/* Stat grants */}
      <div className="px-4 pb-5 flex flex-col items-center gap-2">
        <div className="grid grid-cols-3 gap-2 w-full">
          <StatGrant label="Core Points" value={`+${data.cpGained}`} unit="CP" color="var(--hue-blue)" glow="var(--hue-blue)" />
          <StatGrant label="Training Points" value={`+${data.tpGained}`} unit="TP" color="var(--hue-violet)" glow="var(--hue-violet)" />
          <StatGrant label="Skill Points" value={`+${data.spGained}`} unit="SP" color="var(--hue-green)" glow="var(--hue-green)" />
        </div>
        <div className="grid grid-cols-2 gap-2 w-full">
          <StatGrant label="Max HP" value={`+${data.hpGained}`} unit="HP" color="var(--resource-hp)" glow="var(--resource-hp)" />
          <StatGrant label="Max MP" value={`+${data.mpGained}`} unit="MP" color="var(--resource-mp)" glow="var(--resource-mp)" />
        </div>

        <div className="mt-4 w-full flex gap-2">
          {trained ? (
            <span className={`flex-[2] text-sm ${spentButton}`}>
              Trained ✓
            </span>
          ) : (
            <button
              type="button"
              onClick={onTrainNow}
              className="flex-[2] rounded-lg py-3 px-4 font-black tracking-widest uppercase text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--resource-gold), var(--resource-gold), var(--resource-gold))',
                color: 'color-mix(in srgb, var(--resource-gold) 10%, var(--surface-canvas))',
                boxShadow: '0 0 20px color-mix(in srgb, var(--resource-gold) 40%, transparent), inset 0 1px 0 color-mix(in srgb, var(--combat-crit) 50%, transparent)',
              }}
            >
              Train Now ({tpAvailable})
            </button>
          )}
          {coreSpent ? (
            <span className={`flex-1 text-xs ${spentButton}`}>
              CP Spent ✓
            </span>
          ) : (
            <button
              type="button"
              onClick={onSpendCorePoints}
              className="flex-1 rounded-lg py-3 px-3 font-black tracking-widest uppercase text-xs transition-all"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 45%, var(--surface-canvas)), var(--hue-blue), color-mix(in srgb, var(--accent) 45%, var(--surface-canvas)))',
                color: 'var(--surface-canvas)',
                boxShadow: '0 0 20px color-mix(in srgb, var(--hue-blue) 40%, transparent), inset 0 1px 0 color-mix(in srgb, var(--hue-blue) 50%, transparent)',
              }}
            >
              Spend Core Points ({cpAvailable})
            </button>
          )}
        </div>

        {trained && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close level up alert"
            className="mt-2 w-full rounded-lg py-3.5 px-4 font-black tracking-[0.2em] uppercase text-sm bg-surface-raised hover:bg-surface-hover text-fg-bright border border-status-warning/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-status-warning"
            style={{
              boxShadow: '0 0 18px color-mix(in srgb, var(--resource-gold) 20%, transparent), inset 0 1px 0 color-mix(in srgb, var(--resource-gold) 20%, transparent)',
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}

function StatGrant({ label, value, unit, color, glow }: {
  label: string
  value: string
  unit: string
  color: string
  glow: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg py-3 px-2 border"
      style={{
        background: `linear-gradient(135deg, var(--surface-panel), var(--surface-raised))`,
        borderColor: `${glow}40`,
        boxShadow: `inset 0 1px 0 ${glow}20`,
      }}
    >
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-black tabular-nums" style={{ color, textShadow: `0 0 12px ${glow}80` }}>
          {value}
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {unit}
        </span>
      </div>
      <span className="text-[10px] text-fg-muted mt-0.5 tracking-wide">{label}</span>
    </div>
  )
}
