/**
 * Single source of truth for items that live in rooms.
 *
 * Consumed by:
 *   - prisma/seed.ts                          (creates these rows on seed)
 *   - room-item-service.js ensureAutoRespawnItems (recreates missing autoRespawn rows on room entry)
 *
 * Each entry is keyed by item `slug` (the stable, human-readable identifier on
 * ItemTemplate). The numeric template id (e.g. `short-sword_001`) is resolved
 * from the slug at use-time, so this file never has to know about id suffixes.
 *
 * Fields:
 *   roomId        - Room.roomId string (e.g. '007')
 *   slug          - ItemTemplate.slug
 *   quantity      - how many to place (default 1)
 *   autoRespawn   - if true, recreated on room entry when missing (default true)
 *
 * To add loot to a room: add a line here. That's it — both seed and runtime
 * respawn pick it up automatically.
 *
 * @typedef {{ roomId: string, slug: string, quantity?: number, autoRespawn?: boolean }} RoomLootEntry
 * @type {RoomLootEntry[]}
 */
const ROOM_LOOT = [
  // Tutorial / starter area
  { roomId: '001', slug: 'welcome-book' },
  { roomId: '004', slug: 'flower' },
  { roomId: '006', slug: 'shovel' },

  // Room 007 — training grounds
  { roomId: '027', slug: 'red-potion' },
  { roomId: '007', slug: 'training-sword' },
  { roomId: '007', slug: 'training-shield' },
  { roomId: '007', slug: 'training-2h-sword' },

  // Room 027 — rings (2 of each)
  { roomId: '027', slug: 'ring-of-str', quantity: 2 },
  { roomId: '027', slug: 'ring-of-dex', quantity: 2 },
  { roomId: '027', slug: 'ring-of-mag', quantity: 2 },
  { roomId: '027', slug: 'ring-of-def', quantity: 2 },
  { roomId: '027', slug: 'soldiers-ring', quantity: 2 },

  // Room 027 — necklaces (2 of each)
  { roomId: '027', slug: 'wooden-necklace', quantity: 2 },
  { roomId: '027', slug: 'bone-necklace', quantity: 2 },
  { roomId: '027', slug: 'stone-necklace', quantity: 2 },

  // Room 088 — Solar Office
  { roomId: '088', slug: 'master-sword' },
  { roomId: '088', slug: 'enchanted-orb' },

  // Room 019 — Sand Crab Nest
  { roomId: '019', slug: 'bo' },
]

module.exports = { ROOM_LOOT }
