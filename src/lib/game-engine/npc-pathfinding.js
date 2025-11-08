const { PrismaClient } = require('@prisma/client')

const NEIGHBOR_FIELDS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
]

class NPCPathfinder {
  /**
   * @param {object} options
   * @param {PrismaClient} options.prisma
   * @param {number} [options.maxDepth]
   * @param {number} [options.cacheTtlMs]
   */
  constructor({ prisma, maxDepth = 10, cacheTtlMs = 5_000 }) {
    this.prisma = prisma
    this.maxDepth = maxDepth
    this.cacheTtlMs = cacheTtlMs

    /** @type {Map<string, { expiresAt: number, path: string[] | null }>} */
    this.pathCache = new Map()
    /** @type {Map<string, { expiresAt: number, neighbors: string[] }>} */
    this.neighborCache = new Map()
  }

  /**
   * @param {string} fromRoom
   * @param {string} toRoom
   * @returns {Promise<string[] | null>}
   */
  async findPath(fromRoom, toRoom) {
    if (!fromRoom || !toRoom || fromRoom === toRoom) {
      return []
    }

    const cacheKey = `${fromRoom}->${toRoom}`
    const cached = this.pathCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.path
    }

    const path = await this.bfs(fromRoom, toRoom)

    this.pathCache.set(cacheKey, {
      path,
      expiresAt: Date.now() + this.cacheTtlMs,
    })

    return path
  }

  /**
   * @param {string} roomId
   * @returns {Promise<string[]>}
   */
  async getNeighbors(roomId) {
    const cached = this.neighborCache.get(roomId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.neighbors
    }

    const room = await this.prisma.room.findUnique({
      where: { roomId },
      select: NEIGHBOR_FIELDS.reduce((acc, field) => {
        acc[field] = true
        return acc
      }, {}),
    })

    if (!room) {
      this.neighborCache.set(roomId, {
        neighbors: [],
        expiresAt: Date.now() + this.cacheTtlMs,
      })
      return []
    }

    const neighbors = NEIGHBOR_FIELDS.reduce((acc, field) => {
      const value = room[field]
      if (value) acc.push(value)
      return acc
    }, [])

    this.neighborCache.set(roomId, {
      neighbors,
      expiresAt: Date.now() + this.cacheTtlMs,
    })

    return neighbors
  }

  /**
   * @param {string} start
   * @param {string} goal
   * @returns {Promise<string[] | null>}
   */
  async bfs(start, goal) {
    const queue = [[start]]
    const visited = new Set([start])

    while (queue.length > 0) {
      const path = queue.shift()
      if (!path) break
      const room = path[path.length - 1]
      if (path.length > this.maxDepth) continue

      const neighbors = await this.getNeighbors(room)
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        const nextPath = [...path, neighbor]
        if (neighbor === goal) {
          return nextPath.slice(1)
        }
        queue.push(nextPath)
      }
    }

    return null
  }

  clearCache() {
    this.pathCache.clear()
    this.neighborCache.clear()
  }
}

module.exports = {
  NPCPathfinder,
}

