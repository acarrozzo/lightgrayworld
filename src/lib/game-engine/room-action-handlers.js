/**
 * Room-specific action handlers
 * Handles execution of actions that are unique to specific rooms
 */
const { grantPersonalItemOnce } = require('./effects')
const { grantItemOnce } = require('./services/inventory-service')
const { checkAndIncrementCap, checkAndIncrementCapBulk, getRemainingCap } = require('./services/action-cap-service')

/**
 * Format time remaining: hours+minutes if >= 60min, minutes+seconds if < 60min
 */
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return '0s'
  
  const totalMinutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (minutes > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${hours}h`
  }
  
  if (totalMinutes > 0) {
    if (remainingSeconds > 0) {
      return `${totalMinutes}m ${remainingSeconds}s`
    }
    return `${totalMinutes}m`
  }
  
  return `${remainingSeconds}s`
}

/**
 * Map of room IDs to room-specific actions. Each action entry can be either:
 * - A string message (handled by executeBasicDisplay)
 * - A custom function (playerId, roomState) => actionResult
 * - A structured action definition object (supports effects)
 */
const ROOM_ACTIONS = {
  '000': {
    'read sign': {
      showModal: true,
      message: 'You read the sign attached to the pillar',
      modalContent: {
        title: 'You read the sign attached to the pillar',
        type: 'icon',
        icon: 'sign-metal2',
        iconColor: 'gray-500/50',
        message: 'Welcome to Room Zero, the first room ever made. It is unlike the others. I allow you to access here, for now.',
      },
    },
    'examine pillar': {
      showModal: true,
      message: 'You examine the glowing pillar at the center of the room.',
      modalContent: {
        title: 'You examine the glowing pillar at the center of the room',
        type: 'icon',
        icon: 'pillar2',
        iconColor: 'blue-300/50',
        message: 'The bright blue light emanating from the pillar seems to be a button. Press it to teleport to the grassy field.',
      },
    },
  },
  '001': {
    'read sign': {
      showModal: true,
      message: "You read the sign. It says: 'Welcome to Grassy Field Crossroads!'",
      modalContent: {
        title: 'You read the sign',
        heading: { 
          text: 'Grassy Field Directory', 
          parts: ['Grassy Field', 'Directory'],
          description: 'Welcome! This directory shows nearby locations you can explore. Click the direction buttons to travel there.'
        },
        locations: [
          { 
            name: 'Healing Waterfall', 
            direction: 'northwest',
            description: 'Rest here to restore your health and mana.'
          },
          { 
            name: 'Shaman Tent', 
            direction: 'northeast',
            description: 'A mystical place where you can learn new abilities and learn a thing or two.'
          },
          { 
            name: 'Beach', 
            direction: 'west',
            description: 'A peaceful coastal area where you can relax. (Watch out for sand crabs!)'
          },
          { 
            name: 'Wood Cabin', 
            direction: 'southwest',
            description: 'The Old Man lives here. He\'s your first quest giver and will help you get started on your adventure.'
          }
        ],
        questMessage: "Visit the OLD MAN at the cabin to start your first quest.",
        questMessageDescription: 'The Old Man will give you your first quest and help you learn the basics of the game.'
      },
      buttons: [
        { label: 'northwest', direction: 'northwest' },
        { label: 'northeast', direction: 'northeast' },
        { label: 'west', direction: 'west' },
        { label: 'southwest', direction: 'southwest' }
      ]
    },
    'open gold chest': {
      showModal: true,
      message: 'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
      modalContent: {
        title: 'You try to open the gold chest',
        type: 'icon',
        icon: 'chest',
        iconColor: 'amber-500/90',
        message: 'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
      },
    },
  },
  '002': {
    'pick redberry': {
      maxPerTick: 5,
      isCapped: true,
      effects: [{ type: 'grantItem', itemSlug: 'redberry', quantity: 1 }],
      generateMessage: (effects, capInfo) => {
        if (!effects?.[0]?.success) {
          const secondsRemaining = capInfo?.secondsUntilReset ?? 0
          const timeFormatted = formatTimeRemaining(secondsRemaining)
          return `No more redberries right now. More will grow in ${timeFormatted}.`
        }
        const quantity = capInfo?.quantity ?? 1
        if (quantity === 1) {
          return `You pick a ripe redberry. (${capInfo.remaining} picks remaining this tick)`
        }
        return `You pick ${quantity} ripe redberries. `
      },
      determineOutcome: ({ success }) => (success ? 'success' : 'info'),
    },
  },
  '003': {
    'ex cabin': "You examine the cabin. It's warm and cozy, with a cooking fire burning and the Old Man rocking in his chair.",
    'attack dummy': 'You attack the training dummy. Your weapon strikes true!',
    'cook meat': 'You cook the meat over the fire. It smells delicious!',
    'talk to old man': async (playerId, roomState, actionData = {}) => {
      const { getQuestProgress, checkQuestRequirements, getQuestDef } = require('./services/quest-service')
      const introOnly = !!actionData.introOnly
      const targetQuestId = actionData.questId ?? null

      roomState.touchActivity()

      // Check quest_oldman_000 status first
      const questOldman000Progress = await getQuestProgress(playerId, 'quest_oldman_000')

      // If quest_oldman_000 exists and is not completed, show forced completion
      if (questOldman000Progress && !questOldman000Progress.completed) {
        return {
          success: true,
          action: 'talk to old man',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload('talk to old man', 'success', 'You approach the Old Man.', {
                roomId: roomState.roomId,
                showModal: true,
                modalContent: {
                  type: 'icon',
                  icon: 'npc-oldman',
                  iconColor: 'yellow-400',
                  title: 'Old Man',
                  header: 'Well met, traveler!',
                  message: [
                    "Hey there young whippersnapper, I could use the help of a bright adventurer like yourself. ",
                    "Bring me a yellow flower from the flower patch to the north and you will do this old man a great favor."
                  ],
                },
                buttons: [
                  { label: 'I can bring you a flower', direction: 'complete_quest:quest_oldman_000' },
                ],
              }),
            },
          ],
        }
      }

      // quest_oldman_000 is completed, check quest_oldman_001 status
      const questOldman001Progress = await getQuestProgress(playerId, 'quest_oldman_001')

      // If quest_oldman_001 exists and is not completed
      if (questOldman001Progress && !questOldman001Progress.completed) {
        const requirements = await checkQuestRequirements(playerId, 'quest_oldman_001')

        if (requirements.met && !introOnly) {
          // Player has flower - show completion prompt
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You approach the Old Man with the flower.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man\'s eyes light up as he sees the yellow flower in your hand. "Perfect! That\'s exactly what I needed. Thank you so much, traveler!"',
                  },
                  questComplete: {
                    questTitle: getQuestDef('quest_oldman_001').title,
                    rewards: getQuestDef('quest_oldman_001').rewards || [],
                    levelUp: null,
                    newQuestTitles: [],
                  },
                  buttons: [
                    { label: 'Complete Quest', direction: 'complete_quest:quest_oldman_001', primary: true },
                  ],
                }),
              },
            ],
          }
        } else {
          // Player doesn't have flower - show reminder
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You talk to the Old Man.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man looks at you expectantly. "Have you found that yellow flower yet? You can find them in the flower patch to the north. Just bring me one when you have it!"',
                  },
                }),
              },
            ],
          }
        }
      }

      // Check quest_oldman_002 (Rat Problem)
      const questOldman002Progress = await getQuestProgress(playerId, 'quest_oldman_002')

      if (questOldman002Progress && !questOldman002Progress.completed) {
        const requirements = await checkQuestRequirements(playerId, 'quest_oldman_002')

        if (requirements.met && !introOnly) {
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You approach the Old Man.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man\'s face lights up with relief. "You did it! Those wretched rats have been down there for weeks. I can\'t thank you enough, traveler."',
                  },
                  questComplete: {
                    questTitle: getQuestDef('quest_oldman_002').title,
                    rewards: getQuestDef('quest_oldman_002').rewards || [],
                    levelUp: null,
                    newQuestTitles: [],
                  },
                  buttons: [
                    { label: 'Complete Quest', direction: 'complete_quest:quest_oldman_002', primary: true },
                  ],
                }),
              },
            ],
          }
        } else {
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You talk to the Old Man.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man wrings his hands nervously. "Those giant rats are still down there in my basement! Head down and clear them out — I can\'t rest until they\'re gone."',
                  },
                }),
              },
            ],
          }
        }
      }

      // Check quest_oldman_003 (The Gator)
      const questOldman003Progress = await getQuestProgress(playerId, 'quest_oldman_003')

      if (questOldman003Progress && !questOldman003Progress.completed && (!targetQuestId || targetQuestId === 'quest_oldman_003')) {
        const requirements = await checkQuestRequirements(playerId, 'quest_oldman_003')

        if (requirements.met && !introOnly) {
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You approach the Old Man.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man claps his hands together. "That gator has been terrorizing this marsh for years! You\'ve done this whole area a great service, friend."',
                  },
                  questComplete: {
                    questTitle: getQuestDef('quest_oldman_003').title,
                    rewards: getQuestDef('quest_oldman_003').rewards || [],
                    levelUp: null,
                    newQuestTitles: [],
                  },
                  buttons: [
                    { label: 'Complete Quest', direction: 'complete_quest:quest_oldman_003', primary: true },
                  ],
                }),
              },
            ],
          }
        } else {
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You talk to the Old Man.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man leans on his cane and peers toward the marsh. "That gator is still out there in the swamp. Head southwest into the marsh and deal with it when you\'re ready."',
                  },
                }),
              },
            ],
          }
        }
      }

      // Check quest_oldman_004 (Blueberry Jam)
      const questOldman004Progress = await getQuestProgress(playerId, 'quest_oldman_004')

      if (questOldman004Progress && !questOldman004Progress.completed && (!targetQuestId || targetQuestId === 'quest_oldman_004')) {
        const requirements = await checkQuestRequirements(playerId, 'quest_oldman_004')

        if (requirements.met && !introOnly) {
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You approach the Old Man with the blueberries.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man\'s eyes go wide. "Well I\'ll be — you actually got \'em! Those\'ll make the finest jam this side of the bayou. My wife is going to be absolutely delighted, I tell you."',
                  },
                  questComplete: {
                    questTitle: getQuestDef('quest_oldman_004').title,
                    rewards: getQuestDef('quest_oldman_004').rewards || [],
                    levelUp: null,
                    newQuestTitles: [],
                  },
                  buttons: [
                    { label: 'Complete Quest', direction: 'complete_quest:quest_oldman_004', primary: true },
                  ],
                }),
              },
            ],
          }
        } else {
          return {
            success: true,
            action: 'talk to old man',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to old man', 'success', 'You talk to the Old Man.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-oldman',
                    iconColor: 'yellow-400',
                    title: 'Old Man',
                    message: 'The Old Man leans back with a wistful look. "My wife makes the most wonderful blueberry jam, but we\'re fresh out of berries. Head over to the blueberry patch and bring me back ten of \'em when you get a chance."',
                  },
                }),
              },
            ],
          }
        }
      }

      // All quests done or missing - friendly fallback
      return {
        success: true,
        action: 'talk to old man',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload('talk to old man', 'success', 'You talk to the Old Man.', {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: {
                type: 'icon',
                icon: 'npc-oldman',
                iconColor: 'yellow-400',
                title: 'Old Man',
                message: questOldman004Progress?.completed
                  ? 'The Old Man rocks contentedly in his chair. "The gator\'s gone, the rats are gone, and my wife\'s got her jam. You\'ve been a true blessing to this old man, traveler."'
                  : questOldman003Progress?.completed
                    ? 'The Old Man rocks contentedly in his chair. "The rats are gone, the gator is dealt with, and my wife got her flower. You\'ve been a true blessing, traveler."'
                    : questOldman001Progress?.completed
                      ? 'The Old Man smiles warmly. "Thank you again for your help, traveler! That flower made the perfect addition to my recipe. If you need anything else, feel free to ask."'
                      : 'The Old Man looks up from his rocking chair with a warm smile. "Ah, traveler! Welcome to my cabin. I\'m glad you found your way here."',
              },
            }),
          },
        ],
      }
    },
  },
  '007': {
    'talk to young soldier': async (playerId, roomState, actionData = {}) => {
      const { getQuestProgress, checkQuestRequirements, getQuestDef } = require('./services/quest-service')
      const introOnly = !!actionData.introOnly

      roomState.touchActivity()

      // Check quest_youngsoldier_000 status first
      const questYoungsoldier000Progress = await getQuestProgress(playerId, 'quest_youngsoldier_000')

      // If quest_youngsoldier_000 active (exists, not completed)
      if (questYoungsoldier000Progress && !questYoungsoldier000Progress.completed) {
        return {
          success: true,
          action: 'talk to young soldier',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload('talk to young soldier', 'success', 'You approach the Young Soldier.', {
                roomId: roomState.roomId,
                showModal: true,
                modalContent: {
                  type: 'icon',
                  icon: 'npc-youngsoldier',
                  iconColor: 'blue-400',
                  title: 'Young Soldier',
                  message: 'The Young Soldier turns to face you with a determined look. "Greetings, traveler! I see you\'ve spoken with the Old Man. He\'s a wise one, but let me give you some advice: in this world, you need to be prepared. Make sure you\'re properly armed before you venture too far."',
                },
                buttons: [
                  { label: 'Continue', direction: 'complete_quest:quest_youngsoldier_000' },
                ],
              }),
            },
          ],
        }
      }

      // quest_youngsoldier_000 is completed, check quest_youngsoldier_001 status
      const questYoungsoldier001Progress = await getQuestProgress(playerId, 'quest_youngsoldier_001')

      // If quest_youngsoldier_001 active (exists, not completed)
      if (questYoungsoldier001Progress && !questYoungsoldier001Progress.completed) {
        const requirements = await checkQuestRequirements(playerId, 'quest_youngsoldier_001')

        if (requirements.met && !introOnly) {
          // Player has equipped MAIN_HAND item - show completion prompt
          return {
            success: true,
            action: 'talk to young soldier',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to young soldier', 'success', 'You approach the Young Soldier.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-youngsoldier',
                    iconColor: 'blue-400',
                    title: 'Young Soldier',
                    message: 'The Young Soldier nods approvingly as he sees your weapon. "Good. Now you\'re armed. That\'s much better. You\'ll need that if you plan to explore beyond these safe areas."',
                  },
                  questComplete: {
                    questTitle: getQuestDef('quest_youngsoldier_001').title,
                    rewards: getQuestDef('quest_youngsoldier_001').rewards || [],
                    levelUp: null,
                    newQuestTitles: [],
                  },
                  buttons: [
                    { label: 'Complete Quest', direction: 'complete_quest:quest_youngsoldier_001', primary: true },
                  ],
                }),
              },
            ],
          }
        } else {
          // Player doesn't have MAIN_HAND item equipped - show reminder
          return {
            success: true,
            action: 'talk to young soldier',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to young soldier', 'success', 'You talk to the Young Soldier.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-youngsoldier',
                    iconColor: 'blue-400',
                    title: 'Young Soldier',
                    message: 'the Young Soldier looks at you with concern. "You\'re still unarmed? That\'s dangerous. Open your inventory and equip something into your Main Hand. You can\'t rely on your fists forever."',
                  },
                }),
              },
            ],
          }
        }
      }

      // quest_youngsoldier_001 completed, check quest_youngsoldier_002 status
      const questYoungsoldier002Progress = await getQuestProgress(playerId, 'quest_youngsoldier_002')

      if (questYoungsoldier002Progress && !questYoungsoldier002Progress.completed) {
        const requirements = await checkQuestRequirements(playerId, 'quest_youngsoldier_002')
        const killCount = questYoungsoldier002Progress.progress
        const killTarget = 2

        if (requirements.met && !introOnly) {
          return {
            success: true,
            action: 'talk to young soldier',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to young soldier', 'success', 'You approach the Young Soldier.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-youngsoldier',
                    iconColor: 'blue-400',
                    title: 'Young Soldier',
                    message: 'The Young Soldier grins as you return. "Two Sand Crabs — impressive! You\'re no longer just an adventurer with a weapon, you\'re one who knows how to use it. I think you\'re ready to explore this world."',
                  },
                  questComplete: {
                    questTitle: getQuestDef('quest_youngsoldier_002').title,
                    rewards: getQuestDef('quest_youngsoldier_002').rewards || [],
                    levelUp: null,
                    newQuestTitles: [],
                  },
                  buttons: [
                    { label: 'Complete Quest', direction: 'complete_quest:quest_youngsoldier_002', primary: true },
                  ],
                }),
              },
            ],
          }
        } else {
          return {
            success: true,
            action: 'talk to young soldier',
            playerEvents: [
              {
                event: 'action:feedback',
                payload: createActionFeedbackPayload('talk to young soldier', 'success', 'You approach the Young Soldier.', {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'npc-youngsoldier',
                    iconColor: 'blue-400',
                    title: 'Young Soldier',
                    message: `The Young Soldier crosses his arms. "The Rocky Beach is to the south — you'll find Sand Crabs there. Come back when you've defeated two of them. You're at ${killCount} of ${killTarget} so far."`,
                  },
                }),
              },
            ],
          }
        }
      }

      // Quest_005 completed or missing - show idle dialog
      return {
        success: true,
        action: 'talk to young soldier',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload('talk to young soldier', 'success', 'You talk to the Young Soldier.', {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: {
                type: 'icon',
                icon: 'npc-youngsoldier',
                iconColor: 'blue-400',
                title: 'Young Soldier',
                message: questYoungsoldier002Progress && questYoungsoldier002Progress.completed
                  ? 'The Young Soldier gives you a proud nod. "You\'ve proven yourself out there. Stay sharp and keep pushing further into the world."'
                  : questYoungsoldier001Progress && questYoungsoldier001Progress.completed
                    ? 'The Young Soldier gives you a respectful nod. "You\'re well-prepared now. Good luck on your adventures, traveler."'
                    : 'The Young Soldier stands at attention. "Help out the Old Man first and then come back to me. Hello there, Young Adventurer. I\'m a soldier sent here from Domus to assist you. Feel free to take any of the training weapons here."',
              },
            }),
          },
        ],
      }
    },
  },
  '004': {},
  '005': {
    'pick blueberry': {
      maxPerTick: 3,
      isCapped: true,
      effects: [{ type: 'grantItem', itemSlug: 'blueberry', quantity: 1 }],
      generateMessage: (effects, capInfo) => {
        if (!effects?.[0]?.success) {
          const secondsRemaining = capInfo?.secondsUntilReset ?? 0
          const timeFormatted = formatTimeRemaining(secondsRemaining)
          return `No more blueberries right now. More will grow in ${timeFormatted}.`
        }
        const quantity = capInfo?.quantity ?? 1
        if (quantity === 1) {
          return `You pick a ripe blueberry. (${capInfo.remaining} picks remaining this tick)`
        }
        return `You pick ${quantity} ripe blueberries.)`
      },
      determineOutcome: ({ success }) => (success ? 'success' : 'info'),
    },
  },
  '012d': {
    'pull lever': async (playerId) => {
      const { pullLever, isLeverPulled, getRoomStateNote, getRoomActionOverrides } = require('./lever-state')
      const leverId = '012d-lever'

      if (isLeverPulled(playerId, leverId)) {
        return {
          success: true,
          action: 'pull lever',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload('pull lever', 'info', 'The lever is already down.', {
                showModal: true,
                modalContent: {
                  type: 'icon',
                  icon: 'lever-down',
                  iconColor: 'gray-500',
                  title: 'Lever',
                  message: 'The lever is already pulled down. It can\'t be pushed back up.',
                },
                stateNote: getRoomStateNote(playerId, '012d'),
                actionOverrides: getRoomActionOverrides(playerId, '012d'),
              }),
            },
          ],
        }
      }

      pullLever(playerId, leverId)
      return {
        success: true,
        action: 'pull lever',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload('pull lever', 'success', 'You pull the lever down. A distant clunk echoes through the stone to the north.', {
              showModal: true,
              modalContent: {
                type: 'icon',
                icon: 'lever-down',
                iconColor: 'green-400',
                title: 'You pull the lever down.',
                message: 'You pull the lever down. A distant clunk echoes through the stone to the north.',
              },
              stateNote: getRoomStateNote(playerId, '012d'),
              actionOverrides: getRoomActionOverrides(playerId, '012d'),
            }),
          },
        ],
      }
    },
  },
  '006': {
    'view shop': async (playerId, roomState) => {
      const { prisma } = require('../db-client')
      const { getPlayerInventory } = require('./services/inventory-service')

      // Get player data
      const player = await prisma.user.findUnique({
        where: { id: playerId },
        select: { currency: true },
      })

      if (!player) {
        return createErrorResult('view shop', 'Player not found')
      }

      // Get shop items (dagger, red-potion, blue-potion)
      const shopItemSlugs = ['dagger', 'red-potion', 'blue-potion']
      const shopItems = await prisma.itemTemplate.findMany({
        where: {
          slug: { in: shopItemSlugs },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          value: true,
          type: true,
          equipSlot: true,
        },
      })

      // Get player inventory
      const inventory = await getPlayerInventory(playerId)

      roomState.touchActivity()

      return {
        success: true,
        action: 'view shop',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload('view shop', 'success', 'You open the shop interface.', {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: {
                type: 'shop',
                shopItems,
                playerCurrency: player.currency,
                playerInventory: inventory,
              },
            }),
          },
        ],
      }
    },
  },
}

/**
 * Execute a room-specific action
 * @param {string} roomId - The room ID where the action is being executed
 * @param {string} action - The action name (e.g., 'read sign', 'open gold chest')
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object|null} Action result object or null if action not found
 */
async function executeRoomAction(roomId, action, playerId, roomState, currentTickNumber, nextTickAt, actionData = {}) {
  const normalizedAction = action.toLowerCase().trim()
  const roomActions = ROOM_ACTIONS[roomId]

  if (!roomActions) {
    return null
  }

  const handler = roomActions[normalizedAction]

  if (!handler) {
    return null
  }

  if (typeof handler === 'function') {
    return await handler(playerId, roomState, actionData)
  }

  if (typeof handler === 'string') {
    return executeBasicDisplay(normalizedAction, handler, playerId, roomState)
  }

  // Check if handler is a simple object with showModal (but not a full structured action)
  if (isStructuredAction(handler) && handler.showModal && typeof handler.message === 'string' && !handler.effects && !handler.generateMessage) {
    return executeBasicDisplay(normalizedAction, handler.message, playerId, roomState, handler.showModal, handler)
  }

  if (isStructuredAction(handler)) {
    return executeStructuredAction(normalizedAction, handler, playerId, roomState, currentTickNumber, nextTickAt)
  }

  return null
}

/**
 * Reusable helper function for basic display actions
 * Displays a message to the feed when an action is performed
 * @param {string} actionName - The name of the action being performed
 * @param {string} message - The message to display to the player
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function createActionFeedbackPayload(action, outcome, message, data = {}) {
  const ts = Date.now()
  return {
    action,
    message,
    outcome,
    ts,
    timestamp: new Date(ts).toISOString(),
    success: outcome === 'success',
    data,
  }
}

function executeBasicDisplay(actionName, message, playerId, roomState, showModal = false, handler = null) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  const data = {
    roomId: roomState.roomId,
  }

  if (showModal) {
    data.showModal = true
    // Check if handler has structured modalContent, otherwise use message string
    if (handler && handler.modalContent) {
      data.modalContent = handler.modalContent
      if (handler.buttons) {
        data.buttons = handler.buttons
      }
    } else {
      data.modalContent = message
    }
  }

  return {
    success: true,
    action: actionName,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(actionName, 'success', message, data),
      },
    ],
  }
}

/**
 * Create an error result for failed actions
 */
function createErrorResult(action, message) {
  return {
    success: false,
    action,
    message,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(action, 'failure', message),
      },
    ],
  }
}

/**
 * Determine if an action handler is a structured definition.
 */
function isStructuredAction(handler) {
  return handler && typeof handler === 'object' && !Array.isArray(handler)
}

/**
 * Execute structured action definition with optional effects.
 */
async function executeStructuredAction(actionName, definition, playerId, roomState, currentTickNumber, nextTickAt) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  // Check if this is a berry action (pick redberry or pick blueberry)
  const isBerryAction = actionName === 'pick redberry' || actionName === 'pick blueberry'
  let berryQuantity = 0

  let capResult = null

  // Handle capped actions before running effects
  if (definition.isCapped) {
    if (!currentTickNumber && currentTickNumber !== 0) {
      return createErrorResult(actionName, 'World tick unavailable. Please try again.')
    }

    // For berry actions, get remaining cap first and use bulk increment
    if (isBerryAction) {
      const remaining = await getRemainingCap(
        playerId,
        roomState.roomId,
        actionName,
        definition.maxPerTick,
        currentTickNumber
      )

      if (remaining <= 0) {
        const secondsUntilReset =
          typeof nextTickAt === 'number'
            ? Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000))
            : null

        const message = typeof definition.generateMessage === 'function'
          ? definition.generateMessage([{ success: false }], {
              remaining: 0,
              secondsUntilReset,
            })
          : 'You cannot perform this action right now.'

        const capExceededOutcome =
          typeof definition.determineOutcome === 'function'
            ? definition.determineOutcome({
                success: false,
                effectResults: [{ success: false }],
                capInfo: { remaining: 0, secondsUntilReset },
              }) || 'failure'
            : 'failure'

        return {
          success: false,
          action: actionName,
          message,
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload(actionName, capExceededOutcome, message, {
                roomId: roomState.roomId,
                remaining: 0,
                secondsUntilReset,
              }),
            },
          ],
        }
      }

      // Use bulk increment to increment by the full remaining amount
      berryQuantity = remaining
      capResult = await checkAndIncrementCapBulk(
        playerId,
        roomState.roomId,
        actionName,
        definition.maxPerTick,
        currentTickNumber,
        remaining
      )

      if (!capResult.allowed) {
        const secondsUntilReset =
          typeof nextTickAt === 'number'
            ? Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000))
            : null

        const message = typeof definition.generateMessage === 'function'
          ? definition.generateMessage([{ success: false }], {
              remaining: 0,
              secondsUntilReset,
            })
          : 'You cannot perform this action right now.'

        const capExceededOutcome =
          typeof definition.determineOutcome === 'function'
            ? definition.determineOutcome({
                success: false,
                effectResults: [{ success: false }],
                capInfo: { remaining: 0, secondsUntilReset },
              }) || 'failure'
            : 'failure'

        return {
          success: false,
          action: actionName,
          message,
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload(actionName, capExceededOutcome, message, {
                roomId: roomState.roomId,
                remaining: 0,
                secondsUntilReset,
              }),
            },
          ],
        }
      }
    } else {
      // For non-berry actions, use the standard single increment
      capResult = await checkAndIncrementCap(
        playerId,
        roomState.roomId,
        actionName,
        definition.maxPerTick,
        currentTickNumber
      )

      const secondsUntilReset =
        typeof nextTickAt === 'number'
          ? Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000))
          : null

      if (!capResult.allowed) {
        const message = typeof definition.generateMessage === 'function'
          ? definition.generateMessage([{ success: false }], {
              remaining: 0,
              secondsUntilReset,
            })
          : 'You cannot perform this action right now.'

        const capExceededOutcome =
          typeof definition.determineOutcome === 'function'
            ? definition.determineOutcome({
                success: false,
                effectResults: [{ success: false }],
                capInfo: { remaining: 0, secondsUntilReset },
              }) || 'failure'
            : 'failure'

        return {
          success: false,
          action: actionName,
          message,
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload(actionName, capExceededOutcome, message, {
                roomId: roomState.roomId,
                remaining: 0,
                secondsUntilReset,
              }),
            },
          ],
        }
      }
    }

    roomState.touchActivity()
  }

  // For berry actions, modify the effects to use the full quantity
  let effects = Array.isArray(definition.effects) ? definition.effects : []
  if (isBerryAction && berryQuantity > 0 && effects.length > 0) {
    effects = effects.map(effect => ({
      ...effect,
      quantity: berryQuantity
    }))
  }

  const { results: effectResults, inventory } = await executeEffects(effects, playerId)

  const capInfo = definition.isCapped
    ? {
        remaining: capResult
          ? Math.max(0, definition.maxPerTick - capResult.usedCount)
          : 0,
        secondsUntilReset:
          typeof nextTickAt === 'number'
            ? Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000))
            : null,
        ...(isBerryAction && berryQuantity > 0 ? { quantity: berryQuantity } : {}),
      }
    : null

  const message = typeof definition.generateMessage === 'function'
    ? definition.generateMessage(effectResults, capInfo)
    : definition.message || 'You take action.'

  const success = typeof definition.success === 'boolean'
    ? definition.success
    : effectResults.every((r) => r?.success !== false)

  const outcome =
    typeof definition.determineOutcome === 'function'
      ? definition.determineOutcome({
          success,
          effectResults,
          capInfo,
        }) || (success ? 'success' : 'failure')
      : success ? 'success' : 'failure'

  const data = {
    roomId: roomState.roomId,
    ...(inventory ? { inventory } : {}),
    ...(capInfo ? { remaining: capInfo.remaining, secondsUntilReset: capInfo.secondsUntilReset } : {}),
    effects: effectResults,
  }

  if (definition.showModal) {
    data.showModal = true
    // Check if definition has structured modalContent, otherwise use message string
    if (definition.modalContent) {
      data.modalContent = definition.modalContent
      if (definition.buttons) {
        data.buttons = definition.buttons
      }
    } else {
      data.modalContent = message
    }
  }

  return {
    success,
    action: actionName,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(actionName, outcome, message, data),
      },
    ],
  }
}

/**
 * Execute a list of effects and collect results.
 */
async function executeEffects(effects, playerId) {
  const results = []
  let latestInventory = null

  for (const effect of effects) {
    if (!effect?.type) continue

    if (effect.type === 'grantPersonalItemOnce') {
      const result = await grantPersonalItemOnce(playerId, effect.itemSlug, effect.quantity || 1)
      results.push(result)
      if (result.inventory) {
        latestInventory = result.inventory
      }
      continue
    }

    if (effect.type === 'grantItem') {
      const result = await grantItemOnce(playerId, effect.itemSlug, effect.quantity || 1)
      results.push({
        success: result.granted,
        message: result.reason,
        inventory: result.inventory,
      })
      if (result.inventory) {
        latestInventory = result.inventory
      }
      continue
    }

    if (effect.type === 'grantCurrency') {
      const { prisma } = require('../db-client')
      const amount = effect.amount || 0
      await prisma.user.update({
        where: { id: playerId },
        data: { currency: { increment: amount } },
      })
      results.push({ success: true, amount })
      continue
    }

    results.push({ success: false, message: `Unknown effect type: ${effect.type}` })
  }

  return { results, inventory: latestInventory }
}

module.exports = {
  executeRoomAction,
}

