/**
 * Quests that open up by walking somewhere.
 *
 * Most quest chains advance through `onComplete: startQuest` effects, which is
 * the right shape when one quest genuinely follows another. Town quest givers
 * are different: the original made their quests appear on *discovery* — the Red
 * Guard Captain's set unlocked once you had reached the Forest Crossroads, the
 * Plaza's once you had stood in Red Town Square, the Mayor's once you had opened
 * the first gold chest. There is no quest to hang those off; what they have in
 * common is that the player found the place.
 *
 * So: entering a room starts its quest, once. The trigger is idempotent —
 * `acceptQuest` returns the existing progress rather than duplicating it — and
 * it fires on the server's own record of the destination room, never a
 * client-supplied one.
 *
 * @typedef {{ questId: string, npc: string }} RoomTrigger
 * @type {Record<string, RoomTrigger>}
 */
const QUEST_ROOM_TRIGGERS = {
  // ==================== FOREST ====================
  // Freddie's set is chained off Jack Lumber's last quest (the one that opens the
  // Forest Path), which is how a new player hears about the cow farm. This is the
  // safety net: anyone who was already past that point when Freddie was added
  // still picks his quests up by walking onto the farm.
  '103': { questId: 'quest_freddie_intro', npc: 'Freddie' },

  // ==================== RED TOWN ====================
  '215': { questId: 'quest_redguardcaptain_intro', npc: 'the Red Guard Captain' },
  '221': { questId: 'quest_townhallplaza_intro', npc: 'the people at the Plaza' },
  '222': { questId: 'quest_mayorrudolf_intro', npc: 'Mayor Rudolf' },
  '225': { questId: 'quest_wizardsguild_intro', npc: "the Wizard's Guild Recruiter" },
  '226': { questId: 'quest_warriorsguild_intro', npc: "the Warrior's Guild Recruiter" },
}

/**
 * Start the room's quest if it has one and the player has not met it yet.
 *
 * Returns the quest definition when this call is what created the progress row,
 * so the caller can tell the player a quest just opened; returns null when the
 * room has no trigger or the player already has the quest (started or finished).
 *
 * @param {string} playerId
 * @param {string} roomId - the server's authoritative destination room
 * @returns {Promise<{questId: string, quest: Object, npc: string}|null>}
 */
async function applyRoomQuestTrigger(playerId, roomId) {
  const trigger = QUEST_ROOM_TRIGGERS[roomId]
  if (!trigger) return null

  const { getQuestProgress, getQuestDef, acceptQuest } = require('./services/quest-service')

  const existing = await getQuestProgress(playerId, trigger.questId)
  if (existing) return null

  // `system: true` bypasses the one-main-quest-per-NPC gate and the NPC room
  // check — the player is standing in the room, which is the whole trigger.
  const result = await acceptQuest(playerId, trigger.questId, null, { system: true })
  if (!result.success) {
    console.error(`[questRoomTrigger] Failed to start ${trigger.questId} for ${playerId}:`, result.error)
    return null
  }

  const quest = getQuestDef(trigger.questId)
  return quest ? { questId: trigger.questId, quest, npc: trigger.npc } : null
}

module.exports = { QUEST_ROOM_TRIGGERS, applyRoomQuestTrigger }
