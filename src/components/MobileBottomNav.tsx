'use client'

import React from 'react'
import Icon from './Icon'
import { getTabIconColorClass } from '@/lib/tabColors'
import type { TabConfig } from './TabContainer'

interface MobileBottomNavProps {
  tabs: TabConfig[]
  activeTab: string | null
  onTabChange: (tabId: string | null) => void
  fallbackLabels?: Record<string, string>
}

export default function MobileBottomNav({
  tabs,
  activeTab,
  onTabChange,
  fallbackLabels,
}: MobileBottomNavProps) {
  const handleClick = (tabId: string) => {
    onTabChange(activeTab === tabId ? null : tabId)
  }

  return (
    <nav
      role="tablist"
      aria-label="Main navigation"
      className="md:hidden flex-shrink-0 flex items-stretch bg-gray-900/95 backdrop-blur-sm border-t border-gray-800/60 pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const label = tab.label || fallbackLabels?.[tab.id] || ''
        const iconColorClass = getTabIconColorClass(tab.color, isActive)
        const activeRingClass = isActive
          ? 'before:absolute before:top-0 before:left-2 before:right-2 before:h-0.5 before:rounded-full before:bg-current'
          : ''

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={() => handleClick(tab.id)}
            className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors duration-150 ${iconColorClass} ${activeRingClass} ${
              isActive ? '' : 'hover:bg-gray-800/40'
            }`}
          >
            {tab.icon && (
              typeof tab.icon === 'string' ? (
                <Icon
                  name={tab.icon}
                  size={20}
                  color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color === 'sky' ? 'sky' : tab.color)}
                />
              ) : (
                <span className={iconColorClass}>
                  {React.cloneElement(tab.icon as React.ReactElement<any>, {
                    size: 20,
                    className: `${iconColorClass} ${((tab.icon as React.ReactElement<any>).props as any)?.className || ''}`.trim(),
                  })}
                </span>
              )
            )}
            <span className={`text-[10px] leading-none truncate max-w-full ${isActive ? '' : 'text-gray-400'}`}>
              {label}
            </span>
            {tab.badge && (
              <span
                className={`absolute top-0.5 right-1 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center ${
                  typeof tab.badge === 'number'
                    ? 'min-w-[16px] h-[16px] px-1 text-[9px] font-semibold text-white'
                    : 'w-2 h-2'
                }`}
              >
                {typeof tab.badge === 'number' && tab.badge > 0 ? (tab.badge > 99 ? '99+' : tab.badge) : ''}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
