'use client'

import { create } from 'zustand'

export type DMUserSummary = {
  id: string
  username: string
  level?: number
  uIcon?: string | null
  uIconColor?: string | null
}

export type DMThread = {
  threadId?: string
  otherUser: DMUserSummary
  lastMessageSnippet: string
  lastMessageAt: string
  unreadCount: number
}

export type DMMessage = {
  id: string
  senderId: string
  senderUsername?: string
  recipientId: string
  recipientUsername?: string
  message: string
  createdAt: string
  readAt?: string | null
}

type DMState = {
  userId: string | null
  threadsByUserId: Record<string, DMThread>
  messagesByUserId: Record<string, DMMessage[]>
  selectedThreadUserId: string | null
  setUser: (userId: string | null) => void
  setThreads: (threads: DMThread[]) => void
  upsertThread: (thread: DMThread) => void
  setMessages: (otherUserId: string, messages: DMMessage[]) => void
  appendMessage: (message: DMMessage, currentUserId: string) => void
  markThreadRead: (otherUserId: string) => void
  setSelectedThread: (otherUserId: string | null) => void
  getSortedThreads: () => DMThread[]
  getTotalUnreadCount: () => number
}

const ensureIsoDate = (value?: string) => value || new Date().toISOString()

const mergeThread = (existing: DMThread | undefined, incoming: DMThread): DMThread => {
  if (!existing) return incoming

  const existingAt = new Date(existing.lastMessageAt).getTime()
  const incomingAt = new Date(incoming.lastMessageAt).getTime()

  return {
    ...existing,
    ...incoming,
    otherUser: { ...existing.otherUser, ...incoming.otherUser },
    lastMessageAt: incomingAt >= existingAt ? incoming.lastMessageAt : existing.lastMessageAt,
    lastMessageSnippet: incomingAt >= existingAt ? incoming.lastMessageSnippet : existing.lastMessageSnippet,
    unreadCount: incoming.unreadCount,
  }
}

export const useDMStore = create<DMState>((set, get) => ({
  userId: null,
  threadsByUserId: {},
  messagesByUserId: {},
  selectedThreadUserId: null,

  setUser: (userId) => {
    set({
      userId,
      threadsByUserId: {},
      messagesByUserId: {},
      selectedThreadUserId: null,
    })
  },

  setThreads: (threads) => {
    set((state) => {
      const nextThreads = { ...state.threadsByUserId }
      for (const thread of threads) {
        nextThreads[thread.otherUser.id] = mergeThread(nextThreads[thread.otherUser.id], thread)
      }
      return { threadsByUserId: nextThreads }
    })
  },

  upsertThread: (thread) => {
    set((state) => ({
      threadsByUserId: {
        ...state.threadsByUserId,
        [thread.otherUser.id]: mergeThread(state.threadsByUserId[thread.otherUser.id], thread),
      },
    }))
  },

  setMessages: (otherUserId, messages) => {
    set((state) => ({
      messagesByUserId: {
        ...state.messagesByUserId,
        [otherUserId]: messages,
      },
    }))
  },

  appendMessage: (message, currentUserId) => {
    const otherUserId = message.senderId === currentUserId ? message.recipientId : message.senderId
    set((state) => {
      const existingMessages = state.messagesByUserId[otherUserId] || []
      const dedupedMessages = existingMessages.some((existing) => existing.id === message.id)
        ? existingMessages
        : [...existingMessages, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )

      const existingThread = state.threadsByUserId[otherUserId]
      const isIncoming = message.senderId !== currentUserId
      const unreadCount =
        state.selectedThreadUserId === otherUserId
          ? 0
          : (existingThread?.unreadCount || 0) + (isIncoming ? 1 : 0)
      const fallbackUsername = isIncoming ? message.senderUsername : message.recipientUsername
      const nextThread: DMThread = {
        threadId: existingThread?.threadId,
        otherUser: {
          id: otherUserId,
          username: fallbackUsername || existingThread?.otherUser.username || 'Unknown Player',
          level: existingThread?.otherUser.level,
          uIcon: existingThread?.otherUser.uIcon,
          uIconColor: existingThread?.otherUser.uIconColor,
        },
        lastMessageSnippet: message.message.length > 120 ? `${message.message.slice(0, 119)}...` : message.message,
        lastMessageAt: ensureIsoDate(message.createdAt),
        unreadCount,
      }

      return {
        messagesByUserId: {
          ...state.messagesByUserId,
          [otherUserId]: dedupedMessages,
        },
        threadsByUserId: {
          ...state.threadsByUserId,
          [otherUserId]: mergeThread(existingThread, nextThread),
        },
      }
    })
  },

  markThreadRead: (otherUserId) => {
    set((state) => {
      const existing = state.threadsByUserId[otherUserId]
      if (!existing) return {}
      return {
        threadsByUserId: {
          ...state.threadsByUserId,
          [otherUserId]: {
            ...existing,
            unreadCount: 0,
          },
        },
      }
    })
  },

  setSelectedThread: (otherUserId) => {
    set((state) => {
      if (!otherUserId) {
        return { selectedThreadUserId: null }
      }
      const existing = state.threadsByUserId[otherUserId]
      return {
        selectedThreadUserId: otherUserId,
        threadsByUserId: existing
          ? {
              ...state.threadsByUserId,
              [otherUserId]: {
                ...existing,
                unreadCount: 0,
              },
            }
          : state.threadsByUserId,
      }
    })
  },

  getSortedThreads: () => {
    const threads = Object.values(get().threadsByUserId)
    return threads.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )
  },

  getTotalUnreadCount: () =>
    Object.values(get().threadsByUserId).reduce((sum, thread) => sum + thread.unreadCount, 0),
}))
