'use client'

import React from 'react'
import { X } from 'lucide-react'
import type { Notification } from '@/store/notificationStore'

type NotificationToastProps = {
  notification: Notification
  onDismiss: (id: string) => void
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

export default function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const styles = getOutcomeStyles(notification.outcome)

  return (
    <div
      className={`
        ${styles.bg} ${styles.border}
        border-2 rounded-lg shadow-lg backdrop-blur-sm
        px-4 py-3 min-w-[280px] max-w-[400px]
        flex items-start gap-3
        animate-[slideIn_0.3s_ease-out_forwards]
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${styles.text} break-words`}>
          {notification.message}
        </p>
        {notification.action && (
          <p className={`text-xs ${styles.icon} mt-1 opacity-80`}>
            {notification.action}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className={`
          text-gray-400
          flex-shrink-0 p-1 rounded-md
          hover:bg-gray-800/50 hover:text-gray-200 transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50
        `}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}

