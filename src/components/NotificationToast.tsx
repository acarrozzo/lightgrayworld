'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Notification } from '@/store/notificationStore'

type NotificationToastProps = {
  notification: Notification
  onDismiss: (id: string) => void
  fadeOutDuration?: number
}

const getOutcomeStyles = (outcome: string) => {
  switch (outcome) {
    case 'success':
      return {
        bg: 'bg-gray-900/95',
        border: 'border-emerald-500',
        text: 'text-gray-100',
        icon: 'text-emerald-400',
      }
    case 'failure':
      return {
        bg: 'bg-gray-900/95',
        border: 'border-red-500',
        text: 'text-gray-100',
        icon: 'text-red-400',
      }
    case 'info':
    default:
      return {
        bg: 'bg-gray-900/95',
        border: 'border-blue-500',
        text: 'text-gray-100',
        icon: 'text-blue-400',
      }
  }
}

export default function NotificationToast({ notification, onDismiss, fadeOutDuration = 300 }: NotificationToastProps) {
  const styles = getOutcomeStyles(notification.outcome)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Trigger initial slide-in animation
  useEffect(() => {
    // Small delay to ensure DOM is ready, then trigger animation
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  // Auto-dismiss with fade-out after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFadingOut(true)
      setTimeout(() => {
        onDismiss(notification.id)
      }, fadeOutDuration)
    }, 3000 - fadeOutDuration) // Start fading before removal

    return () => clearTimeout(timer)
  }, [notification.id, onDismiss, fadeOutDuration])

  const handleDismiss = () => {
    setIsFadingOut(true)
    setTimeout(() => {
      onDismiss(notification.id)
    }, fadeOutDuration)
  }

  return (
    <div
      className={`
        ${styles.bg} ${styles.border}
        border rounded-md shadow-sm backdrop-blur-sm
        px-3 py-2 min-w-[200px] max-w-[320px]
        flex items-start gap-2
        ${isFadingOut
          ? 'opacity-0 -translate-y-2 transition-all duration-300 ease-out'
          : isVisible
            ? 'opacity-100 translate-y-0 transition-all duration-300 ease-out'
            : 'opacity-0 -translate-y-2'
        }
      `}
      style={{
        animation: !isVisible ? 'slideInRight 0.25s ease-out forwards' : undefined,
      }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${styles.text} break-words leading-snug`}>
          {notification.message}
        </p>
        {notification.action && (
          <p className={`text-[10px] ${styles.icon} mt-0.5 opacity-70`}>
            {notification.action}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {notification.onUndo && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              notification.onUndo?.()
              handleDismiss()
            }}
            className={`
              text-xs font-medium px-2 py-1 rounded
              bg-gray-700/50 hover:bg-gray-600/70 text-gray-200 hover:text-white
              transition-colors
              focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30
            `}
            aria-label="Undo"
          >
            Undo
          </button>
        )}
        <button
          onClick={handleDismiss}
          className={`
            text-gray-500
            flex-shrink-0 p-0.5 rounded
            hover:bg-gray-800/40 hover:text-gray-300 transition-colors
            focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30
          `}
          aria-label="Dismiss notification"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

