import type { WorldFeedEvent } from '@prisma/client'

export type WorldFeedEventType = 'login' | 'logout' | 'disconnect' | 'register' | 'idle' | 'return'
const service = require('./world-feed-event-service.js') as {
  WORLD_FEED_EVENT_TYPES: readonly WorldFeedEventType[]
  DEFAULT_LIMIT: number
  formatWorldFeedEventMessage: (eventType: WorldFeedEventType, username?: string) => string
  createWorldFeedEvent: (input: CreateWorldFeedEventInput) => Promise<WorldFeedActivityEntry>
  getRecentWorldFeedEvents: (limit?: number) => Promise<WorldFeedActivityEntry[]>
  eventToFeedEntry: (record: WorldFeedEvent | null) => WorldFeedActivityEntry | null
  broadcastWorldFeedEntry: (entry: WorldFeedActivityEntry | null) => boolean
}

export type WorldFeedActivityEntry = {
  id: string
  ts: number
  type: 'world'
  level?: 'info' | 'error'
  actor?: string
  message: string
  eventType: WorldFeedEventType
}

export type CreateWorldFeedEventInput = {
  userId: string
  username?: string
  eventType: WorldFeedEventType
}

export const WORLD_FEED_EVENT_TYPES = service.WORLD_FEED_EVENT_TYPES as readonly WorldFeedEventType[]
export const WORLD_FEED_DEFAULT_LIMIT = service.DEFAULT_LIMIT

export const formatWorldFeedEventMessage = (eventType: WorldFeedEventType, username?: string) => {
  return service.formatWorldFeedEventMessage(eventType, username)
}

export const createWorldFeedEvent = (input: CreateWorldFeedEventInput) => {
  return service.createWorldFeedEvent(input)
}

export const getRecentWorldFeedEvents = (limit?: number) => {
  return service.getRecentWorldFeedEvents(limit)
}

export const eventToFeedEntry = (record: WorldFeedEvent | null) => {
  return service.eventToFeedEntry(record)
}

export const broadcastWorldFeedEntry = (entry: WorldFeedActivityEntry | null) => {
  return service.broadcastWorldFeedEntry(entry)
}

