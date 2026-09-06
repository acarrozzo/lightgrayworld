'use client'

/**
 * The two kinds of quest in quests.json.
 *
 * - `main`  — the giver's story quest.
 * - `side`  — optional work from the same giver; never blocks anything.
 *
 * Meeting a giver used to be a third kind ("intro"); it is now the giver's
 * `greeting` and a GiverMet row, not a quest.
 */
export type QuestType = 'main' | 'side'

const LABELS: Record<QuestType, string> = { main: 'Main', side: 'Side' }

// Gold for main and blue for side are the established pair.
const FILLED: Record<QuestType, string> = {
  main: 'bg-resource-gold/20 text-resource-gold',
  side: 'bg-resource-mp/20 text-resource-mp',
}
const OUTLINED: Record<QuestType, string> = {
  main: 'border-resource-gold text-resource-gold',
  side: 'border-accent text-accent-hover',
}

export function isQuestType(value: unknown): value is QuestType {
  return value === 'main' || value === 'side'
}

interface QuestTypeTagProps {
  type: string
  /** `filled` for in-game cards; `outlined` matches the World Tool's reference pages. */
  variant?: 'filled' | 'outlined'
  className?: string
}

export default function QuestTypeTag({ type, variant = 'filled', className = '' }: QuestTypeTagProps) {
  const kind: QuestType = isQuestType(type) ? type : 'side'
  const look =
    variant === 'outlined'
      ? `rounded border px-1.5 py-0.5 ${OUTLINED[kind]}`
      : `rounded px-1.5 py-0.5 font-bold ${FILLED[kind]}`
  return (
    <span className={`shrink-0 text-[10px] uppercase tracking-wide ${look} ${className}`.trim()}>
      {LABELS[kind]}
    </span>
  )
}
