'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import Icon from './Icon'
import { getTabIconColorClass } from '@/lib/tabColors'
import type { TabConfig } from './TabContainer'

interface MobileBottomNavProps {
  tabs: TabConfig[]
  activeTab: string | null
  onTabChange: (tabId: string | null) => void
  fallbackLabels?: Record<string, string>
  overflowAfter?: number
}

const ICON_SIZE = 24

function renderTabIcon(tab: TabConfig, isActive: boolean, iconColorClass: string) {
  if (!tab.icon) return null
  if (typeof tab.icon === 'string') {
    return (
      <Icon
        name={tab.icon}
        size={ICON_SIZE}
        color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color === 'sky' ? 'sky' : tab.color)}
      />
    )
  }
  return (
    <span className={iconColorClass}>
      {React.cloneElement(tab.icon as React.ReactElement<any>, {
        size: ICON_SIZE,
        className: `${iconColorClass} ${((tab.icon as React.ReactElement<any>).props as any)?.className || ''}`.trim(),
      })}
    </span>
  )
}

function renderBadge(badge: TabConfig['badge']) {
  if (!badge) return null
  return (
    <span
      className={`absolute top-0.5 right-1 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center ${
        typeof badge === 'number'
          ? 'min-w-[16px] h-[16px] px-1 text-[9px] font-semibold text-white'
          : 'w-2 h-2'
      }`}
    >
      {typeof badge === 'number' && badge > 0 ? (badge > 99 ? '99+' : badge) : ''}
    </span>
  )
}

export default function MobileBottomNav({
  tabs,
  activeTab,
  onTabChange,
  fallbackLabels,
  overflowAfter,
}: MobileBottomNavProps) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasOverflow = typeof overflowAfter === 'number' && overflowAfter < tabs.length
  const primaryTabs = hasOverflow ? tabs.slice(0, overflowAfter) : tabs
  const overflowTabs = hasOverflow ? tabs.slice(overflowAfter) : []

  const activeOverflowTab = overflowTabs.find((t) => t.id === activeTab) || null
  const isOverflowActive = activeOverflowTab !== null
  const overflowHasBadge = overflowTabs.some((t) => !!t.badge)

  const resolveLabel = (tab: TabConfig) => tab.label || fallbackLabels?.[tab.id] || ''

  const handleClick = (tabId: string) => {
    onTabChange(activeTab === tabId ? null : tabId)
  }

  const handleOverflowItemClick = (tabId: string) => {
    handleClick(tabId)
    setIsOverflowOpen(false)
  }

  useEffect(() => {
    if (!isOverflowOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOverflowOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOverflowOpen])

  const moreColor = activeOverflowTab?.color || 'gray'
  const moreIconColorClass = getTabIconColorClass(moreColor, isOverflowActive)
  const moreActiveRingClass = isOverflowActive
    ? 'before:absolute before:top-0 before:left-3 before:right-3 before:h-[3px] before:rounded-full before:bg-current'
    : ''
  const moreLabel = isOverflowActive && activeOverflowTab
    ? resolveLabel(activeOverflowTab) || 'More'
    : 'More'

  return (
    <div
      ref={containerRef}
      className="flex-shrink-0 relative bg-gray-900/98 backdrop-blur-md border-t border-gray-700/30 shadow-[0_-4px_16px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      {isOverflowOpen && (
        <div
          role="menu"
          aria-label="More navigation"
          className="absolute bottom-full right-2 mb-2 min-w-[180px] bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-lg shadow-lg overflow-hidden z-50"
        >
          {overflowTabs.map((tab) => {
            const isActive = activeTab === tab.id
            const label = resolveLabel(tab) || tab.id
            const iconColorClass = getTabIconColorClass(tab.color, isActive)
            return (
              <button
                key={tab.id}
                role="menuitem"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleOverflowItemClick(tab.id)}
                className={`relative w-full flex items-center gap-3 px-4 min-h-[48px] text-left transition-colors duration-150 ${iconColorClass} ${
                  isActive ? 'bg-gray-800/60' : 'hover:bg-gray-800/40'
                }`}
              >
                <span className="relative flex items-center justify-center w-6 h-6">
                  {renderTabIcon(tab, isActive, iconColorClass)}
                </span>
                <span className={`text-sm ${isActive ? '' : 'text-gray-300'}`}>{label}</span>
                {tab.badge && (
                  <span className="ml-auto flex items-center">
                    {typeof tab.badge === 'number' ? (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <nav
        role="tablist"
        aria-label="Main navigation"
        className="flex items-stretch"
      >
        {primaryTabs.map((tab) => {
          const isActive = activeTab === tab.id
          const label = resolveLabel(tab)
          const iconColorClass = getTabIconColorClass(tab.color, isActive)
          const activeRingClass = isActive
            ? 'before:absolute before:top-0 before:left-3 before:right-3 before:h-[3px] before:rounded-full before:bg-current'
            : ''

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => handleClick(tab.id)}
              className={`relative flex-1 min-w-0 min-h-[64px] flex flex-col items-center justify-center gap-1.5 px-1 py-2 transition-colors duration-150 ${iconColorClass} ${activeRingClass} ${
                isActive ? '' : 'hover:bg-gray-800/40'
              }`}
            >
              {renderTabIcon(tab, isActive, iconColorClass)}
              <span className={`text-[12px] leading-none truncate max-w-full ${isActive ? '' : 'text-gray-400'}`}>
                {label}
              </span>
              {renderBadge(tab.badge)}
            </button>
          )
        })}

        {hasOverflow && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOverflowOpen}
            aria-label={isOverflowActive ? `More — ${moreLabel} active` : 'More'}
            onClick={() => setIsOverflowOpen((v) => !v)}
            className={`relative flex-1 min-w-0 min-h-[64px] flex flex-col items-center justify-center gap-1.5 px-1 py-2 transition-colors duration-150 ${moreIconColorClass} ${moreActiveRingClass} ${
              isOverflowActive ? '' : 'hover:bg-gray-800/40'
            }`}
          >
            <MoreHorizontal size={ICON_SIZE} className={moreIconColorClass} />
            <span className={`text-[12px] leading-none truncate max-w-full ${isOverflowActive ? '' : 'text-gray-400'}`}>
              {moreLabel}
            </span>
            {!isOverflowActive && overflowHasBadge && (
              <span className="absolute top-0.5 right-1 w-2 h-2 bg-red-500 rounded-full border border-gray-900" />
            )}
          </button>
        )}
      </nav>
    </div>
  )
}
