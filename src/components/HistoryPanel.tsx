'use client'

import { useEffect, useRef } from 'react'
import { useHistoryStore } from '@/store/historyStore'

export default function HistoryPanel() {
  const entries = useHistoryStore((state) => state.entries)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-900/30"
        data-testid="history-panel"
      >
        {entries.length === 0 ? (
          <div className="text-gray-500/80 text-sm text-center py-8">No history yet.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3">
              <span className="text-xs text-gray-500/70 whitespace-nowrap">
                {new Date(entry.ts).toLocaleTimeString()}
              </span>
              <span className="text-sm text-gray-200 leading-relaxed">{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

