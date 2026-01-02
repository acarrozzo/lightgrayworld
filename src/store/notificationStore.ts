'use client'

import { create } from 'zustand'
import type { ActionFeedbackOutcome } from '../lib/socket'

export type Notification = {
  id: string
  message: string
  outcome: ActionFeedbackOutcome
  action?: string
  ts: number
  onUndo?: () => void
}

type NotificationState = {
  userId: string | null
  enabled: boolean
  notifications: Notification[]
  setUser: (userId: string | null) => void
  setEnabled: (enabled: boolean) => void
  addNotification: (notification: Omit<Notification, 'id' | 'ts'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

const MAX_NOTIFICATIONS = 5
const NOTIFICATION_DURATION_MS = 3000

const getSettingsKey = (userId: string | null) => (userId ? `notifications:${userId}` : null)

const loadSettings = (userId: string | null): boolean => {
  if (!userId || typeof window === 'undefined') return true // Default to enabled
  const key = getSettingsKey(userId)
  if (!key) return true
  
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      return typeof parsed.enabled === 'boolean' ? parsed.enabled : true
    }
  } catch {
    // Ignore parse errors, use default
  }
  
  return true // Default to enabled
}

const persistSettings = (userId: string | null, enabled: boolean) => {
  if (!userId || typeof window === 'undefined') return
  const key = getSettingsKey(userId)
  if (!key) return
  
  try {
    localStorage.setItem(key, JSON.stringify({ enabled }))
  } catch {
    // Ignore storage errors
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  userId: null,
  enabled: true,
  notifications: [],

  setUser: (userId) => {
    const enabled = loadSettings(userId)
    set({ userId, enabled })
  },

  setEnabled: (enabled) => {
    const { userId } = get()
    set({ enabled })
    persistSettings(userId, enabled)
  },

  addNotification: (notification) => {
    const { notifications, enabled } = get()
    
    if (!enabled) return
    
    const id = crypto.randomUUID ? crypto.randomUUID() : `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newNotification: Notification = {
      ...notification,
      id,
      ts: Date.now(),
    }
    
    // Limit to max notifications, remove oldest if needed
    const updatedNotifications = [...notifications, newNotification]
    const trimmedNotifications = updatedNotifications.length > MAX_NOTIFICATIONS
      ? updatedNotifications.slice(updatedNotifications.length - MAX_NOTIFICATIONS)
      : updatedNotifications
    
    set({ notifications: trimmedNotifications })
    
    // Note: Auto-dismiss is handled by the NotificationToast component
    // This timeout is kept as a safety net to prevent memory leaks
    setTimeout(() => {
      const currentNotifications = get().notifications
      if (currentNotifications.some((n) => n.id === id)) {
        get().removeNotification(id)
      }
    }, NOTIFICATION_DURATION_MS + 500) // Add buffer for fade-out
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  clearNotifications: () => {
    set({ notifications: [] })
  },
}))

