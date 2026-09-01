'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface ItemDropdownButtonProps {
  item: {
    id: string
    template: {
      name: string
      description?: string
      equipSlot?: string | null
    }
    quantity: number
  }
  onPickup: (quantity: number) => void
  onExamine: () => void
  disabled?: boolean
}

export default function ItemDropdownButton({
  item,
  onPickup,
  onExamine,
  disabled = false,
}: ItemDropdownButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

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
    if (disabled) return
    onPickup(1)
    setIsOpen(false)
  }

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    setIsOpen(!isOpen)
  }

  const handlePickupHalf = () => {
    if (disabled || item.quantity <= 1) return
    const halfQuantity = Math.ceil(item.quantity / 2)
    onPickup(halfQuantity)
    setIsOpen(false)
  }

  const handlePickupAll = () => {
    if (disabled || item.quantity <= 1) return
    onPickup(item.quantity)
    setIsOpen(false)
  }

  const handleExamine = () => {
    if (disabled) return
    onExamine()
    setIsOpen(false)
  }

  const showQuantityOptions = item.quantity > 1

  return (
    <div className="relative inline-block" ref={buttonRef}>
      <div className="flex items-stretch">
        {/* Main button */}
        <button
          onClick={handleMainButtonClick}
          disabled={disabled}
          className="px-3 py-1.5 rounded-l-md fill-status-success text-xs transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{item.template.name}</span>
          {item.quantity > 1 && <span className="text-status-success">x{item.quantity}</span>}
        </button>
        
        {/* Dropdown toggle button */}
        <button
          onClick={handleDropdownToggle}
          disabled={disabled}
          className="px-2 py-1.5 rounded-r-md fill-status-success transition-colors border-l border-status-success/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          aria-label="More options"
        >
          <ChevronDown size={14} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-surface-raised rounded-md shadow-lg border border-line-subtle overflow-hidden"
        >
          <div className="py-1">
            <button
              onClick={handleMainButtonClick}
              disabled={disabled}
              className="w-full px-3 py-2 text-left text-sm text-fg-bright hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pick up 1
            </button>
            
            {showQuantityOptions && (
              <>
                <button
                  onClick={handlePickupHalf}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-left text-sm text-fg-bright hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pick up half
                </button>
                <button
                  onClick={handlePickupAll}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-left text-sm text-fg-bright hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pick up all
                </button>
              </>
            )}
            
            <div className="border-t border-line-subtle my-1" />
            
            <button
              onClick={handleExamine}
              disabled={disabled}
              className="w-full px-3 py-2 text-left text-sm text-fg-bright hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Examine {item.template.name}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

