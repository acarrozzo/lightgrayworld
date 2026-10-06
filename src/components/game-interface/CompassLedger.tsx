'use client'

import type { Player } from '@/lib/game-state'
import { DANGER_TONE_CLASS, dangerVerdict } from '@/lib/danger-verdict'

/**
 * The danger verdict as one line: "danger 9 · HIGH". The room card draws it
 * under the room's title; the mobile rail and the World Tool may too. The
 * rest of the original nav band's corner (points, weapon, gold) is gone: each
 * is a badged tab now.
 */

interface LedgerRoom {
  roomId?: string
  dangerLevel?: number | null
  isSafe?: boolean | null
}

/** "danger 9 · HIGH". The word in its rung's colour; the number always beside it. */
export function DangerLine({ room, player }: { room: LedgerRoom | null; player: Player | null }) {
  if (!room) return null
  const verdict = dangerVerdict(room.dangerLevel, room.isSafe, player?.level)
  return (
    <span title={`Danger level ${verdict.level} against your level ${player?.level ?? '?'}`}>
      <span className="text-fg-muted">danger</span>{' '}
      <span className="text-fg-primary tabular-nums">{verdict.level}</span>
      <span className="text-fg-muted"> · </span>
      <span className={`font-semibold ${DANGER_TONE_CLASS[verdict.tone]}`}>{verdict.label}</span>
    </span>
  )
}
