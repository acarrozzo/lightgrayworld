'use client'

import { useCallback, useEffect, useState } from 'react'
import { useGameStore } from '@/lib/game-state'
import FightRow, { type FightSummary } from '@/components/game-interface/FightRow'
import { asLedgerTurns, type LedgerTurn } from '@/lib/fight-ledger'

interface RecentFightsProps {
  getAuthHeaders: () => Record<string, string>
  /** The Battle Log tab, for the whole history. */
  onOpenBattleLog?: () => void
}

/**
 * The last five fights, on the Char page: the Battle Log's newest rows with
 * a tap into each one's turns. Rereads after every fight ends (the row is
 * written a beat after the result reaches the client, so the read waits a
 * moment). The whole history is one link away.
 */
export default function RecentFights({ getAuthHeaders, onOpenBattleLog }: RecentFightsProps) {
  const battleResult = useGameStore((s) => s.battleResult)
  const [rows, setRows] = useState<FightSummary[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [ledgers, setLedgers] = useState<Record<string, LedgerTurn[] | null>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/player/battle-log?limit=5', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) setRows(data.logs)
      else setRows([])
    } catch {
      setRows([])
    }
  }, [getAuthHeaders])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!battleResult) return
    const timer = window.setTimeout(load, 1500)
    return () => window.clearTimeout(timer)
  }, [battleResult, load])

  const toggle = useCallback(async (id: string) => {
    setOpenId((current) => (current === id ? null : id))
    if (id in ledgers) return
    setLedgers((prev) => ({ ...prev, [id]: null }))
    try {
      const res = await fetch(`/api/player/battle-log?id=${encodeURIComponent(id)}`, { headers: getAuthHeaders() })
      const data = await res.json()
      setLedgers((prev) => ({ ...prev, [id]: data.success ? asLedgerTurns(data.log?.turns) : [] }))
    } catch {
      setLedgers((prev) => ({ ...prev, [id]: [] }))
    }
  }, [getAuthHeaders, ledgers])

  if (!rows || rows.length === 0) return null

  return (
    <div className="@container space-y-1.5">
      <div className="flex items-baseline gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">Recent fights</h4>
        {onOpenBattleLog && (
          <button type="button" onClick={onOpenBattleLog} className="ml-auto text-[11px] font-semibold text-hue-sky hover:underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus rounded-sm">
            All fights ›
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <FightRow key={row.id} fight={row} open={openId === row.id} onToggle={() => toggle(row.id)} ledger={ledgers[row.id]} when="ago" />
        ))}
      </div>
    </div>
  )
}
