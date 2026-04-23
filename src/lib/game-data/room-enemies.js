// Maps room IDs to enemies that appear there
// Room 017: On the Beach — Rat (non-aggressive)
// Room 016: Abandoned Docks — Giant Rat (aggressive, territorial dock rats)
// Room 015: Beach by Giant Rock — Sand Crab (non-aggressive, passive by the rocks)
const ROOM_ENEMIES = {
  '017': { enemies: ['rat'] },
  '016': { enemies: ['giant-rat'] },
  '015': { enemies: ['sand-crab'] },
}

function getRoomEnemies(roomId) {
  return ROOM_ENEMIES[roomId] || null
}

module.exports = { ROOM_ENEMIES, getRoomEnemies }
