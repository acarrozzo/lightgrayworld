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

  // ==================== ROCKY FLATS ====================
  // The original's three "start quests" buttons had no gate beyond standing in
  // the room; the Rocky Flats doors already ask for a guild membership. The
  // Guild Leader's set is not here — it chains off the recruiter's boss quest.
  '303': { questId: 'quest_dwarfcaptain_intro', npc: 'the Dwarf Captain' },
  '307': { questId: 'quest_bountyboard_intro', npc: 'the Dwarf Guard Bounty Board' },
  '308': { questId: 'quest_miningguild_intro', npc: 'the Mining Guild Recruiter' },

  // ==================== BLUE OCEAN ====================
  // Likewise ungated in the original: the Oasis, Crocodile Island and the
  // Master Temple each opened their set the moment you pressed the button.
  '413': { questId: 'quest_friendlypirate_intro', npc: 'the Friendly Pirate' },
  '424': { questId: 'quest_junglejim_intro', npc: 'Jungle Jim' },
  '425': { questId: 'quest_watertempleguardian_intro', npc: 'the Water Temple Guardian' },

  // ==================== DARK FOREST ====================
  // The original opened all three sets on discovery — the Outpost's and the
  // Tree Hut's once you were a Wizard's Guild member or had cracked the Forest
  // chest (which is what gets you through either gate into the Dark Forest),
  // the guild's initiation once you were a wizard. Standing in the room is
  // the same fact one step later.
  '502': { questId: 'quest_rangerguard_intro', npc: 'the Ranger Guard' },
  '506': { questId: 'quest_darkelf_intro', npc: 'the Dark Elf' },
  '515': { questId: 'quest_rangersguild_intro', npc: "the Ranger's Guild" },
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
