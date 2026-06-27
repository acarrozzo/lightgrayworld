'use client'

import { getSellValue } from '@/lib/shop-pricing'

interface InventorySellButtonProps {
  item: {
    id: string
    template: {
      name: string
      description?: string
      canSell?: boolean
      value: number
    }
    quantity: number
  }
  /**
   * Perform the sale. `anchor` is the bounding rect of the clicked button so
   * the parent can float the result popover (ActionFlyout) above it.
   */
  onSell: (quantity: number, anchor: DOMRect) => void
  disabled?: boolean
}

export default function InventorySellButton({
  item,
  onSell,
  disabled = false,
}: InventorySellButtonProps) {
  const cannotSell = item.template.canSell === false

  if (cannotSell) {
    return null
  }

  const quantity = item.quantity
  const showQuantityOptions = quantity > 1

  // Per-unit sell value (shared with the server + shop display)
  const sellValuePerItem = getSellValue(item.template.value)
  const halfQuantity = Math.ceil(quantity / 2)
  const allButOneQuantity = quantity - 1

  const handleSell = (qty: number, event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || qty < 1) return
    onSell(qty, event.currentTarget.getBoundingClientRect())
  }

  // Buttons fill their cell so they look right whether the card is wide
  // (one row) or narrow (the 2x2 grid below wraps the quantity options).
  const btn =
    'flex flex-col items-center justify-center w-full px-2 py-1 rounded-md text-white bg-green-600/80 hover:bg-green-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed leading-tight'

  const SellOption = ({
    label,
    qty,
    className = '',
  }: {
    label: string
    qty: number
    className?: string
  }) => (
    <button onClick={(e) => handleSell(qty, e)} disabled={disabled} className={`${btn} ${className}`}>
      <span className="text-[11px] font-semibold whitespace-nowrap">{label}</span>
      <span className="text-[10px] text-green-200/90">{sellValuePerItem * qty}g</span>
    </button>
  )

  // Single-unit items only need one straightforward "Sell" button
  if (!showQuantityOptions) {
    return <SellOption label="Sell" qty={1} />
  }

  return (
    <div className="grid grid-cols-2 gap-1 w-full">
      <SellOption label="Sell 1" qty={1} />
      <SellOption label="Half" qty={halfQuantity} />
      <SellOption label="All but 1" qty={allButOneQuantity} />
      {/* "Sell all" set apart with a subtle ring instead of spacing so it still
          fills the grid cell at every width */}
      <SellOption label="Sell all" qty={quantity} className="ring-1 ring-green-300/40" />
    </div>
  )
}
