const { prisma } = require('../db-client.js')
const { getSocketIO, SOCKET_EVENTS } = require('../socket-utils.js')

const WORLD_FEED_EVENT_TYPES = ['login', 'logout', 'disconnect', 'register', 'idle', 'return']
const DEFAULT_LIMIT = 50

const EVENT_MESSAGE_BUILDERS = {
  register: (username) => `Welcome ${username} to the world!`,
  login: (username) => `${username} has logged in`,
  logout: (username) => `${username} has logged out`,
  disconnect: (username) => `${username} has disconnected`,
  idle: (username) => `${username} is now idle`,
  return: (username) => `${username} has returned`,
}

function normalizeEventType(eventType) {
  if (!eventType) {
    throw new Error('eventType is required')
  }

  const normalized = eventType.toLowerCase()
  if (!WORLD_FEED_EVENT_TYPES.includes(normalized)) {
    throw new Error(`Unsupported world feed event type: ${eventType}`)
  }

  return normalized
}

function formatWorldFeedEventMessage(eventType, username) {
  const safeName = username || 'Unknown'
  const builder = EVENT_MESSAGE_BUILDERS[eventType]
  if (builder) {
    return builder(safeName)
  }
  return `${safeName} performed ${eventType}`
}

function eventToFeedEntry(record) {
  if (!record) {
    return null
  }

  return {
    id: record.id,
    ts: record.timestamp instanceof Date ? record.timestamp.getTime() : new Date(record.timestamp).getTime(),
    type: 'world',
    level: 'info',
    actor: record.username,
    message: formatWorldFeedEventMessage(record.eventType, record.username),
    eventType: record.eventType,
  }
}

async function resolveUsername(userId, username) {
  if (username) {
    return username
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  })

  return user?.username || 'Unknown'
}

function broadcastWorldFeedEntry(entry) {
  const io = getSocketIO()
  if (!io || !entry) {
    return false
  }

  const eventName = (SOCKET_EVENTS && SOCKET_EVENTS.WORLD_ACTIVITY) || 'world:activity'
  io.emit(eventName, entry)
  return true
}

async function createWorldFeedEvent({ userId, username, eventType }) {
  if (!userId) {
    throw new Error('userId is required to create world feed events')
  }

  const normalizedType = normalizeEventType(eventType)
  const resolvedUsername = await resolveUsername(userId, username)

  const record = await prisma.worldFeedEvent.create({
    data: {
      userId,
      username: resolvedUsername,
      eventType: normalizedType,
    },
  })

  const entry = eventToFeedEntry(record)
  broadcastWorldFeedEntry(entry)

  return entry
}

async function getRecentWorldFeedEvents(limit = DEFAULT_LIMIT) {
  const safeLimit = Math.max(1, Math.min(limit, 200))
  const records = await prisma.worldFeedEvent.findMany({
    orderBy: { timestamp: 'desc' },
    take: safeLimit,
  })

  return records.reverse().map(eventToFeedEntry).filter(Boolean)
}

module.exports = {
  WORLD_FEED_EVENT_TYPES,
  DEFAULT_LIMIT,
  EVENT_MESSAGE_BUILDERS,
  formatWorldFeedEventMessage,
  createWorldFeedEvent,
  getRecentWorldFeedEvents,
  eventToFeedEntry,
  broadcastWorldFeedEntry,
}

