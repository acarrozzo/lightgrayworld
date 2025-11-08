const redisUrl = process.env.REDIS_URL

let redisInstance = null
let redisPromise = null

const inMemoryStore = new Map()
const inMemorySets = new Map()

const NPC_RUNTIME_PREFIX = 'npc:runtime:'
const NPC_SPAWN_PREFIX = 'npc:spawn:'
const NPC_LEASH_PREFIX = 'npc:leash:'
const NPC_ROOM_SET_PREFIX = 'npc:room:'

function npcRuntimeKey(instanceId) {
  return `${NPC_RUNTIME_PREFIX}${instanceId}`
}

function npcSpawnKey(roomId) {
  return `${NPC_SPAWN_PREFIX}${roomId}`
}

function npcLeashKey(instanceId) {
  return `${NPC_LEASH_PREFIX}${instanceId}`
}

function npcRoomSetKey(roomId) {
  return `${NPC_ROOM_SET_PREFIX}${roomId}:instances`
}

async function loadRedisClient() {
  if (!redisUrl) {
    return null
  }

  if (redisInstance) {
    return redisInstance
  }

  if (!redisPromise) {
    redisPromise = (async () => {
      try {
        const RedisModule = await import('ioredis')
        const RedisClass = RedisModule.default || RedisModule
        const client = new RedisClass(redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        })

        client.on('error', (error) => {
          console.error('[Redis] Connection error', error)
        })

        await client.connect().catch((error) => {
          console.warn('[Redis] connect() failed, falling back to lazy usage', error.message)
        })

        redisInstance = client
        return client
      } catch (error) {
        console.error('[Redis] Failed to initialize client', error)
        return null
      }
    })()
  }

  return redisPromise
}

async function redisSet(key, value, ttlSeconds) {
  const client = await loadRedisClient()
  if (client) {
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, value, 'EX', ttlSeconds)
    } else {
      await client.set(key, value)
    }
    return
  }

  inMemoryStore.set(key, value)
  if (ttlSeconds) {
    const timeout = setTimeout(() => {
      inMemoryStore.delete(key)
    }, ttlSeconds * 1000)
    if (timeout.unref) timeout.unref()
  }
}

async function redisGet(key) {
  const client = await loadRedisClient()
  if (client) {
    const result = await client.get(key)
    return result
  }

  return inMemoryStore.get(key) ?? null
}

async function redisDel(...keys) {
  const client = await loadRedisClient()
  if (client) {
    if (keys.length === 1) {
      await client.del(keys[0])
    } else if (keys.length > 1) {
      await client.del(keys)
    }
    return
  }

  keys.forEach((key) => inMemoryStore.delete(key))
}

async function redisSAdd(key, ...members) {
  const client = await loadRedisClient()
  if (client) {
    if (members.length > 0) {
      await client.sadd(key, ...members)
    }
    return
  }

  if (!inMemorySets.has(key)) {
    inMemorySets.set(key, new Set())
  }
  const set = inMemorySets.get(key)
  members.forEach((member) => set.add(member))
}

async function redisSRem(key, ...members) {
  const client = await loadRedisClient()
  if (client) {
    if (members.length > 0) {
      await client.srem(key, ...members)
    }
    return
  }

  const set = inMemorySets.get(key)
  if (!set) return
  members.forEach((member) => set.delete(member))
}

async function redisSMembers(key) {
  const client = await loadRedisClient()
  if (client) {
    const members = await client.smembers(key)
    return members ?? []
  }

  const set = inMemorySets.get(key)
  return set ? Array.from(set) : []
}

async function setNPCState(state, ttlSeconds) {
  const serialized = JSON.stringify(state)
  await redisSet(npcRuntimeKey(state.instanceId), serialized, ttlSeconds)
  await redisSAdd(npcRoomSetKey(state.currentRoom), state.instanceId)
}

async function getNPCState(instanceId) {
  const raw = await redisGet(npcRuntimeKey(instanceId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed
  } catch (error) {
    console.error('[Redis] Failed to parse NPC state for', instanceId, error)
    return null
  }
}

async function deleteNPCState(instanceId, roomId) {
  await redisDel(npcRuntimeKey(instanceId))
  if (roomId) {
    await redisSRem(npcRoomSetKey(roomId), instanceId)
  }
}

async function getActiveNPCs(roomId) {
  if (roomId) {
    return redisSMembers(npcRoomSetKey(roomId))
  }

  const client = await loadRedisClient()
  if (client) {
    const scanResults = []
    let cursor = '0'
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${NPC_RUNTIME_PREFIX}*`, 'COUNT', 100)
      scanResults.push(...keys.map((key) => key.replace(NPC_RUNTIME_PREFIX, '')))
      cursor = nextCursor
    } while (cursor !== '0')
    return scanResults
  }

  return Array.from(inMemoryStore.keys())
    .filter((key) => key.startsWith(NPC_RUNTIME_PREFIX))
    .map((key) => key.replace(NPC_RUNTIME_PREFIX, ''))
}

async function setSpawnTimer(roomId, timer) {
  await redisSet(npcSpawnKey(roomId), JSON.stringify(timer))
}

async function getSpawnTimer(roomId) {
  const raw = await redisGet(npcSpawnKey(roomId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error('[Redis] Failed to parse spawn timer for room', roomId, error)
    return null
  }
}

async function setLeashState(instanceId, state, ttlSeconds = 20) {
  await redisSet(npcLeashKey(instanceId), JSON.stringify(state), ttlSeconds)
}

async function getLeashState(instanceId) {
  const raw = await redisGet(npcLeashKey(instanceId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error('[Redis] Failed to parse leash state for', instanceId, error)
    return null
  }
}

async function clearLeashState(instanceId) {
  await redisDel(npcLeashKey(instanceId))
}

async function addNPCToRoom(roomId, instanceId) {
  await redisSAdd(npcRoomSetKey(roomId), instanceId)
}

async function removeNPCFromRoom(roomId, instanceId) {
  await redisSRem(npcRoomSetKey(roomId), instanceId)
}

async function shutdownRedis() {
  if (redisInstance) {
    await redisInstance.quit().catch((error) => {
      console.warn('[Redis] Failed to quit cleanly', error)
    })
    redisInstance = null
    redisPromise = null
  }
}

module.exports = {
  setNPCState,
  getNPCState,
  deleteNPCState,
  getActiveNPCs,
  setSpawnTimer,
  getSpawnTimer,
  setLeashState,
  getLeashState,
  clearLeashState,
  addNPCToRoom,
  removeNPCFromRoom,
  shutdownRedis,
}

