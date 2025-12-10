'use client'

import { useState, ReactNode } from 'react'
import Icon from './Icon'

export interface TabConfig {
  id: string
  label: string
  icon?: string
  color?: string
  content: ReactNode | ((isActive: boolean) => ReactNode)
}

interface TabContainerProps {
  tabs: TabConfig[]
  defaultTab?: string
  onClose?: () => void
  closeButtonPlacement?: 'integrated' | 'separate'
  closeButtonBreakpoint?: 'lg' | 'xl'
  headerClassName?: string
  contentClassName?: string
  containerClassName?: string
  buttonPadding?: string
}

export default function TabContainer({
  tabs,
  defaultTab,
  onClose,
  closeButtonPlacement = 'separate',
  closeButtonBreakpoint = 'xl',
  headerClassName = '',
  contentClassName = '',
  containerClassName = '',
  buttonPadding = 'px-3 py-2',
}: TabContainerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  const breakpointClass = closeButtonBreakpoint === 'lg' ? 'lg:hidden' : 'xl:hidden'

  const renderTabContent = () => {
    const activeTabConfig = tabs.find(tab => tab.id === activeTab)
    if (!activeTabConfig) return null

    const content = activeTabConfig.content
    if (typeof content === 'function') {
      return content(activeTab === activeTabConfig.id)
    }
    return content
  }

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${containerClassName}`}>
      {/* Mobile close button - separate placement */}
      {onClose && closeButtonPlacement === 'separate' && (
        <div className={`${breakpointClass} flex justify-end p-2 border-b border-gray-800/50`}>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
            title="Close"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className={`flex border-b border-gray-800/50 bg-gray-900/95 backdrop-blur-sm flex-shrink-0 ${headerClassName}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 ${buttonPadding} text-sm font-medium transition-all duration-200 flex items-center justify-center ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-indigo-500/80 bg-gray-900/50'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            {tab.icon && (
              <Icon 
                name={tab.icon} 
                size={16} 
                color={tab.color} 
                className="mr-1" 
              />
            )}
            {tab.label}
          </button>
        ))}
        
        {/* Mobile close button - integrated placement */}
        {onClose && closeButtonPlacement === 'integrated' && (
          <button
            onClick={onClose}
            className={`${breakpointClass} p-3 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50`}
            title="Close"
          >
            <Icon name="x" size={20} />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className={`flex-1 flex flex-col overflow-hidden min-h-0 ${contentClassName}`}>
        {renderTabContent()}
      </div>
    </div>
  )
}

