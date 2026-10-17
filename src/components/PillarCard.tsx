'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/game-state'
import { ROOM_COLOR_TOKENS } from '@/lib/theme/room-colors'
import { listPillarNames, completedSet } from '@/lib/game-data/quest-registry'
import type { QuestProgressRow } from '@/lib/game-state'

interface PillarName {
  questId: string | null
  title: string
  colorToken: string | null
  waitsFor: string | null
  holders: string[]
}

/**
 * The Grand Quest Pillar on room 029's card: the five carved names, the
 * viewer's own lit in their land's color, and under each the players who
 * hold it. The names are the registry's; the holders come from /api/pillar,
 * which every visitor reads the same way. Yours are known without asking.
 */
export default function PillarCard({ quests }: { quests: QuestProgressRow[] }) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const username = useGameStore((state) => state.player?.username ?? null)
  const [holders, setHolders] = useState<Record<string, string[]> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/pillar', { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { names?: PillarName[] } | null) => {
        if (cancelled || !data?.names) return
        const next: Record<string, string[]> = {}
        for (const name of data.names) if (name.questId) next[name.questId] = name.holders ?? []
        setHolders(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [getAuthHeaders])

  const names = useMemo(() => {
    const done = completedSet(quests)
    return listPillarNames().map((name) => ({
      ...name,
      yours: !!(name.questId && done.has(name.questId)),
      holders: name.questId ? holders?.[name.questId] ?? null : [],
    }))
  }, [quests, holders])

  return (
    <div className="mt-3 rounded-lg border border-resource-gold/40 bg-surface-raised/40 px-3 py-2.5" aria-label="The Grand Quest Pillar">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-resource-gold/80">Carved into the Pillar</div>
      <ol className="space-y-1.5">
        {names.map((name) => {
          const colorVar = name.colorToken ? ROOM_COLOR_TOKENS[name.colorToken] ?? null : null
          const others = (name.holders ?? []).filter((holder) => holder !== username)
          const holdersLine = name.waitsFor
            ? `Still dark. The gates of ${name.waitsFor} are closed.`
            : name.holders === null
              ? '…'
              : name.holders.length === 0
                ? 'No name carved here yet.'
                : name.yours
                  ? others.length
                    ? `You and ${others.join(', ')}`
                    : 'You'
                  : name.holders.join(', ')
          return (
            <li key={name.title} className="flex items-start gap-2 text-xs">
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: name.yours ? (colorVar ? `var(${colorVar})` : 'var(--resource-gold)') : 'transparent',
                  border: `1px solid ${name.yours ? 'transparent' : 'var(--line-subtle)'}`,
                }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 leading-tight">
                <span
                  className={`block truncate font-semibold ${name.yours ? '' : name.waitsFor ? 'text-fg-disabled' : 'text-fg-secondary'}`}
                  style={name.yours ? { color: colorVar ? `var(${colorVar})` : 'var(--resource-gold)' } : undefined}
                >
                  {name.title}
                  {name.yours && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-resource-gold">yours</span>}
                </span>
                <span className="block truncate text-[10px] text-fg-muted" title={name.holders?.length ? name.holders.join(', ') : undefined}>
                  {holdersLine}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
