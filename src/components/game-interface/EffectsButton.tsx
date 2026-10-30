'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import Icon from '@/components/Icon'
import { EXPIRING_CLASS, STATUS_TONE_CLASSES, STATUS_TONE_FILLS } from '@/components/StatusStrip'
import type { InventoryItem, Player } from '@/lib/game-state'
import type { StatusChip } from '@/lib/status-effects'
import type { CastSituation } from '@/lib/spellbook'
import { effectSource, effectSourceLink, renewal, type EffectSource } from '@/lib/effect-sources'
import { followFeedLink, type FeedLink } from '@/lib/feed-links'

interface EffectsButtonProps {
  chips: StatusChip[]
  player: Player | null
  inventory: InventoryItem[]
  /** Where the player stands, so Again is only offered when the cast would not be refused. */
  situation: CastSituation
  /** Held while an action resolves. */
  isActing?: boolean
  onAction: (action: { type: string; data?: Record<string, unknown> }) => void
  /** The popover opens below the button in the column, above it on the phone strip. */
  placement?: 'down' | 'up'
  /** The Actions tab has been earned, so the foot's link has somewhere to go. */
  canOpenActions?: boolean
  className?: string
}

/**
 * Active buffs, as one small button in the compass box's corner: the count
 * (green when one of them is poison), and on tap the chips. Each chip is a way
 * to where it is renewed — its row in the Actions tab, ringed — and, in its
 * last clicks, an Again that renews it in place. A link at the foot opens the
 * Actions tab's Buffs. The button is always there, so the way to the buffs
 * is too; with nothing active it sits dim with no count. Again sends the same
 * action the Actions tab does, and the server refuses it the same way.
 */
export default function EffectsButton({ chips, player, inventory, situation, isActing = false, onAction, placement = 'down', canOpenActions = true, className = '' }: EffectsButtonProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const active = chips.length > 0
  const poisoned = chips.some((chip) => chip.tone === 'poison')
  const label = active ? `${chips.length} active buff${chips.length === 1 ? '' : 's'}${poisoned ? ', including poison' : ''}` : 'No active buffs'

  const go = (link: FeedLink) => {
    setOpen(false)
    followFeedLink(link)
  }
  const use = (source: EffectSource) => {
    if (source.kind === 'spell') onAction({ type: 'cast_spell', data: { spellId: source.entry.def.id } })
    else onAction({ type: 'use_item', data: { playerItemId: source.item.id, action: source.action } })
  }

  return (
    <div ref={rootRef} className={`z-20 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={`relative flex h-8 w-8 items-center justify-center rounded-md border bg-surface-panel/85 shadow-sm backdrop-blur-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
          poisoned
            ? 'border-hue-green/60 text-hue-green hover:bg-hue-green/10'
            : active
              ? 'border-hue-purple/50 text-hue-purple hover:bg-hue-purple/10'
              : 'border-line-strong text-fg-muted opacity-70 hover:opacity-100 hover:bg-surface-raised/60'
        }`}
      >
        <Sparkles size={14} aria-hidden="true" />
        {active && (
          <span
            className={`absolute -right-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ${
              poisoned ? 'fill-hue-green' : 'fill-hue-purple'
            }`}
          >
            {chips.length}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Active buffs"
          className={`absolute right-0 flex max-h-[min(70vh,32rem)] w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-lg border border-line-strong bg-surface-overlay p-2.5 shadow-xl shadow-black/40 ${
            placement === 'up' ? 'bottom-full mb-1.5' : 'top-9'
          }`}
        >
          <p className="px-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-fg-muted">Active Buffs</p>
          {!active && <p className="px-0.5 text-[11px] text-fg-disabled">Nothing is active.</p>}
          {active && <div className="flex flex-col gap-1">
            {chips.map((chip) => {
              const source = effectSource(chip.field, player, inventory)
              const again = renewal(chip, source, situation)
              const body = (
                <>
                  <Icon name={chip.icon} size={14} color="current" className="flex-shrink-0" />
                  <span className="font-semibold">{chip.label}</span>
                  {chip.detail && <span className="truncate font-normal opacity-90 tabular-nums">{chip.detail}</span>}
                  {typeof chip.clicks === 'number' && <span className="ml-auto pl-1 font-normal tabular-nums text-fg-muted">{chip.clicks}</span>}
                </>
              )
              return (
                <div
                  key={chip.id}
                  className={`flex min-h-8 items-center gap-1.5 rounded-md border pr-1 text-[11px] ${STATUS_TONE_CLASSES[chip.tone]} ${chip.expiring ? EXPIRING_CLASS : ''}`}
                >
                  {source ? (
                    <button
                      type="button"
                      onClick={() => go(effectSourceLink(source))}
                      title={`${chip.title} Tap for ${source.kind === 'spell' ? source.entry.def.name : source.item.template.name}.`}
                      className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-l-md pl-2 text-left hover:bg-surface-raised/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
                    >
                      {body}
                      <ChevronRight size={12} aria-hidden="true" className="flex-shrink-0 text-fg-muted" />
                    </button>
                  ) : (
                    <span title={chip.title} className="flex min-w-0 flex-1 items-center gap-1.5 pl-2 cursor-help">
                      {body}
                    </span>
                  )}
                  {again && (
                    <button
                      type="button"
                      onClick={() => use(again.source)}
                      disabled={isActing}
                      title={again.title}
                      aria-label={again.title}
                      className={`flex-shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold ${STATUS_TONE_FILLS[chip.tone]} transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}
                    >
                      Again · {again.cost}
                    </button>
                  )}
                </div>
              )
            })}
            <p className="px-0.5 text-[10px] text-fg-disabled">Each chip says what the next click does.</p>
          </div>}

          {canOpenActions && <div className="mt-1 flex justify-end border-t border-line-subtle pt-1.5">
            <button
              type="button"
              onClick={() => go({ tab: 'actions', sub: 'items', anchor: 'buffs' })}
              className="inline-flex items-center gap-0.5 rounded text-[11px] font-semibold text-fg-secondary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              Buffs in Actions
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>}
        </div>
      )}
    </div>
  )
}
