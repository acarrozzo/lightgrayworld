'use client'

import { Check, Circle } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import {
  getVisibleRequirementProgress,
  type QuestRequirement,
  type RequirementProgress,
} from '@/lib/quest-requirements'

/**
 * Colour-coded requirement readout shared by the NPC card and the quest journal.
 *
 * Three states, so a glance is enough to know what's left:
 *   green  — done
 *   amber  — started, not finished
 *   gray   — not started
 */
type Tone = {
  chip: string
  text: string
  count: string
  bar: string
}

const TONES: Record<'met' | 'partial' | 'none', Tone> = {
  met: {
    chip: 'border-green-500/40 bg-green-500/10',
    text: 'text-green-300',
    count: 'text-green-300',
    bar: 'bg-green-500',
  },
  partial: {
    chip: 'border-amber-500/40 bg-amber-500/10',
    text: 'text-amber-200',
    count: 'text-amber-300',
    bar: 'bg-amber-500',
  },
  none: {
    chip: 'border-gray-600/50 bg-gray-700/25',
    text: 'text-gray-400',
    count: 'text-gray-400',
    bar: 'bg-gray-500',
  },
}

function toneFor(req: RequirementProgress): Tone {
  if (req.met) return TONES.met
  return req.current > 0 ? TONES.partial : TONES.none
}

interface QuestRequirementsProps {
  requirements?: QuestRequirement[]
  /**
   * 'compact' — inline chips, for the NPC card under a quest title.
   * 'full'    — labelled rows with progress bars, for the quest journal.
   */
  variant?: 'compact' | 'full'
  className?: string
}

export default function QuestRequirements({
  requirements,
  variant = 'compact',
  className = '',
}: QuestRequirementsProps) {
  const inventory = useGameStore((s) => s.inventory)
  const killList = useGameStore((s) => s.killList)
  const player = useGameStore((s) => s.player)

  const progress = getVisibleRequirementProgress(requirements, { inventory, killList, player })
  if (progress.length === 0) return null

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-1 ${className}`}>
        {progress.map((req) => {
          const tone = toneFor(req)
          return (
            <span
              key={req.key}
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-none ${tone.chip} ${tone.text}`}
            >
              {req.met ? (
                <Check size={11} className="shrink-0" aria-hidden="true" />
              ) : (
                <Circle size={9} className="shrink-0" aria-hidden="true" />
              )}
              {req.countable && (
                <span className="font-bold tabular-nums">
                  {req.current}/{req.total}
                </span>
              )}
              <span>{req.label}</span>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="text-gray-500 text-sm">Requirements:</span>
      <div className="space-y-1.5">
        {progress.map((req) => {
          const tone = toneFor(req)
          const pct = req.total > 0 ? Math.min(100, Math.round((req.current / req.total) * 100)) : 0
          return (
            <div key={req.key} className={`rounded border px-2.5 py-1.5 ${tone.chip}`}>
              <div className="flex items-center gap-2">
                {req.met ? (
                  <Check size={14} className={`shrink-0 ${tone.text}`} aria-hidden="true" />
                ) : (
                  <Circle size={11} className={`shrink-0 ${tone.text}`} aria-hidden="true" />
                )}
                <span className={`flex-1 min-w-0 truncate text-sm ${tone.text}`}>{req.label}</span>
                <span className={`shrink-0 text-xs font-bold tabular-nums ${tone.count}`}>
                  {req.countable ? `${req.current}/${req.total}` : req.met ? 'Done' : 'Not yet'}
                </span>
              </div>
              {/* Only a multi-step tally earns a bar; 0/1 says everything already. */}
              {req.countable && req.total > 1 && (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-900/60">
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
