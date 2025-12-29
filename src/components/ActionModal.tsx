'use client'

import React from 'react'
import Icon from './Icon'

interface ActionModalButton {
  label: string
  direction: string
}

interface ActionModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string | React.ReactNode
  buttons?: ActionModalButton[]
  onAction?: (direction: string) => void
}

export default function ActionModal({
  isOpen,
  onClose,
  title,
  content,
  buttons,
  onAction,
}: ActionModalProps) {
  const handleButtonClick = (direction: string) => {
    if (onAction) {
      onAction(direction)
    }
    onClose()
  }

  // Handle button clicks in content using event delegation
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const button = target.closest('button[data-direction]')
    if (button) {
      const direction = button.getAttribute('data-direction')
      if (direction) {
        handleButtonClick(direction)
      }
    }
  }

  if (!isOpen) {
    return null
  }

  const isStringContent = typeof content === 'string'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex h-[90vh] w-[90vw] max-w-4xl flex-col overflow-hidden rounded-2xl border border-purple-500/40 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            aria-label="Close modal"
          >
            <Icon name="x" size={24} />
          </button>
        </div>

        <div 
          className="flex-1 overflow-y-auto px-6 py-6"
          onClick={handleContentClick}
        >
          {isStringContent ? (
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                {content}
              </p>
            </div>
          ) : (
            <div className="max-w-none">
              {content}
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

