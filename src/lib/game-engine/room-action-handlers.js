/**
 * Room-specific action handlers
 * Handles execution of actions that are unique to specific rooms
 */
const { grantPersonalItemOnce } = require('./effects')
const { grantItemOnce, playerHasItem, removeItemBySlug, getPlayerInventory } = require('./services/inventory-service')
const { checkAndConsumeCooldown } = require('./services/action-cap-service')
const { getRecipeById, isCraftingRoom } = require('../game-data/crafting-recipes')

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
 * Fill {progress} / {count} placeholders in a reminder dialog using the
 * requirement-check details (kill counts, item quantities, etc.).
 */
function renderReminderDialog(quest, requirements) {
  const text = quest.reminderDialog || ''
  if (!text.includes('{')) return text
  const details = (requirements && requirements.details) || {}
  const firstReq = (quest.requirements && quest.requirements[0]) || {}
  const progress = details.currentKills ?? details.currentQuantity ?? 0
  const count =
    details.requiredKills ?? details.requiredQuantity ?? firstReq.count ?? firstReq.quantity ?? 0
  return text.replace(/\{progress\}/g, progress).replace(/\{count\}/g, count)
}

/**
 * Resolve an NPC's idle dialog (no active quest) from an ordered, priority list.
 * Each entry is { ifCompleted: questId | null, message }. The first entry whose
 * quest is completed wins; an entry with ifCompleted === null is the default.
 */
function resolveIdleDialog(idleDialogs, progressById) {
  for (const entry of idleDialogs || []) {
    if (entry.ifCompleted === null || entry.ifCompleted === undefined) return entry.message
    if (progressById[entry.ifCompleted]?.completed) return entry.message
  }
  return ''
}

/**
 * Build a generic "talk to NPC" handler driven entirely by quest data.
 *
 * For the NPC's quests (sorted by number) it finds the active one — honoring
 * a clicked `targetQuestId` when several are active at once — and renders:
 *  - a turn-in prompt (completionDialog + "Complete Quest" button) when the
 *    requirements are met (and the player isn't just viewing via introOnly), or
 *  - a reminder (reminderDialog) otherwise.
 * When no quest is active it shows an idle dialog from `npc.idleDialogs`.
 *
 * All dialog text lives in quests.json; this factory carries only the NPC's
 * presentation (icon/color/title) and its idle-dialog cascade.
 */
function createNpcTalkHandler(npc) {
  return async (playerId, roomState, actionData = {}) => {
    const { listQuestsByGiver, getQuestProgress, checkQuestRequirements } = require('./services/quest-service')
    const introOnly = !!actionData.introOnly
    const targetQuestId = actionData.questId ?? null

    roomState.touchActivity()

    const npcModal = (extra = {}) => ({
      type: 'icon',
      icon: npc.icon,
      iconColor: npc.iconColor,
      title: npc.title,
      ...extra,
    })
    const feedback = (message, data) =>
      createActionFeedbackPayload(npc.action, 'success', message, { roomId: roomState.roomId, showModal: true, ...data })
    const result = payload => ({ success: true, action: npc.action, playerEvents: [{ event: 'action:feedback', payload }] })

    const quests = listQuestsByGiver(npc.npcId)

    const progressById = {}
    for (const quest of quests) {
      progressById[quest.id] = await getQuestProgress(playerId, quest.id)
    }

    const activeQuests = quests.filter(quest => {
      const progress = progressById[quest.id]
      return progress && !progress.completed
    })

    // Prefer a specifically-clicked quest when multiple are active at once;
    // otherwise take the first active quest by number.
    let activeQuest = null
    if (targetQuestId) {
      activeQuest = activeQuests.find(quest => quest.id === targetQuestId) || null
    }
    if (!activeQuest) {
      activeQuest = activeQuests[0] || null
    }

    if (activeQuest) {
      const requirements = await checkQuestRequirements(playerId, activeQuest.id)
      const hasRequirements = (activeQuest.requirements || []).length > 0
      // Show the turn-in prompt when requirements are met. `introOnly` (viewing a
      // quest from the list) suppresses it — but only for quests that actually have
      // requirements, so requirement-less intro quests still offer their button.
      const showTurnIn = requirements.met && (!introOnly || !hasRequirements)

      if (showTurnIn) {
        return result(
          feedback(`You approach the ${npc.title}.`, {
            modalContent: npcModal({ message: activeQuest.completionDialog }),
            questComplete: {
              questTitle: activeQuest.title,
              rewards: activeQuest.rewards || [],
              levelUp: null,
              newQuestTitles: [],
            },
            buttons: [{ label: 'Complete Quest', direction: `complete_quest:${activeQuest.id}`, primary: true }],
          })
        )
      }

      return result(
        feedback(`You talk to the ${npc.title}.`, {
          modalContent: npcModal({ message: renderReminderDialog(activeQuest, requirements) }),
        })
      )
    }

    // No active quest — show the NPC's idle dialog.
    return result(
      feedback(`You talk to the ${npc.title}.`, {
        modalContent: npcModal({ message: resolveIdleDialog(npc.idleDialogs, progressById) }),
      })
    )
  }
}

/**
 * Static chest loot tables, keyed by roomId then action name. Hoisted out of the
 * individual chest handlers so they are a single source of truth: the handlers
 * read their rewards from here, and the World Tool's Item Compendium indexes
 * them to show which chest an item comes from. `label` is the friendly chest
 * name shown in the item-source column.
 */
const CHEST_LOOT = {
  '001': {
    'open gold chest': {
      label: 'Gold Chest',
      xp: 50,
      items: [
        { itemSlug: 'red-potion', quantity: 3 },
        { itemSlug: 'cooked-meat', quantity: 5 },
        { itemSlug: 'glowing-brace', quantity: 1 },
        { itemSlug: 'boomerang', quantity: 1, highlighted: true },
      ],
    },
  },
}

/**
 * Build a rolling-cooldown gather action: grants `quantity` of an item in one
 * click, then locks for `cooldownMs` (window starts at the moment of collection,
 * decoupled from the global world tick). Optionally requires a tool in inventory.
 */
function makeGatherAction({ itemSlug, itemNamePlural, cooldownMs, quantity = 5, toolRequired = null, emptyVerb = 'appear', missingToolMessage = null }) {
  return {
    cooldownMs,
    ...(toolRequired ? { toolRequired } : {}),
    effects: [{ type: 'grantItem', itemSlug, quantity }],
    generateMessage: (effects, capInfo) => {
      if (capInfo?.missingTool) {
        return missingToolMessage || `You need a ${capInfo.missingTool} to do that.`
      }
      if (!effects?.[0]?.success) {
        const secondsRemaining = capInfo?.secondsUntilReset ?? 0
        return `No more ${itemNamePlural} right now. More will ${emptyVerb} in ${formatTimeRemaining(secondsRemaining)}.`
      }
      // Running total of this resource in inventory after the grant, if available.
      const inventory = effects?.[0]?.inventory
      const entry = Array.isArray(inventory)
        ? inventory.find((i) => i?.template?.slug === itemSlug)
        : null
      const total = entry?.quantity
      return `You collect ${quantity} ${itemNamePlural}${typeof total === 'number' ? ` (${total})` : ''}.`
    },
    determineOutcome: ({ success }) => (success ? 'success' : 'info'),
  }
}

/**
 * Shovel sand: a tool-gated gather action shared across the beach rooms.
 */
function makeSandAction() {
  return makeGatherAction({
    itemSlug: 'sand',
    itemNamePlural: 'sand',
    cooldownMs: 5 * 60 * 1000,
    quantity: 5,
    toolRequired: 'shovel',
    emptyVerb: 'settle',
    missingToolMessage: 'You need a shovel to dig for sand here.',
  })
}

/**
 * Shovel dirt: a tool-gated gather action (room 014). Mirrors sand.
 */
function makeDirtAction() {
  return makeGatherAction({
    itemSlug: 'dirt',
    itemNamePlural: 'dirt',
    cooldownMs: 5 * 60 * 1000,
    quantity: 5,
    toolRequired: 'shovel',
    emptyVerb: 'settle',
    missingToolMessage: 'You need a shovel to dig for dirt here.',
  })
}

/**
 * Mine stone: a tool-gated gather action (room 015). Mirrors sand/dirt.
 */
function makeStoneAction() {
  return makeGatherAction({
    itemSlug: 'stone',
    itemNamePlural: 'stone',
    cooldownMs: 30 * 60 * 1000,
    quantity: 5,
    toolRequired: 'pickaxe',
    emptyVerb: 'settle',
    missingToolMessage: 'You need a pickaxe to mine stone here.',
  })
}

/**
 * Pick wheat: an untooled gather action (room 020). 5 every 60 minutes.
 */
function makeWheatAction() {
  return makeGatherAction({
    itemSlug: 'wheat',
    itemNamePlural: 'wheat',
    cooldownMs: 60 * 60 * 1000,
    quantity: 5,
    emptyVerb: 'grow',
  })
}

/**
 * Server-authoritative crafting handler. Shared by every crafting room (003 /
 * 021): reads `actionData.recipeId` and an optional `actionData.quantity` (the
 * number of times to run the recipe — 1 for "Craft", or the batch size for
 * "Craft All"), re-validates the recipe is allowed in this room, then in a
 * single transaction clamps the batch to what the player's materials and the
 * output's stack cap actually allow, consumes the inputs, and grants the output.
 * The client panel only renders availability — this is the gate that actually
 * mutates inventory, so a stale or tampered client cannot dupe items.
 */
async function executeCraft(playerId, roomState, actionData = {}) {
  const { prisma } = require('../db-client')
  const { getItemBySlug } = require('./services/inventory-service')

  roomState.touchActivity()

  const action = 'craft'
  const fail = (message, recipeId = null) => ({
    success: false,
    action,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(action, 'failure', message, {
          roomId: roomState.roomId,
          ...(recipeId ? { recipeId } : {}),
        }),
      },
    ],
  })

  const recipeId = actionData?.recipeId
  const recipe = recipeId ? getRecipeById(recipeId) : null
  if (!recipe || !isCraftingRoom(roomState.roomId)) {
    return fail('You cannot craft that here.')
  }

  // Requested batch size. Floor + clamp to a sane ceiling; the transaction
  // clamps further to what materials / stack cap allow.
  const requested = Math.floor(Number(actionData?.quantity) || 1)
  if (!Number.isFinite(requested) || requested < 1) {
    return fail('Invalid craft amount.', recipe.id)
  }

  // Resolve the output template up front so we can name it in messages and
  // honor its stacking cap before consuming anything.
  const outputTemplate = await getItemBySlug(recipe.output.slug)
  if (!outputTemplate) {
    return fail('That recipe is currently unavailable.', recipe.id)
  }

  try {
    const { inventory, crafted } = await prisma.$transaction(async (tx) => {
      // 1. How many batches the player's materials support (min across inputs).
      let feasible = requested
      for (const input of recipe.inputs) {
        const template = await getItemBySlug(input.slug)
        if (!template) {
          throw new CraftError('That recipe is currently unavailable.')
        }
        const owned = await tx.playerItem.findFirst({
          where: { playerId, templateId: template.id },
        })
        const have = owned?.quantity ?? 0
        if (have < input.qty) {
          throw new CraftError(`You need ${input.qty} ${template.name} to craft ${recipe.label} (you have ${have}).`)
        }
        feasible = Math.min(feasible, Math.floor(have / input.qty))
      }

      // 2. Clamp again by how much output space remains under its stack cap.
      const existingOutput = await tx.playerItem.findFirst({
        where: { playerId, templateId: outputTemplate.id },
      })
      const outputLimit = outputTemplate.max ?? Infinity
      const room = outputLimit === Infinity
        ? feasible
        : Math.floor((outputLimit - (existingOutput?.quantity ?? 0)) / recipe.output.qty)
      if (room <= 0) {
        throw new CraftError(`You already have the maximum number of ${outputTemplate.name}.`)
      }
      feasible = Math.min(feasible, room)

      if (feasible < 1) {
        throw new CraftError(`You don't have the materials to craft ${recipe.label}.`)
      }

      // 3. Consume inputs (qty × batches), then grant the output — all within
      //    the transaction so any failure rolls the whole craft back.
      for (const input of recipe.inputs) {
        const removed = await removeItemBySlug(playerId, input.slug, input.qty * feasible, tx)
        if (!removed.success) {
          throw new CraftError('You no longer have the materials for that.')
        }
      }
      const granted = await grantItemOnce(playerId, recipe.output.slug, recipe.output.qty * feasible, tx)
      if (!granted.granted) {
        throw new CraftError(granted.reason || 'Could not craft that item.')
      }

      return { inventory: await getPlayerInventory(playerId, tx), crafted: feasible * recipe.output.qty }
    })

    const message = `You craft ${crafted} ${outputTemplate.name}.`
    return {
      success: true,
      action,
      playerEvents: [
        {
          event: 'action:feedback',
          payload: createActionFeedbackPayload(action, 'success', message, {
            roomId: roomState.roomId,
            recipeId: recipe.id,
            crafted,
            inventory,
          }),
        },
      ],
    }
  } catch (error) {
    if (error instanceof CraftError) {
      return fail(error.message, recipe.id)
    }
    console.error('Craft error:', error)
    return fail('Something went wrong while crafting.', recipe.id)
  }
}

/** Internal sentinel so craft validation failures roll back the transaction. */
class CraftError extends Error {}

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
          description: 'Welcome! This directory shows nearby locations you can explore.'
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
      }
    },
    'open gold chest': async (playerId, roomState) => {
      const { prisma } = require('../db-client')
      const {
        playerHasItem,
        removeItemBySlug,
        grantItemOnce,
        getPlayerInventory,
        getItemBySlug,
      } = require('./services/inventory-service')
      const { checkAndApplyLevelUp } = require('./services/leveling-service')

      roomState.touchActivity()

      // Reward table. The boomerang is the featured drop. Pulled from the shared
      // CHEST_LOOT registry so the open flow, the "already opened" reminder, and
      // the World Tool's source index never drift apart.
      const { xp: xpAmount, items: itemRewards } = CHEST_LOOT['001']['open gold chest']

      // Build the enriched item reward list for the rewards modal. Gold is
      // omitted here because it is rolled randomly per open — callers that know
      // the exact amount (the open flow) append their own currency entry.
      const buildEnrichedItemRewards = async () => {
        const rewards = [{ type: 'xp', amount: xpAmount }]
        for (const reward of itemRewards) {
          const template = await getItemBySlug(reward.itemSlug)
          rewards.push({
            type: 'item',
            itemSlug: reward.itemSlug,
            name: template?.name || reward.itemSlug,
            quantity: reward.quantity,
            highlighted: !!reward.highlighted,
          })
        }
        return rewards
      }

      // `chest1` is the persistent per-player "gold chest opened" flag. It is the
      // source of truth for re-opens and is reserved for gating future events.
      const flagRow = await prisma.user.findUnique({
        where: { id: playerId },
        select: { chest1: true },
      })

      // Already opened: remind the player what they got, but never re-grant.
      if (flagRow?.chest1) {
        return {
          success: true,
          action: 'open gold chest',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload(
                'open gold chest',
                'info',
                'You have already opened the gold chest.',
                {
                  roomId: roomState.roomId,
                  showModal: true,
                  modalContent: {
                    type: 'icon',
                    icon: 'chest2',
                    iconColor: 'amber-500/90',
                    title: 'The gold chest stands open',
                    header: 'Already Opened',
                    message:
                      'You have already cleared this chest of its hoard of gold and XP. Here is what it held:',
                  },
                  questComplete: {
                    questTitle: '',
                    rewards: await buildEnrichedItemRewards(),
                    levelUp: null,
                    newQuestTitles: [],
                  },
                }
              ),
            },
          ],
        }
      }

      const lockedFeedback = () => ({
        success: false,
        action: 'open gold chest',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload(
              'open gold chest',
              'info',
              'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
              {
                roomId: roomState.roomId,
                showModal: true,
                modalContent: {
                  type: 'icon',
                  icon: 'chest',
                  iconColor: 'amber-500/90',
                  title: 'You try to open the gold chest',
                  message:
                    'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
                },
              }
            ),
          },
        ],
      })

      // The Gold Key is a one-time, max:1 quest reward gating the first
      // open. After this, the persistent `chest1` flag (set below) gates re-opens.
      const hasKey = await playerHasItem(playerId, 'gold-key')
      if (!hasKey) {
        return lockedFeedback()
      }

      const goldAmount = 100 + Math.floor(Math.random() * 101) // 100–200

      // Consume the key, grant items, apply gold/xp, and set the opened flag
      // atomically so a partial failure never leaves the player keyless, looted,
      // or with an inconsistent flag.
      let updatedUser
      try {
        updatedUser = await prisma.$transaction(async (tx) => {
          const removed = await removeItemBySlug(playerId, 'gold-key', 1, tx)
          if (!removed.success) {
            throw new Error('GOLD_KEY_MISSING')
          }
          for (const reward of itemRewards) {
            const granted = await grantItemOnce(playerId, reward.itemSlug, reward.quantity, tx)
            if (!granted.granted) {
              throw new Error(`Failed to grant ${reward.itemSlug}: ${granted.reason}`)
            }
          }
          return tx.user.update({
            where: { id: playerId },
            data: {
              currency: { increment: goldAmount },
              xp: { increment: xpAmount },
              chest1: true,
            },
            select: { id: true, currency: true, xp: true, chest1: true },
          })
        })
      } catch (err) {
        // Key vanished between the check and the transaction — treat as still locked.
        if (err.message === 'GOLD_KEY_MISSING') {
          return lockedFeedback()
        }
        return createErrorResult('open gold chest', 'Something went wrong opening the chest. Please try again.')
      }

      // Mirror quest completion: detect level-up and refetch inventory after commit.
      const [levelUp, inventory] = await Promise.all([
        checkAndApplyLevelUp(playerId),
        getPlayerInventory(playerId),
      ])

      // Enrich rewards for the rewards modal (same shape as quest completion).
      // Insert the exact rolled gold after the XP entry; items come from the
      // shared builder so the haul matches the "already opened" reminder.
      const enrichedRewards = await buildEnrichedItemRewards()
      enrichedRewards.splice(1, 0, { type: 'currency', amount: goldAmount })

      const playerEvents = [
        {
          event: 'action:feedback',
          payload: createActionFeedbackPayload(
            'open gold chest',
            'success',
            'You unlock the gold chest with the Gold Key. It creaks open, revealing a glittering hoard!',
            {
              roomId: roomState.roomId,
              inventory,
              player: updatedUser,
              showModal: true,
              modalContent: {
                type: 'icon',
                icon: 'chest',
                iconColor: 'amber-500/90',
                title: 'You open the gold chest',
                header: 'Gold Chest Unlocked!',
                message: 'The Gold Key turns with a heavy click. Inside, a glittering hoard awaits!',
              },
              // questTitle left empty so the modal shows "Rewards" without a quest header.
              questComplete: {
                questTitle: '',
                rewards: enrichedRewards,
                levelUp: levelUp?.leveled ? levelUp : null,
                newQuestTitles: [],
              },
            }
          ),
        },
      ]

      if (levelUp?.leveled) {
        playerEvents.push({ event: 'player:level-up', payload: levelUp })
      }

      return {
        success: true,
        action: 'open gold chest',
        playerEvents,
      }
    },
  },
  '002': {
    'pick redberry': makeGatherAction({
      itemSlug: 'redberry',
      itemNamePlural: 'redberries',
      cooldownMs: 15 * 60 * 1000,
      quantity: 5,
      emptyVerb: 'grow',
    }),
  },
  '003': {
    'ex cabin': "You examine the cabin. It's warm and cozy, with a cooking fire burning and the Old Man rocking in his chair.",
    'attack dummy': 'You attack the training dummy. Your weapon strikes true!',
    'craft': executeCraft,
    'talk to old man': createNpcTalkHandler({
      npcId: 'old_man',
      action: 'talk to old man',
      icon: 'npc-oldman',
      iconColor: 'yellow-400',
      title: 'Old Man',
      idleDialogs: [
        {
          ifCompleted: 'quest_oldman_004',
          message: 'The Old Man rocks contentedly in his chair. "The gator\'s gone, the rats are gone, and my wife\'s got her jam. You\'ve been a true blessing to this old man, traveler."',
        },
        {
          ifCompleted: 'quest_oldman_003',
          message: 'The Old Man rocks contentedly in his chair. "The rats are gone, the gator is dealt with, and my wife got her flower. You\'ve been a true blessing, traveler."',
        },
        {
          ifCompleted: 'quest_oldman_001',
          message: 'The Old Man smiles warmly. "Thank you again for your help, traveler! That flower made the perfect addition to my recipe. If you need anything else, feel free to ask."',
        },
        {
          ifCompleted: null,
          message: 'The Old Man looks up from his rocking chair with a warm smile. "Ah, traveler! Welcome to my cabin. I\'m glad you found your way here."',
        },
      ],
    }),
  },
  '007': {
    'talk to young soldier': createNpcTalkHandler({
      npcId: 'young_soldier',
      action: 'talk to young soldier',
      icon: 'npc-youngsoldier',
      iconColor: 'blue-400',
      title: 'Young Soldier',
      idleDialogs: [
        {
          ifCompleted: 'quest_youngsoldier_002',
          message: 'You proved yourself, Wanderer. If you\'re looking for more work, head northwest to Jack Lumber\'s cabin. He\'s got quests that\'ll open the way to the Forest.',
        },
        {
          ifCompleted: 'quest_youngsoldier_001',
          message: 'Wow, you can pick up a sword. I can\'t believe we\'re giving XP for this.',
        },
        {
          ifCompleted: null,
          message: '"What are you doing talking to me? You\'re supposed to talk to the Old Man west of here first."',
        },
      ],
    }),
  },
  '004': {},
  '005': {
    'pick blueberry': makeGatherAction({
      itemSlug: 'blueberry',
      itemNamePlural: 'blueberries',
      cooldownMs: 30 * 60 * 1000,
      quantity: 5,
      emptyVerb: 'grow',
    }),
  },
  '014': { 'shovel dirt': makeDirtAction() },
  '015': { 'shovel sand': makeSandAction(), 'mine stone': makeStoneAction() },
  '016': { 'shovel sand': makeSandAction() },
  '017': { 'shovel sand': makeSandAction() },
  '018': { 'shovel sand': makeSandAction() },
  '019': { 'shovel sand': makeSandAction() },
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

      // Items available to buy in this shop (organized by category in the UI)
      const shopItemSlugs = [
        // Main hand weapons
        'dagger',
        'basic-staff',
        'mace',
        'broad-sword',
        'long-sword',
        // Off hand
        'kite-shield',
        'buckler',
        // Armor
        'basic-hood',
        'padded-armor',
        'black-gloves',
        'black-boots',
        // Consumables
        'red-potion',
        'blue-potion',
      ]
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
          // Included so the buy cards can render icons, stat mods and the
          // weapon line just like the inventory/sell cards.
          weaponCategory: true,
          metadata: true,
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
  '024': {
    'talk to jack lumber': createNpcTalkHandler({
      npcId: 'jack_lumber',
      action: 'talk to jack lumber',
      icon: 'npc-jacklumber',
      iconColor: 'green-400',
      title: 'Jack Lumber',
      idleDialogs: [
        {
          ifCompleted: 'quest_jacklumber_000',
          message: '"The Forest Path is open! Get out there and see what\'s beyond the Grassy Field. And remember — keep that hatchet sharp and your bow ready!"',
        },
        {
          ifCompleted: null,
          message: '"I\'m Jack Lumber, get it! Like Lumberjack! Come back when you\'ve proven yourself to the Young Soldier and I\'ll show you what I can do."',
        },
      ],
    }),
    'craft': executeCraft,
  },
  '025': {
    'chop wood': makeGatherAction({
      itemSlug: 'wood',
      itemNamePlural: 'wood',
      cooldownMs: 15 * 60 * 1000,
      quantity: 5,
      toolRequired: 'hatchet',
      emptyVerb: 'grow',
      missingToolMessage: 'You need a hatchet to chop wood here. There should be one at Jack\'s cabin to the south.',
    }),
  },
  '020': {
    'rest at waterfall': async (playerId, roomState) => roomState.executeWaterfallRest(playerId),
    'pick wheat': makeWheatAction(),
  },
  '021': {
    'craft': executeCraft,
  },
  '999': {
    'rest in lobby': async (playerId, roomState) => roomState.executeLobbyRest(playerId),
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

  // Tool requirement gate (e.g. a shovel is required to dig sand)
  if (definition.toolRequired) {
    const hasTool = await playerHasItem(playerId, definition.toolRequired)
    if (!hasTool) {
      const message = typeof definition.generateMessage === 'function'
        ? definition.generateMessage([{ success: false, reason: 'missingTool' }], { missingTool: definition.toolRequired })
        : `You need a ${definition.toolRequired} to do that.`
      const outcome = typeof definition.determineOutcome === 'function'
        ? definition.determineOutcome({ success: false, effectResults: [{ success: false }], capInfo: { missingTool: definition.toolRequired } }) || 'failure'
        : 'failure'
      return {
        success: false,
        action: actionName,
        message,
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload(actionName, outcome, message, { roomId: roomState.roomId }),
          },
        ],
      }
    }
  }

  // Rolling cooldown gate: per-action window that starts when the player last
  // collected (decoupled from the global world tick). Grants the full batch in
  // one click, then locks until the window elapses.
  let cooldownSeconds = null
  if (definition.cooldownMs) {
    const cd = await checkAndConsumeCooldown(playerId, roomState.roomId, actionName, definition.cooldownMs)
    if (!cd.allowed) {
      const capInfo = { remaining: 0, secondsUntilReset: cd.secondsRemaining }
      const message = typeof definition.generateMessage === 'function'
        ? definition.generateMessage([{ success: false }], capInfo)
        : 'You cannot do that yet.'
      const outcome = typeof definition.determineOutcome === 'function'
        ? definition.determineOutcome({ success: false, effectResults: [{ success: false }], capInfo }) || 'failure'
        : 'failure'
      return {
        success: false,
        action: actionName,
        message,
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload(actionName, outcome, message, { roomId: roomState.roomId, remaining: 0, secondsUntilReset: cd.secondsRemaining }),
          },
        ],
      }
    }
    cooldownSeconds = cd.secondsRemaining
  }

  const effects = Array.isArray(definition.effects) ? definition.effects : []
  const { results: effectResults, inventory } = await executeEffects(effects, playerId)

  const capInfo = definition.cooldownMs
    ? { remaining: 0, secondsUntilReset: cooldownSeconds }
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

    if (effect.type === 'consumeItem') {
      const result = await removeItemBySlug(playerId, effect.itemSlug, effect.quantity || 1)
      results.push({
        success: result.success,
        message: result.error,
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

/**
 * Find the rolling-cooldown gather action (if any) defined for a room.
 * Returns { action, cooldownMs } or null. Single source of truth for the
 * client's in-room countdown so timing never has to be duplicated.
 */
function getGatherActionForRoom(roomId) {
  return getGatherActionsForRoom(roomId)[0] ?? null
}

/**
 * All rolling-cooldown gather actions in a room (sand / dirt / stone / berries).
 * A room can host more than one (e.g. shovel sand + mine stone), so this returns
 * every match; the singular helper above is kept for callers that want the first.
 * @returns {Array<{ action: string, cooldownMs: number, quantity: number|null }>}
 */
function getGatherActionsForRoom(roomId) {
  const actions = ROOM_ACTIONS[roomId]
  if (!actions) return []
  const result = []
  for (const [action, def] of Object.entries(actions)) {
    if (def && typeof def === 'object' && def.cooldownMs) {
      const grant = Array.isArray(def.effects)
        ? def.effects.find((e) => e?.type === 'grantItem')
        : null
      result.push({ action, cooldownMs: def.cooldownMs, quantity: grant?.quantity ?? null })
    }
  }
  return result
}

module.exports = {
  executeRoomAction,
  ROOM_ACTIONS,
  CHEST_LOOT,
  getGatherActionForRoom,
  getGatherActionsForRoom,
}

