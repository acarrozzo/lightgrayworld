'use client'

import { useState, ReactNode, useEffect } from 'react'
import Icon from './Icon'

export interface TabConfig {
  id: string
  label: string
  icon?: string | ReactNode
  color?: string
  content: ReactNode | ((isActive: boolean) => ReactNode)
  badge?: boolean | number
}

interface TabContainerProps {
  tabs: TabConfig[]
  defaultTab?: string | null
  onClose?: () => void
  onTabChange?: (tabId: string | null) => void
  closeButtonPlacement?: 'integrated' | 'separate'
  closeButtonBreakpoint?: 'lg' | 'xl'
  headerClassName?: string
  contentClassName?: string
  containerClassName?: string
  buttonPadding?: string
  rightElement?: ReactNode
}

export default function TabContainer({
  tabs,
  defaultTab,
  onClose,
  onTabChange,
  closeButtonPlacement = 'separate',
  closeButtonBreakpoint = 'xl',
  headerClassName = '',
  contentClassName = '',
  containerClassName = '',
  buttonPadding = 'px-2.5 py-1.5',
  rightElement,
}: TabContainerProps) {
  const [activeTab, setActiveTab] = useState<string | null>(defaultTab ?? tabs[0]?.id ?? null)

  const handleTabChange = (tabId: string) => {
    // Toggle behavior: if clicking the active tab, close it (set to null)
    const newActiveTab = activeTab === tabId ? null : tabId
    setActiveTab(newActiveTab)
    onTabChange?.(newActiveTab)
  }

  // Sync initial tab state with parent on mount
  useEffect(() => {
    const initialTab = defaultTab ?? tabs[0]?.id ?? null
    onTabChange?.(initialTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  const breakpointClass = closeButtonBreakpoint === 'lg' ? 'lg:hidden' : 'xl:hidden'

  const getButtonColorClasses = (tab: TabConfig, isActive: boolean) => {
    const color = tab.color || 'blue'
    
    if (isActive) {
      switch (color) {
        case 'blue':
          return 'border-1 border-blue-500 hover:border-blue-400 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300'
        case 'green':
          return 'border-1 border-green-500 hover:border-green-400 bg-green-500/10 hover:bg-green-500/20 text-green-300'
        case 'purple':
          return 'border-1 border-purple-500 hover:border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300'
        case 'gold':
          return 'border-1 border-amber-500 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
        case 'red':
          return 'border-1 border-red-500 hover:border-red-400 bg-red-500/10 hover:bg-red-500/20 text-red-300'
        default:
          return 'border-1 border-indigo-500 hover:border-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300'
      }
    } else {
      return 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
    }
  }

  const renderTabContent = () => {
    if (!activeTab) return null
    
    const activeTabConfig = tabs.find(tab => tab.id === activeTab)
    if (!activeTabConfig) return null

    const content = activeTabConfig.content
    if (typeof content === 'function') {
      return content(activeTab === activeTabConfig.id)
    }
    return content
  }

  // Determine if headerClassName overrides padding
  const hasPaddingOverride = headerClassName && /p[xy]?-[0-9]|p-0/.test(headerClassName)
  const defaultHeaderPadding = hasPaddingOverride ? 'pb-4' : 'p-4'

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${containerClassName}`}>
      {/* Tab Navigation */}
      <div className={`flex gap-2 ${defaultHeaderPadding} bg-gray-900/95 backdrop-blur-sm flex-shrink-0 flex-wrap items-center ${headerClassName}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`${buttonPadding} text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow ${getButtonColorClasses(tab, isActive)}`}
            >
              {tab.icon && (
                typeof tab.icon === 'string' ? (
                  <Icon 
                    name={tab.icon} 
                    size={14} 
                    color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color)} 
                    className="mr-1" 
                  />
                ) : (
                  <span className="mr-1">{tab.icon}</span>
                )
              )}
              {tab.label}
              {tab.badge && (
                <span className={`absolute -top-1 -right-1 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center ${
                  typeof tab.badge === 'number' 
                    ? 'min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white' 
                    : 'w-2 h-2'
                }`}>
                  {typeof tab.badge === 'number' && tab.badge > 0 ? (tab.badge > 99 ? '99+' : tab.badge) : ''}
                </span>
              )}
            </button>
          )
        })}
        
        {/* Right side elements */}
        <div className="ml-auto flex items-center gap-2">
          {rightElement}
          {/* Close button - on same row as tabs */}
          {onClose && (
            <button
              onClick={onClose}
              className={`${closeButtonPlacement === 'separate' ? breakpointClass : ''} p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50`}
              title="Close"
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab && (
        <div className={`flex-1 flex flex-col overflow-y-auto min-h-0 ${contentClassName}`}>
          {renderTabContent()}
        </div>
      )}
    </div>
  )
}

