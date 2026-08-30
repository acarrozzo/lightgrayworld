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

  // Room 024 — Jack Lumber's cabin (hatchet for chopping wood at tree farm)
  { roomId: '024', slug: 'hatchet' },

  // Room 128 — Forest Gnome's tree hut. The gnome's spare hatchet: legacy parity
  // with "If you lose it come back here for another free one", handled by the
  // autoRespawn refill rather than a bespoke `get hatchet` action.
  { roomId: '128', slug: 'hatchet' },

  // Room 014 — pickaxe (for mining stone in room 015)
  { roomId: '014', slug: 'pickaxe' },

  // Room 028c — crafting tools
  { roomId: '028c', slug: 'hammer' },
  { roomId: '028c', slug: 'string' },
  { roomId: '028c', slug: 'pickaxe' },

  // ==================== RED TOWN ====================
  // Room 212 — the Red Guard Barracks weapon rack. Legacy offered these as three
  // separate "grab" buttons; as room items they use the shared pickup flow and the
  // autoRespawn refill covers the "come back for another" behaviour.
  { roomId: '212', slug: 'mace' },
  { roomId: '212', slug: 'long-sword' },
  { roomId: '212', slug: 'warhammer' },

  // Room 213 — Red Guard Living Quarters ("cooked meat that's up for grabs")
  { roomId: '213', slug: 'cooked-meat', quantity: 5 },

  // Room 223 — Red Dining Room ("some food stuffs are available for you to take")
  { roomId: '223', slug: 'cooked-meat', quantity: 5 },

  // Room 232m — the Thieve's Den bolt stash in the corner of the hangout
  { roomId: '232m', slug: 'crossbow-bolt', quantity: 25 },

  // Room 232y — the potions stacked beside the gray chest across the sewer river.
  // The wings potions are the legacy `get wings potion` restock: the only reason
  // you got across the river was a wings potion, so the far bank keeps a supply
  // to get you back. As a room item the autoRespawn refill covers the "come back
  // if you run out" behaviour without a bespoke action.
  { roomId: '232y', slug: 'red-potion', quantity: 3 },
  { roomId: '232y', slug: 'wings-potion', quantity: 5 },

  // Room 232m — the Thieve's Den also keeps a wings potion stash; the Den is a
  // dead end otherwise reachable only through the false wall.
  { roomId: '232m', slug: 'red-potion', quantity: 3 },
]

module.exports = { ROOM_LOOT }
