'use client'

import { useGameStore } from '@/lib/game-state'
import FightLedger from '@/components/FightLedger'
import RoomSheet from './RoomSheet'

interface FightLedgerSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * The fight so far, over the fight.
 *
 * The battle card's Turn chip opens it: every turn of this fight as ledger
 * rows (`components/FightLedger`), newest at the bottom and marked. The same
 * sheet-or-dialog as the Room chip's, so it costs the pinned layout nothing.
 * Live, it reads the running battle; once the fight is won, it reads the
 * frame the store kept for the frozen victory box, so "how did that go" is
 * still a tap away until Continue. After that the Battle Log has it.
 */
export default function FightLedgerSheet({ open, onClose }: FightLedgerSheetProps) {
  const live = useGameStore((s) => s.battle)
  const lastFrame = useGameStore((s) => s.battleLastFrame)
  const result = useGameStore((s) => s.battleResult)
  const frame = live.isInBattle ? live : lastFrame
  if (!open || !frame) return null
  const enemyName = frame.enemyName ?? 'The enemy'
  const outcome = !live.isInBattle && result ? (result.outcome === 'WIN' ? ' · Victory' : ' · Defeat') : ''
  return (
    <RoomSheet open={open} onClose={onClose} title={`${enemyName} · Turn ${frame.turnCount}${outcome}`} toneClass="text-combat-damage">
      <FightLedger
        turns={frame.turns}
        enemyName={enemyName}
        highlightLast
        scrollToEnd
        emptyText="No turns yet. The first exchange will appear here."
        className="pb-2"
      />
    </RoomSheet>
  )
}
