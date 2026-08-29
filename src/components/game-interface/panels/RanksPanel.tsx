'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import { PlayerAvatar } from '@/components/player/PlayerRow'

/**
 * World standings. Read-only, and derived from the same aggregates the world-tool
 * /players page uses, so the two boards cannot disagree about a player's totals.
 */

type RankRow = {
  id: string
  username: string
  level: number
  xp: number
  kills: number
  deaths: number
  completedQuests: number
  chestsOpened: number
  clicks: number
  uIcon: string | null
  uIconColor: string | null
  lastActive: string
}

type RankKey = 'level' | 'kills' | 'completedQuests' | 'chestsOpened' | 'deaths' | 'clicks'

const BOARDS: { key: RankKey; label: string; describe: (row: RankRow) => string }[] = [
  { key: 'level', label: 'Level', describe: (r) => `Lv${r.level} · ${r.xp.toLocaleString()} xp` },
  { key: 'kills', label: 'Kills', describe: (r) => `${r.kills.toLocaleString()} kills` },
  { key: 'completedQuests', label: 'Quests', describe: (r) => `${r.completedQuests} completed` },
  { key: 'chestsOpened', label: 'Chests', describe: (r) => `${r.chestsOpened} opened` },
  { key: 'deaths', label: 'Deaths', describe: (r) => `${r.deaths.toLocaleString()} deaths` },
  { key: 'clicks', label: 'Clicks', describe: (r) => `${r.clicks.toLocaleString()} clicks` },
]

const valueOf = (row: RankRow, key: RankKey): number => (key === 'level' ? row.level : row[key])

interface RanksPanelProps {
  onOpenProfile: (player: { id: string; username: string; level: number; uIcon?: string | null; uIconColor?: string | null }) => void
}

export default function RanksPanel({ onOpenProfile }: RanksPanelProps) {
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const currentPlayerId = useGameStore((s) => s.player?.id)

  const [rows, setRows] = useState<RankRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<RankKey>('level')

  const fetchRanks = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/players/ranks', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to load standings')
      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'Failed to load standings')
      setRows(data.ranks ?? [])
    } catch (err) {
      console.error('Ranks fetch failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to load standings')
    } finally {
      setIsLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchRanks()
  }, [fetchRanks])

  const active = BOARDS.find((b) => b.key === board) ?? BOARDS[0]

  // Level ties break on XP; every other board breaks on level, then name, so the
  // ordering is stable rather than dependent on row order from the database.
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const delta = valueOf(b, board) - valueOf(a, board)
      if (delta !== 0) return delta
      if (board === 'level') return b.xp - a.xp
      return b.level - a.level || a.username.localeCompare(b.username)
    })
  }, [rows, board])

  const myRank = useMemo(() => {
    if (!currentPlayerId) return null
    const index = sorted.findIndex((row) => row.id === currentPlayerId)
    return index === -1 ? null : index + 1
  }, [sorted, currentPlayerId])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-800/60 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-white">Standings</h3>
          {myRank !== null && (
            <span className="text-xs text-gray-400">
              You&rsquo;re <span className="font-semibold text-pink-300">#{myRank}</span> of {sorted.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchRanks}
          disabled={isLoading}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-700/60 bg-gray-900/60 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-800/60 disabled:opacity-50"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-800/60 px-4 py-2">
        {BOARDS.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setBoard(entry.key)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              board === entry.key
                ? 'bg-pink-600/25 text-pink-200'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {error ? (
          <div className="m-2 rounded-lg border border-red-800/50 bg-red-900/20 p-3">
            <div className="text-xs text-red-300">{error}</div>
            <button
              onClick={fetchRanks}
              className="mt-2 rounded-lg bg-red-600/90 px-3 py-1 text-xs text-white hover:bg-red-500/90"
            >
              Retry
            </button>
          </div>
        ) : isLoading && rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">Loading standings…</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">No players yet.</div>
        ) : (
          <div className="divide-y divide-gray-800/40">
            {sorted.map((row, index) => {
              const isSelf = row.id === currentPlayerId
              return (
                <div
                  key={row.id}
                  className={`flex items-center gap-2 px-1.5 py-1 ${isSelf ? 'bg-pink-500/5' : ''}`}
                >
                  <span
                    className={`w-7 shrink-0 text-right text-[11px] tabular-nums ${
                      index < 3 ? 'font-bold text-amber-300' : 'text-gray-600'
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <PlayerAvatar uIcon={row.uIcon} uIconColor={row.uIconColor} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          onOpenProfile({
                            id: row.id,
                            username: row.username,
                            level: row.level,
                            uIcon: row.uIcon,
                            uIconColor: row.uIconColor,
                          })
                        }
                        className="truncate text-xs text-gray-300 hover:text-white hover:underline"
                      >
                        {row.username}
                      </button>
                      {isSelf && (
                        <span className="rounded-sm border border-blue-400/60 bg-blue-500/25 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-blue-200">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-gray-500">{active.describe(row)}</div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-300">
                    {valueOf(row, board).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
