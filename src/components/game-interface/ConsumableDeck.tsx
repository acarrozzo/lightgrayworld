'use client'

import { useCallback, useEffect } from 'react'
import { useGameStore, type InventoryItem, type ItemPreview } from '@/lib/game-state'
import { ABILITY_GRID, ConsumableRow, useConsumableDeck } from './AbilityRows'

interface ConsumableDeckProps {
  inventory: InventoryItem[]
  /** A restorer is wasted at a full bar; the row says so and its verb goes quiet. */
  hpFull: boolean
  mpFull: boolean
  /** Held while a turn resolves. */
  disabled?: boolean
  onUse: (playerItemId: string, action: string) => void
  /** Tap the name to open it in the bag. Omit in a fight. */
  onOpen?: (playerItemId: string) => void
  emptyText?: string
}

/**
 * The bag sorted for reaching into: HP and MP restorers in two ladders,
 * strongest first, anything that fills both under them, buffs last. The battle
 * deck's Items tab and the Bag layer both draw this, so a Red Potion reads the
 * same in and out of a fight. Hovering a row ghosts what it would restore onto
 * the vitals (the store's item preview), cleared on use and on unmount.
 */
export default function ConsumableDeck({ inventory, hpFull, mpFull, disabled = false, onUse, onOpen, emptyText = 'No items to use.' }: ConsumableDeckProps) {
  const setItemPreview = useGameStore((s) => s.setItemPreview)
  const previewOnHover = useCallback((preview: ItemPreview | null) => (hovering: boolean) => {
    setItemPreview(hovering ? preview : null)
  }, [setItemPreview])
  useEffect(() => () => setItemPreview(null), [setItemPreview])
  const spendItem = useCallback((playerItemId: string, action: string) => {
    setItemPreview(null)
    onUse(playerItemId, action)
  }, [onUse, setItemPreview])

  const { all: deckItems, hp: hpItems, mp: mpItems, both: bothItems, buffs: buffItems } = useConsumableDeck(inventory)

  if (deckItems.length === 0) {
    return <p className="text-xs text-fg-disabled italic py-2 px-1">{emptyText}</p>
  }

  return (
    <div className="@container flex flex-col gap-1.5">
      {/* Two ladders, HP then MP, strongest first. Side by side only once the
          container is wide enough for two full rows; a thin panel stacks them. */}
      {(hpItems.length > 0 || mpItems.length > 0) && (
        <div className={ABILITY_GRID}>
          {([
            { key: 'hp', heading: 'HP', items: hpItems, full: hpFull, reason: 'Full HP', text: 'text-resource-hp' },
            { key: 'mp', heading: 'MP', items: mpItems, full: mpFull, reason: 'Full MP', text: 'text-resource-mp' },
          ] as const).map((column) => (
            <div key={column.key} className="flex flex-col gap-1 min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1 ${column.text}`}>{column.heading}</span>
              {column.items.length === 0 ? (
                <span className="text-[10px] text-fg-disabled italic px-1 py-1.5">None</span>
              ) : column.items.map((entry) => (
                <ConsumableRow
                  key={entry.item.id}
                  entry={entry}
                  reason={column.full ? column.reason : null}
                  disabled={disabled}
                  onUse={spendItem}
                  onOpen={onOpen}
                  onHoverChange={column.full ? undefined : previewOnHover({ hp: entry.summary.hp, mp: entry.summary.mp })}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Restores both: full rows under the ladders, the two numbers in their own colours. */}
      {bothItems.length > 0 && <span className="text-[9px] font-bold uppercase tracking-wider px-1 text-hue-purple">HP & MP</span>}
      {bothItems.length > 0 && (
        <div className={ABILITY_GRID}>
          {bothItems.map((entry) => {
            const reason = hpFull && mpFull ? 'Full HP & MP' : null
            return (
              <ConsumableRow
                key={entry.item.id}
                entry={entry}
                reason={reason}
                disabled={disabled}
                onUse={spendItem}
                onOpen={onOpen}
                onHoverChange={reason ? undefined : previewOnHover({ hp: entry.summary.hp, mp: entry.summary.mp })}
              />
            )
          })}
        </div>
      )}

      {/* Buffs and the rest. What the buff does ("+20 STR") and how long it
          lasts sit beside the verb, as on every other row. */}
      {buffItems.length > 0 && (
        <>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1 text-fg-muted">Buffs</span>
          <div className={ABILITY_GRID}>
            {buffItems.map((entry) => {
              const bonus: NonNullable<ItemPreview['stats']> = {}
              for (const buff of entry.summary.buffs) {
                for (const [stat, amount] of Object.entries(buff.bonus) as [keyof typeof bonus, number][]) {
                  bonus[stat] = (bonus[stat] ?? 0) + amount
                }
              }
              return (
                <ConsumableRow
                  key={entry.item.id}
                  entry={entry}
                  disabled={disabled}
                  onUse={spendItem}
                  onOpen={onOpen}
                  onHoverChange={Object.keys(bonus).length > 0 ? previewOnHover({ hp: 0, mp: 0, stats: bonus }) : undefined}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
