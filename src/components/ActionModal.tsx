'use client'

import React from 'react'
import Icon from './Icon'

interface ActionModalButton {
  label: string
  direction: string
  closeOnAction?: boolean
  primary?: boolean
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
  const handleButtonClick = (direction: string, closeOnAction: boolean = true) => {
    if (onAction) {
      onAction(direction)
    }
    if (closeOnAction) {
      onClose()
    }
  }

  // Handle button clicks in content using event delegation
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const button = target.closest('button[data-direction]')
    if (button) {
      const direction = button.getAttribute('data-direction')
      const closeOnAction = button.getAttribute('data-close-on-action') !== 'false'
      if (direction) {
        handleButtonClick(direction, closeOnAction)
      }
    }
  }

  if (!isOpen) {
    return null
  }

  const isStringContent = typeof content === 'string'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-sunken/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex h-auto max-h-[85vh] w-[90vw] max-w-3xl flex-col overflow-hidden rounded-lg border border-line-subtle/50 bg-surface-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-line-subtle/50 px-4 py-3">
          <h2 className="text-lg font-semibold text-fg-bright">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-fg-secondary transition-colors hover:text-fg-bright hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
            aria-label="Close modal"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div 
          className="flex-1 overflow-y-auto px-4 py-4 min-h-[240px]"
          onClick={handleContentClick}
        >
          {isStringContent ? (
            <div className="prose prose-invert max-w-none">
              <p className="text-fg-bright whitespace-pre-wrap leading-relaxed text-sm">
                {content}
              </p>
            </div>
          ) : (
            <div className="max-w-none">
              {content}
            </div>
          )}
        </div>

        <div className="border-t border-line-subtle/50 px-4 py-3 flex items-center justify-center gap-2">
          {buttons && buttons.length > 0 ? (
            buttons.map((button, index) => (
              <button
                key={index}
                type="button"
                data-direction={button.direction}
                data-close-on-action={button.closeOnAction !== false}
                onClick={() => handleButtonClick(button.direction, button.closeOnAction !== false)}
                className={button.primary
                  ? "rounded bg-resource-mp/80 px-6 py-2 text-base font-semibold text-fg-bright transition-colors hover:bg-resource-mp focus:outline-none focus-visible:ring-2 focus-visible:ring-resource-mp focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
                  : "rounded bg-surface-hover px-4 py-1.5 text-sm font-medium text-fg-bright transition-colors hover:bg-surface-selected focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
                }
              >
                {button.label}
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-surface-hover px-4 py-1.5 text-sm font-medium text-fg-bright transition-colors hover:bg-surface-selected focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

