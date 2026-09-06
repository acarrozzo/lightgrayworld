'use client'

/**
 * The three kinds of quest in quests.json.
 *
 * - `main`  — the giver's story quest; one active per NPC at a time.
 * - `side`  — optional work from the same giver; never blocks anything.
 * - `intro` — "go and talk to this person". Pays nothing; finishing it is what
 *             opens the giver's main and side quests. Exists to walk the player
 *             somewhere and to carry the giver's first lines of dialog.
 */
export type QuestType = 'main' | 'side' | 'intro'

const LABELS: Record<QuestType, string> = { main: 'Main', side: 'Side', intro: 'Intro' }

// Gold for main and blue for side are the established pair; intro sits below
// both in a quiet gray so it reads as a stepping stone rather than a goal.
const FILLED: Record<QuestType, string> = {
  main: 'bg-resource-gold/20 text-resource-gold',
  side: 'bg-resource-mp/20 text-resource-mp',
  intro: 'bg-surface-hover/70 text-fg-muted',
}
const OUTLINED: Record<QuestType, string> = {
  main: 'border-resource-gold text-resource-gold',
  side: 'border-accent text-accent-hover',
  intro: 'border-line-subtle text-fg-muted',
}

export function isQuestType(value: unknown): value is QuestType {
  return value === 'main' || value === 'side' || value === 'intro'
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
