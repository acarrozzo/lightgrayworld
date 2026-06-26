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
  return (
    <div className="mx-4 mt-4 rounded-xl overflow-hidden shadow-2xl border border-yellow-500/80"
      style={{ background: 'linear-gradient(160deg, #1a1200 0%, #2a1a00 40%, #1a1200 100%)' }}
    >
      {/* Header */}
      <div className="relative flex items-center justify-center px-4 py-4 border-b border-yellow-600/40"
        style={{ background: 'linear-gradient(90deg, transparent, #7c4a0020, #b5850040, #7c4a0020, transparent)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px #facc15)' }}>★</span>
          <p className="text-xl font-black tracking-widest uppercase"
            style={{ color: '#facc15', textShadow: '0 0 20px #facc1580, 0 0 40px #facc1540' }}
          >
            Level Up!
          </p>
          <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px #facc15)' }}>★</span>
        </div>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-500 hover:text-yellow-300 transition-colors p-1 rounded"
          aria-label="Dismiss level up alert"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Level badge */}
      <div className="flex flex-col items-center pt-5 pb-3 gap-1">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-yellow-600/80">You have reached</p>
        <div className="flex items-center gap-2">
          <span className="text-5xl font-black tabular-nums"
            style={{ color: '#fde047', textShadow: '0 0 30px #facc1599, 0 2px 0 #78350f' }}
          >
            {data.newLevel}
          </span>
        </div>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-yellow-600/80">level</p>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px mb-4"
        style={{ background: 'linear-gradient(90deg, transparent, #b45309, #fbbf24, #b45309, transparent)' }}
      />

      {/* Stat grants */}
      <div className="px-4 pb-5 flex flex-col items-center gap-2">
        <div className="grid grid-cols-3 gap-2 w-full">
          <StatGrant label="Core Points" value={`+${data.cpGained}`} unit="CP" color="#93c5fd" glow="#3b82f6" />
          <StatGrant label="Training Points" value={`+${data.tpGained}`} unit="TP" color="#c4b5fd" glow="#8b5cf6" />
          <StatGrant label="Skill Points" value={`+${data.spGained}`} unit="SP" color="#86efac" glow="#22c55e" />
        </div>
        <div className="grid grid-cols-2 gap-2 w-full">
          <StatGrant label="Max HP" value={`+${data.hpGained}`} unit="HP" color="#fca5a5" glow="#ef4444" />
          <StatGrant label="Max MP" value={`+${data.mpGained}`} unit="MP" color="#67e8f9" glow="#06b6d4" />
        </div>

        <div className="mt-4 w-full flex gap-2">
          <button
            type="button"
            onClick={onTrainNow}
            className="flex-[2] rounded-lg py-3 px-4 font-black tracking-widest uppercase text-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, #b45309, #f59e0b, #b45309)',
              color: '#1a1200',
              boxShadow: '0 0 20px #f59e0b66, inset 0 1px 0 #fde04780',
            }}
          >
            Train Now ({tpAvailable})
          </button>
          <button
            type="button"
            onClick={onSpendCorePoints}
            className="flex-1 rounded-lg py-3 px-3 font-black tracking-widest uppercase text-xs transition-all"
            style={{
              background: 'linear-gradient(135deg, #1e3a8a, #3b82f6, #1e3a8a)',
              color: '#0b1220',
              boxShadow: '0 0 20px #3b82f666, inset 0 1px 0 #93c5fd80',
            }}
          >
            Spend Core Points ({cpAvailable})
          </button>
        </div>
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
        background: `linear-gradient(135deg, #0f172a, #1e293b)`,
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
      <span className="text-[10px] text-gray-500 mt-0.5 tracking-wide">{label}</span>
    </div>
  )
}
