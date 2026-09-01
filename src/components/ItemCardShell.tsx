'use client'

import React from 'react'
import Icon from './Icon'
import { InventoryItem } from '@/lib/game-state'
import { resolveItemIcon } from '@/lib/item-actions'
import { renderStatMods } from '@/lib/inventory-categories'
import { WeaponCategory } from '@prisma/client'

interface ItemCardShellProps {
  item: InventoryItem
  /** Apply the "equipped" green border/gradient treatment. */
  highlighted?: boolean
  /** Show the red "new item" indicator dot. */
  newBadge?: boolean
  /** Action area rendered at the bottom of the card's content column. */
  footer?: React.ReactNode
  /** Extra classes for the card root (e.g. width constraints in the shop). */
  className?: string
}

/**
 * Shared presentational shell for an inventory/shop item row: icon, name,
 * quantity, weapon line, stat mods and description. The caller supplies the
 * action footer (equip/drop in the inventory, sell buttons in the shop) so the
 * common markup lives in exactly one place.
 */
export default function ItemCardShell({
  item,
  highlighted = false,
  newBadge = false,
  footer,
  className = '',
}: ItemCardShellProps) {
  const metadata = item.template.metadata as { icon?: string } | null
  const itemIcon = resolveItemIcon(metadata, item.template.slug || '')
  const mods = renderStatMods(item.template.metadata)

  return (
    <div
      className={`relative rounded-lg border px-4 py-3 shadow-md hover:shadow-lg transition-all duration-200 flex gap-3 ${
        highlighted
          ? 'border-status-success/70 bg-gradient-to-br from-status-success/30 via-status-success/20 to-status-success/20 hover:from-status-success/40 hover:via-status-success/30 hover:to-status-success/30 hover:border-status-success/90 shadow-status-success/10'
          : 'border-line-subtle/30 bg-surface-raised/25 hover:bg-surface-raised/45 hover:border-line-strong/50'
      } ${className}`}
    >
      {newBadge && (
        <span className="absolute left-2 top-2 w-2 h-2 bg-status-error rounded-full z-10 shadow-lg shadow-status-error/50 border border-status-error/50"></span>
      )}

      {/* Item icon on the left */}
      <div className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded-lg bg-surface-hover/30 border border-line-strong/30">
        <Icon name={itemIcon} size={64} color="current" className="text-fg-primary" />
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {/* Top row: name + quantity */}
        <div className="flex items-center gap-2 mb-1">
          <div className={`text-fg-bright text-sm font-semibold truncate min-w-0 ${newBadge ? 'pl-2' : ''}`}>
            {item.template.name}
          </div>
          {item.quantity > 1 && (
            <span className="text-resource-gold text-xs font-bold border border-resource-gold/40 bg-resource-gold/15 px-1.5 py-0.5 rounded-md flex-shrink-0 shadow-sm">
              x{item.quantity}
            </span>
          )}
        </div>

        {/* Weapon type / handedness */}
        {item.template.weaponCategory && (
          <div className="flex gap-1 items-center mb-1">
            <span className="text-[10px] text-fg-muted uppercase tracking-wide">
              {item.template.weaponCategory === WeaponCategory.RANGED ? 'Ranged' : 'Melee'}
            </span>
            <span className="text-fg-disabled text-[10px]">·</span>
            <span className="text-[10px] text-fg-muted uppercase tracking-wide">
              {(item.template.metadata as any)?.isTwoHanded ? '2H' : '1H'}
            </span>
          </div>
        )}

        {/* Stat mods */}
        {mods && <div className="text-sm font-bold mb-1">{mods}</div>}

        {/* Description */}
        {item.template.description && (
          <div className="text-fg-secondary text-xs mb-2 line-clamp-2 leading-relaxed">
            {item.template.description}
          </div>
        )}

        {footer}
      </div>
    </div>
  )
}
