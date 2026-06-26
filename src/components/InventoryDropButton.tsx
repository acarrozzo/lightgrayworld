'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getItemActions } from '@/lib/item-actions'
import Icon from './Icon'

interface InventoryDropButtonProps {
  item: {
    id: string
    isEquipped?: boolean
    template: {
      name: string
      slug?: string
      description?: string
      canDrop?: boolean
      equipSlot?: string | null
      metadata?: unknown
    }
    quantity: number
  }
  onDrop: (quantity: number) => void
  onExamine: () => void
  onItemAction?: (action: string) => void
  disabled?: boolean
}

export default function InventoryDropButton({
  item,
  onDrop,
  onExamine,
  onItemAction,
  disabled = false,
}: InventoryDropButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  const itemActions = item.template.slug ? getItemActions(item.template.slug, item.template.metadata as any) : []

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  const handleMainButtonClick = () => {
    if (isDisabled) return
    onDrop(1)
    setIsOpen(false)
  }

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    setIsOpen(!isOpen)
  }

  const handleDropHalf = () => {
    if (isDisabled || item.quantity <= 1) return
    const halfQuantity = Math.ceil(item.quantity / 2)
    onDrop(halfQuantity)
    setIsOpen(false)
  }

  const handleDropAll = () => {
    if (isDisabled || item.quantity <= 1) return
    onDrop(item.quantity)
    setIsOpen(false)
  }

  const handleExamine = () => {
    if (disabled) return
    onExamine()
    setIsOpen(false)
  }

  const handleItemAction = (action: string) => {
    if (disabled) return
    onItemAction?.(action)
    setIsOpen(false)
  }

  const showQuantityOptions = item.quantity > 1
  const isEquipped = item.isEquipped === true
  const cannotDrop = item.template.canDrop === false || isEquipped
  const isDisabled = disabled || cannotDrop

  return (
    <div className="relative inline-block" ref={buttonRef}>
      <div className="flex items-stretch">
        {/* Main button - only show if item can be dropped */}
        {!cannotDrop && (
          <button
            onClick={handleMainButtonClick}
            disabled={disabled}
            className="px-1.5 py-0.5 text-xs bg-gray-600/70 hover:bg-gray-600 rounded-l text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            Drop
          </button>
        )}
        
        {/* Dropdown toggle button */}
        <button
          onClick={handleDropdownToggle}
          disabled={disabled}
          className={`px-1 py-0.5 bg-gray-600/70 hover:bg-gray-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            cannotDrop ? 'rounded' : 'rounded-r border-l border-gray-500/30'
          }`}
          aria-label="More options"
        >
          <ChevronDown size={10} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-gray-800 rounded-md shadow-lg border border-gray-700 overflow-hidden"
        >
          <div className="py-1">
            {/* Drop options - only show if item can be dropped */}
            {!cannotDrop && (
              <>
                <button
                  onClick={handleMainButtonClick}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Drop 1
                </button>
                
                {showQuantityOptions && (
                  <>
                    <button
                      onClick={handleDropHalf}
                      disabled={disabled}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Drop half
                    </button>
                    <button
                      onClick={handleDropAll}
                      disabled={disabled}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Drop all
                    </button>
                  </>
                )}
                
                <div className="border-t border-gray-700 my-1" />
              </>
            )}
            
            <button
              onClick={handleExamine}
              disabled={disabled}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Examine {item.template.name}
            </button>
            
            {itemActions.length > 0 && (
              <>
                <div className="border-t border-gray-700 my-1" />
                {itemActions.map((itemAction) => (
                  <button
                    key={itemAction.action}
                    onClick={() => handleItemAction(itemAction.action)}
                    disabled={disabled}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {itemAction.icon && (
                      <Icon name={itemAction.icon} size={14} color="current" />
                    )}
                    {itemAction.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

