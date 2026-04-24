'use client'

import { LevelUpPayload } from '@/lib/socket'

interface LevelUpAlertProps {
  data: LevelUpPayload
  onClose: () => void
}

export default function LevelUpAlert({ data, onClose }: LevelUpAlertProps) {
  return (
    <div className="mx-4 mt-4 border border-yellow-600/60 bg-yellow-900/20 rounded-lg overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-yellow-900/30 border-b border-yellow-700/40">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg">★</span>
          <p className="text-base font-bold text-yellow-300">LEVEL UP!</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 rounded"
          aria-label="Dismiss level up alert"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        <p className="text-white font-semibold text-sm">
          You have reached <span className="text-yellow-300">Level {data.newLevel}</span>!
        </p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <StatGrant label="Core Points" value={`+${data.cpGained} CP`} color="text-blue-300" />
          <StatGrant label="Talent Points" value={`+${data.tpGained} TP`} color="text-purple-300" />
          <StatGrant label="Skill Points" value={`+${data.spGained} SP`} color="text-green-300" />
          <StatGrant label="Max HP" value={`+${data.hpGained} HP`} color="text-red-300" />
          <StatGrant label="Max MP" value={`+${data.mpGained} MP`} color="text-cyan-300" />
        </div>
      </div>
    </div>
  )
}

function StatGrant({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded bg-gray-900/60 border border-gray-700/40 px-2 py-1.5">
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-500 mt-0.5">{label}</span>
    </div>
  )
}
