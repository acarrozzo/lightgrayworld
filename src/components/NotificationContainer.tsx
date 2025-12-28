'use client'

import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import NotificationToast from './NotificationToast'

export default function NotificationContainer() {
  const notifications = useNotificationStore((state) => state.notifications)
  const removeNotification = useNotificationStore((state) => state.removeNotification)

  if (notifications.length === 0) {
    return null
  }

  return (
    <div
      className="fixed top-3 right-4 z-50 flex flex-col gap-1.5 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationToast
            notification={notification}
            onDismiss={removeNotification}
          />
        </div>
      ))}
    </div>
  )
}

