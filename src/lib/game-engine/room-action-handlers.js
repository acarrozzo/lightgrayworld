/**
 * Room-specific action handlers
 * Handles execution of actions that are unique to specific rooms
 */
const { grantPersonalItemOnce } = require('./effects')
const { grantItemOnce, playerHasItem, getHeldQuantity, removeItemBySlug, getPlayerInventory } = require('./services/inventory-service')
const { checkAndConsumeCooldown } = require('./services/action-cap-service')
const { grantTeleport } = require('./teleport-grants')
const { getRecipeById, isCraftingRoom } = require('../game-data/crafting-recipes')
const { getShop } = require('../game-data/shops')

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

    // Optional pre-check: if it fails, show a specific message and bail.
    if (npc.preCheck) {
      const passed = await npc.preCheck(playerId)
      if (!passed) {
        const npcModalObj = { type: 'icon', icon: npc.icon, iconColor: npc.iconColor, title: npc.title, message: npc.preCheckMessage || 'Come back later.' }
        return {
          success: true,
          action: npc.action,
          playerEvents: [{
            event: 'action:feedback',
            payload: createActionFeedbackPayload(npc.action, 'success', `You talk to the ${npc.title}.`, { roomId: roomState.roomId, showModal: true, modalContent: npcModalObj }),
          }],
        }
      }
    }

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
 * Build a shop's `view shop` action from the shared registry (game-data/shops.js).
 *
 * The stock list lives in one place because two callers need it and must agree:
 * this action (which renders the cards) and `api/shop/buy` (which decides whether
 * a purchase is legal). Prices are never passed through here — the buy route
 * charges `ItemTemplate.value` via shop-pricing, so what the card shows and what
 * the player is charged come from the same column.
 *
 * A shop's own `requiresQuest` (shops.js) is checked first, so the stock list and
 * the buy route agree about who may trade. `gate`, when given, is an extra
 * async (playerId) => boolean layered on top of it.
 */
function makeShopHandler(roomId, { gate = null, lockedMessage = null, icon = 'basicshop', iconColor = 'amber-500' } = {}) {
  return async (playerId, roomState) => {
    const { prisma } = require('../db-client')
    const { getPlayerInventory } = require('./services/inventory-service')

    const shop = getShop(roomId)
    if (!shop) {
      return createErrorResult('view shop', 'There is no shop here.')
    }

    const { shopRequiresQuest } = require('../game-data/shops')
    const requiredQuest = shopRequiresQuest(roomId)
    const membershipOk = requiredQuest ? await makeGuildMemberCheck(requiredQuest)(playerId) : true

    if (!membershipOk || (gate && !(await gate(playerId)))) {
      return {
        success: true,
        action: 'view shop',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload('view shop', 'info', lockedMessage || 'The shop is closed to you.', {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: {
                type: 'icon',
                icon,
                iconColor,
                title: shop.name,
                message: lockedMessage || 'The shop is closed to you.',
              },
            }),
          },
        ],
      }
    }

    const player = await prisma.user.findUnique({
      where: { id: playerId },
      select: { currency: true },
    })
    if (!player) {
      return createErrorResult('view shop', 'Player not found')
    }

    const templates = await prisma.itemTemplate.findMany({
      where: { slug: { in: shop.stock } },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        value: true,
        type: true,
        equipSlot: true,
        weaponCategory: true,
        metadata: true,
      },
    })

    // Preserve the registry's display order — findMany returns rows in whatever
    // order Postgres likes, and the stock list is deliberately grouped.
    const bySlug = new Map(templates.map((t) => [t.slug, t]))
    const shopItems = shop.stock.map((slug) => bySlug.get(slug)).filter(Boolean)

    const inventory = await getPlayerInventory(playerId)

    roomState.touchActivity()

    return {
      success: true,
      action: 'view shop',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: createActionFeedbackPayload('view shop', 'success', `You browse ${shop.name}.`, {
            roomId: roomState.roomId,
            showModal: true,
            modalContent: {
              type: 'shop',
              shopName: shop.name,
              shopItems,
              playerCurrency: player.currency,
              playerInventory: inventory,
            },
          }),
        },
      ],
    }
  }
}

/**
 * Is the player a member of the given guild? Membership is the guild's
 * initiation quest being complete — the same fact the guild's `up` gate reads.
 */
function makeGuildMemberCheck(questId) {
  return async (playerId) => {
    const { prisma } = require('../db-client')
    const progress = await prisma.questProgress.findUnique({
      where: { userId_questId: { userId: playerId, questId } },
      select: { completed: true },
    })
    return !!progress?.completed
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
  // Forest Gold Chest. Legacy handed out 3 Purple Potions here; the modern game
  // has no purple potion yet, so the same 3-potion allowance is split red/blue,
  // matching the substitution already made for the Forest Gnome's berry quest.
  '119': {
    'open gold chest': {
      label: 'Forest Gold Chest',
      xp: 200,
      items: [
        { itemSlug: 'wood', quantity: 20 },
        { itemSlug: 'cooked-meat', quantity: 10 },
        { itemSlug: 'red-potion', quantity: 3 },
        { itemSlug: 'blue-potion', quantity: 3 },
        { itemSlug: 'hunter-ring', quantity: 1, highlighted: true },
        { itemSlug: 'hunter-gloves', quantity: 1, highlighted: true },
      ],
    },
  },
  // Babylon Gardens gold chest, behind the Mayor's Gold Key. Legacy handed out
  // 5 each of reds/greens/blues/yellows, both regen III rings, and one of twelve
  // silver pieces rolled at random — `randomItems` is that roll. (A chest that
  // needs more than one roll passes a list of pools instead; see 309.)
  '224': {
    'open gold chest': {
      label: 'Red Town Gold Chest',
      xp: 300,
      items: [
        { itemSlug: 'reds', quantity: 5 },
        { itemSlug: 'greens', quantity: 5 },
        { itemSlug: 'blues', quantity: 5 },
        { itemSlug: 'yellows', quantity: 5 },
        { itemSlug: 'ring-of-health-regen-iii', quantity: 1, highlighted: true },
        { itemSlug: 'ring-of-mana-regen-iii', quantity: 1, highlighted: true },
      ],
      randomItems: [
        { itemSlug: 'silver-sword', quantity: 1 },
        { itemSlug: 'silver-2h-sword', quantity: 1 },
        { itemSlug: 'silver-boomerang', quantity: 1 },
        { itemSlug: 'silver-bow', quantity: 1 },
        { itemSlug: 'silver-crossbow', quantity: 1 },
        { itemSlug: 'silver-shield', quantity: 1 },
        { itemSlug: 'silver-helmet', quantity: 1 },
        { itemSlug: 'silver-breastplate', quantity: 1 },
        { itemSlug: 'silver-gauntlets', quantity: 1 },
        { itemSlug: 'silver-boots', quantity: 1 },
        { itemSlug: 'silver-ring', quantity: 1 },
        { itemSlug: 'silver-necklace', quantity: 1 },
      ],
    },
  },
  // The Dwarf Treasury's Gold Chest (309), behind the Dwarf Captain's key. The
  // original rolled TWO items on top of its fixed haul — one Ring of X VII and
  // one of the twelve silver pieces — which is the case `randomItems` takes a
  // list of pools for.
  //
  // Its third headline reward was a Pet Bat, and there is no pet slot in the
  // game yet (EquipSlot has MOUNT and nothing else). A Ring of Defense X stands
  // in for it: permanent, notable, and of the same tier. If pets land, this is
  // where the bat goes back.
  '309': {
    'open gold chest': {
      label: 'Rocky Flats Gold Chest',
      xp: 500,
      items: [
        { itemSlug: 'meatball', quantity: 5 },
        { itemSlug: 'ring-of-defense-x', quantity: 1, highlighted: true },
      ],
      randomItems: [
        [
          { itemSlug: 'ring-of-strength-vii', quantity: 1 },
          { itemSlug: 'ring-of-dexterity-vii', quantity: 1 },
          { itemSlug: 'ring-of-magic-vii', quantity: 1 },
          { itemSlug: 'ring-of-defense-vii', quantity: 1 },
        ],
        [
          { itemSlug: 'silver-sword', quantity: 1 },
          { itemSlug: 'silver-2h-sword', quantity: 1 },
          { itemSlug: 'silver-boomerang', quantity: 1 },
          { itemSlug: 'silver-bow', quantity: 1 },
          { itemSlug: 'silver-crossbow', quantity: 1 },
          { itemSlug: 'silver-shield', quantity: 1 },
          { itemSlug: 'silver-helmet', quantity: 1 },
          { itemSlug: 'silver-breastplate', quantity: 1 },
          { itemSlug: 'silver-gauntlets', quantity: 1 },
          { itemSlug: 'silver-boots', quantity: 1 },
          { itemSlug: 'silver-ring', quantity: 1 },
          { itemSlug: 'silver-necklace', quantity: 1 },
        ],
      ],
    },
  },
}

/**
 * Build a rolling-cooldown gather action: grants `quantity` of an item in one
 * click, then locks for `cooldownMs` (window starts at the moment of collection,
 * decoupled from the global world tick). Optionally requires a tool in inventory.
 *
 * `toolTiers` (best tool first, e.g. `[{ slug: 'iron-hatchet', quantity: 10,
 * label: 'iron hatchet' }, { slug: 'hatchet', quantity: 5, label: 'hatchet' }]`)
 * replaces `toolRequired`: owning any tier unlocks the action, and the best tier
 * held sets the batch size. `effects` still carries the lowest tier's yield so
 * the declared quantity (what getGatherActionsForRoom reports to the UI) stays
 * the baseline; `resolve` upgrades it per player at execution time.
 */
function makeGatherAction({ itemSlug, itemNamePlural, cooldownMs = null, quantity = 5, toolRequired = null, toolTiers = null, emptyVerb = 'appear', missingToolMessage = null, maxHeld = null, maxHeldMessage = null, readyLabel = null, topUpTo = null, topUpMessage = null }) {
  const tiers = Array.isArray(toolTiers) && toolTiers.length > 0 ? toolTiers : null
  const baseQuantity = tiers ? tiers[tiers.length - 1].quantity : quantity
  // A top-up node hands you back up to its number rather than a fixed batch, so
  // it can never be farmed above that line. The original wrote these as
  // `SET leather = 5` — a refill, not an addition — and the Forest's free
  // supplies (leather, arrows, wood, the lake's fish) all work that way.
  const cap = typeof topUpTo === 'number' ? topUpTo : maxHeld

  return {
    // Explicit marker: a gather is not always identifiable by its cooldown,
    // since a capped node (Jack's tree) can have a cap and no timer at all.
    isGather: true,
    ...(cooldownMs ? { cooldownMs } : {}),
    ...(toolRequired ? { toolRequired } : {}),
    ...(tiers ? { toolRequiredAny: tiers.map((tier) => tier.slug) } : {}),
    // Surfaced to the room UI so a capped node can label its own resource
    // ("3 wood left" / "5/5 wood") without the client hardcoding item names.
    itemNamePlural,
    // What the ready-state badge calls this node ("Tree"). Nodes that name
    // themselves show that name; the rest fall back to a plain "Ready" plus the
    // batch size on the client.
    ...(readyLabel ? { readyLabel } : {}),
    ...(typeof cap === 'number'
      ? {
          maxHeld: cap,
          precondition: async (playerId) => {
            const held = await getHeldQuantity(playerId, itemSlug)
            return held >= cap
              ? { allowed: false, capInfo: { atMaxHeld: true, held } }
              : { allowed: true }
          },
        }
      : {}),
    effects: [{ type: 'grantItem', itemSlug, quantity: typeof topUpTo === 'number' ? topUpTo : baseQuantity }],
    ...(typeof topUpTo === 'number'
      ? {
          resolve: async (playerId) => {
            const held = await getHeldQuantity(playerId, itemSlug)
            return { effects: [{ type: 'grantItem', itemSlug, quantity: Math.max(0, topUpTo - held) }], context: null }
          },
        }
      : {}),
    ...(tiers
      ? {
          resolve: async (playerId) => {
            for (const tier of tiers) {
              if (await playerHasItem(playerId, tier.slug)) {
                return {
                  effects: [{ type: 'grantItem', itemSlug, quantity: tier.quantity }],
                  context: { tier },
                }
              }
            }
            // Unreachable in practice — the tool gate already rejected the
            // player — but fall back to the baseline rather than granting extra.
            return { effects: [{ type: 'grantItem', itemSlug, quantity: baseQuantity }], context: null }
          },
        }
      : {}),
    generateMessage: (effects, capInfo, context) => {
      if (capInfo?.missingTool) {
        return missingToolMessage || `You need a ${capInfo.missingTool} to do that.`
      }
      if (capInfo?.atMaxHeld) {
        return maxHeldMessage || `You already have ${cap} ${itemNamePlural}. Come back if you run low.`
      }
      if (typeof topUpTo === 'number' && effects?.[0]?.success) {
        const collected = effects?.[0]?.quantity ?? 0
        return topUpMessage
          ? topUpMessage(collected, topUpTo)
          : `You collect ${collected} ${itemNamePlural}, bringing you back up to ${topUpTo}.`
      }
      if (!effects?.[0]?.success) {
        if (!cooldownMs) return `No more ${itemNamePlural} here right now.`
        const secondsRemaining = capInfo?.secondsUntilReset ?? 0
        return `No more ${itemNamePlural} right now. More will ${emptyVerb} in ${formatTimeRemaining(secondsRemaining)}.`
      }
      // Running total of this resource in inventory after the grant, if available.
      const inventory = effects?.[0]?.inventory
      const entry = Array.isArray(inventory)
        ? inventory.find((i) => i?.template?.slug === itemSlug)
        : null
      const total = entry?.quantity
      const collected = effects?.[0]?.quantity ?? baseQuantity
      const withTool = context?.tier?.label ? ` with your ${context.tier.label}` : ''
      return `You collect ${collected} ${itemNamePlural}${withTool}${typeof total === 'number' ? ` (${total})` : ''}.`
    },
    determineOutcome: ({ success }) => (success ? 'success' : 'info'),
  }
}

/**
 * Chop wood: the tool-gated gather shared by Jack's tree farm (025) and every
 * tree-bearing Forest room. Yields match the original game's per-swing amounts —
 * 1 wood with a plain hatchet, 2 with an iron one — so wood is earned by walking
 * the forest tree to tree, and the Gnome's iron hatchet halves that walk.
 */
function makeChopWoodAction({ missingToolMessage, readyLabel = 'Tree' }) {
  return makeGatherAction({
    itemSlug: 'wood',
    itemNamePlural: 'wood',
    cooldownMs: 15 * 60 * 1000,
    emptyVerb: 'grow',
    readyLabel,
    toolTiers: [
      { slug: 'iron-hatchet', quantity: 2, label: 'iron hatchet' },
      { slug: 'hatchet', quantity: 1, label: 'hatchet' },
    ],
    missingToolMessage,
  })
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
 * A free item you can only ever hold one of at a time: the Forest's replacement
 * Ring of Dexterity III (120) and Freddie's spare hammer (103). The original's
 * shape exactly — "you already have one, come back if you lose it" — so these
 * cannot be farmed, only replaced. Kept as an action rather than a ROOM_LOOT
 * drop because room items are shared and respawn per visit, which would make a
 * +3 ring infinitely duplicable.
 */
function makeFreeItemAction({ itemSlug, itemName, capLabel, icon, iconColor = 'amber-400', grantMessage, alreadyHaveMessage }) {
  return {
    // A gather node with a cap of one: that is what "free replacement" means,
    // and declaring it that way gets it a countdown-free cap badge in the room
    // and a row in the World Tool's item-source index for free.
    isGather: true,
    // The badge beside the button reads "1 hammer left" / "1/1 hammer", so it
    // wants the bare noun, not the article-carrying name the messages use.
    itemNamePlural: capLabel ?? itemName,
    maxHeld: 1,
    precondition: async (playerId) => {
      const held = await getHeldQuantity(playerId, itemSlug)
      return held >= 1 ? { allowed: false, capInfo: { alreadyHeld: true } } : { allowed: true }
    },
    effects: [{ type: 'grantItem', itemSlug, quantity: 1 }],
    generateMessage: (effects, capInfo) => {
      if (capInfo?.alreadyHeld) {
        return alreadyHaveMessage || `You already have ${itemName}. Come back here for another if you lose it.`
      }
      if (!effects?.[0]?.success) return `You cannot carry another ${itemName} right now.`
      return grantMessage || `You pick up ${itemName}.`
    },
    determineOutcome: ({ success }) => (success ? 'success' : 'info'),
    showModal: true,
    modalContent: { type: 'icon', icon, iconColor, title: itemName, message: grantMessage },
  }
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

  // A recipe may be locked behind a quest (Freddie's leather tier) and/or need a
  // tool held but not consumed (his hammer). Both are re-checked here, not just
  // rendered by the panel, so neither can be skipped by a hand-sent craft.
  if (recipe.unlock) {
    const { getQuestProgress } = require('./services/quest-service')
    const progress = await getQuestProgress(playerId, recipe.unlock.questId)
    // Accepting the quest is enough for Freddie's leather tier — he hands you the
    // technique with the job. The chef's meatballs set `requireCompleted`: he has
    // not taught you anything until you have actually brought him the meat.
    const unlocked = recipe.unlock.requireCompleted ? progress?.completed === true : !!progress
    if (!unlocked) {
      return fail(recipe.unlock.hint, recipe.id)
    }
  }
  if (recipe.tool) {
    // `anyOf` lets a better tool stand in for the named one — a steel or mithril
    // hammer works iron just as well, and the original accepted all three.
    const toolSlugs = [recipe.tool.slug, ...(recipe.tool.anyOf ?? [])]
    let hasTool = false
    for (const slug of toolSlugs) {
      if (await playerHasItem(playerId, slug)) {
        hasTool = true
        break
      }
    }
    if (!hasTool) {
      return fail(`You need a ${recipe.tool.name} to craft ${recipe.label}.`, recipe.id)
    }
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
 * Build a gold-chest "open" handler. Both gold chests behave identically: they
 * are locked until the player is holding a Gold Key, the key is consumed on the
 * first open, and a persistent per-player flag (`chest1`/`chest2`) records the
 * open so the chest can never be looted twice. The loot itself comes from the
 * shared CHEST_LOOT registry, keyed by room, so the open flow, the "already
 * opened" reminder, and the World Tool's item-source index never drift apart.
 *
 * @param {Object} opts
 * @param {string} opts.roomId       - CHEST_LOOT key for this chest's loot table
 * @param {string} opts.flagField    - User boolean column recording the open
 * @param {number} opts.goldMin      - Lowest gold roll (inclusive)
 * @param {number} opts.goldMax      - Highest gold roll (inclusive)
 * @param {string} opts.lockedMessage - Shown when the player has no Gold Key;
 *                                      names where this chest's key comes from
 */
function makeGoldChestHandler({ roomId, flagField, goldMin, goldMax, lockedMessage }) {
  return async (playerId, roomState) => {
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

    const { label, xp: xpAmount, items: itemRewards, randomItems } = CHEST_LOOT[roomId]['open gold chest']

    // Some chests add one item drawn from a pool on top of their fixed haul
    // (Babylon Gardens rolls one of the twelve silver pieces). Rolled once per
    // open, before the transaction, so the granted item and the rewards modal
    // can never disagree about what came out.
    // `randomItems` is either one pool or a list of pools; one entry is rolled
    // from each. Babylon Gardens rolls a single silver piece; the Rocky Flats
    // Treasury rolls a ring AND a silver piece, which is why pools are a list.
    const pools =
      Array.isArray(randomItems) && randomItems.length > 0
        ? (Array.isArray(randomItems[0]) ? randomItems : [randomItems])
        : []
    const rolledBonuses = pools.map((pool) => pool[Math.floor(Math.random() * pool.length)])

    // Build the enriched item reward list for the rewards modal. Gold is
    // omitted here because it is rolled randomly per open — callers that know
    // the exact amount (the open flow) append their own currency entry.
    const buildEnrichedItemRewards = async (bonuses = []) => {
      const rewards = [{ type: 'xp', amount: xpAmount }]
      const entries = bonuses.length
        ? [...itemRewards, ...bonuses.map((b) => ({ ...b, highlighted: true }))]
        : itemRewards
      for (const reward of entries) {
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

    // The persistent per-player "chest opened" flag. It is the source of truth
    // for re-opens and is reserved for gating future events.
    const flagRow = await prisma.user.findUnique({
      where: { id: playerId },
      select: { [flagField]: true },
    })

    // Already opened: remind the player what they got, but never re-grant.
    if (flagRow?.[flagField]) {
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
          payload: createActionFeedbackPayload('open gold chest', 'info', lockedMessage, {
            roomId: roomState.roomId,
            showModal: true,
            modalContent: {
              type: 'icon',
              icon: 'chest',
              iconColor: 'amber-500/90',
              title: 'You try to open the gold chest',
              message: lockedMessage,
            },
          }),
        },
      ],
    })

    // The Gold Key is a one-time, max:1 quest reward gating the first
    // open. After this, the persistent flag (set below) gates re-opens.
    const hasKey = await playerHasItem(playerId, 'gold-key')
    if (!hasKey) {
      return lockedFeedback()
    }

    const goldAmount = goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1))

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
        const toGrant = [...itemRewards, ...rolledBonuses]
        for (const reward of toGrant) {
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
            [flagField]: true,
          },
          select: { id: true, currency: true, xp: true, [flagField]: true },
        })
      })
    } catch (err) {
      // Key vanished between the check and the transaction — treat as still locked.
      if (err.message === 'GOLD_KEY_MISSING') {
        return lockedFeedback()
      }
      // A carry cap aborts the whole open, which rolls the transaction back —
      // the key is still in the player's pack and the chest still shut, so the
      // fix is to make room and try again rather than to lose the key.
      if (/Max quantity reached/.test(err.message)) {
        return createErrorResult(
          'open gold chest',
          'Your pack is too full to take everything in the chest. Make some room and try again — your Gold Key is untouched.'
        )
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
    const enrichedRewards = await buildEnrichedItemRewards(rolledBonuses)
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
              header: `${label} Unlocked!`,
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
  }
}

/**
 * Build a re-openable chest: one roll per `cooldownMs`, gold and XP plus one
 * item drawn from each declared pool.
 *
 * The original gated these on a 100-click counter kept in the PHP session, so
 * the timer died with the session and reset on every login. A rolling
 * per-(player, room, action) cooldown is the modern equivalent that actually
 * survives a reconnect — the same ActionCap row the gather nodes use.
 *
 * `pools` is an array of item pools; one entry is rolled from each, so a chest
 * can hand out "a weapon AND a ring" rather than one of everything.
 */
/**
 * Every repeatable chest's loot, in declaration order. Populated by
 * `makeRepeatableChestHandler` below; read by the World Tool's item pages so an
 * item that only drops out of a lair chest still shows where it comes from.
 *
 * @type {Array<{ roomId: string, action: string, label: string, cooldownMs: number,
 *                pools: Array<Array<{ itemSlug: string, quantity?: number,
 *                                     quantityMin?: number, quantityMax?: number }>> }>}
 */
const REPEATABLE_CHEST_LOOT = []

function makeRepeatableChestHandler({
  roomId,
  action,
  label,
  cooldownMs,
  goldMin = 0,
  goldMax = 0,
  xp = 0,
  pools = [],
  icon = 'chest2',
  iconColor = 'gray-400',
  openMessage,
}) {
  // Register the chest's contents alongside the handler. The handler itself is a
  // closure, so without this the only record of what these chests hold would be
  // inside it — and the World Tool's item-source index would quietly miss every
  // repeatable chest in the game.
  REPEATABLE_CHEST_LOOT.push({ roomId, action, label, cooldownMs, pools })

  return async (playerId, roomState) => {
    const { prisma } = require('../db-client')
    const { grantItemOnce, getPlayerInventory, getItemBySlug } = require('./services/inventory-service')
    const { checkAndApplyLevelUp } = require('./services/leveling-service')

    roomState.touchActivity()

    const cooldown = await checkAndConsumeCooldown(playerId, roomId, action, cooldownMs)
    if (!cooldown.allowed) {
      const wait = formatTimeRemaining(cooldown.secondsRemaining)
      const message = `The ${label.toLowerCase()} will not budge. Someone has picked it clean for now — try again in ${wait}.`
      return {
        success: true,
        action,
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload(action, 'info', message, {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: { type: 'icon', icon, iconColor, title: label, message },
            }),
          },
        ],
      }
    }

    // Roll everything before writing, so the granted haul and the rewards modal
    // are built from one set of results.
    const rolled = pools
      .map((pool) => (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null))
      .filter(Boolean)
      // A pool entry may declare a range instead of a fixed count (the lairs'
      // "2-4 potions"). Roll it once here so the grant and the rewards modal
      // report the same number.
      .map((reward) =>
        typeof reward.quantityMin === 'number' && typeof reward.quantityMax === 'number'
          ? {
              ...reward,
              quantity:
                reward.quantityMin +
                Math.floor(Math.random() * (reward.quantityMax - reward.quantityMin + 1)),
            }
          : reward
      )
    const goldAmount =
      goldMax > 0 ? goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1)) : 0

    let updatedUser
    const capped = []
    try {
      updatedUser = await prisma.$transaction(async (tx) => {
        for (const reward of rolled) {
          const granted = await grantItemOnce(playerId, reward.itemSlug, reward.quantity ?? 1, tx)
          // Being at an item's carry cap must not fail the open. The cooldown has
          // already been consumed by this point, so throwing here would burn the
          // timer and hand back nothing; instead the item is noted as left behind
          // and the rest of the haul goes through.
          if (!granted.granted) capped.push(reward.itemSlug)
        }
        if (goldAmount === 0 && xp === 0) {
          return tx.user.findUnique({ where: { id: playerId }, select: { id: true, currency: true, xp: true } })
        }
        return tx.user.update({
          where: { id: playerId },
          data: {
            ...(goldAmount > 0 ? { currency: { increment: goldAmount } } : {}),
            ...(xp > 0 ? { xp: { increment: xp } } : {}),
          },
          select: { id: true, currency: true, xp: true },
        })
      })
    } catch (err) {
      console.error(`[${label}] Failed to grant chest contents:`, err)
      return createErrorResult(action, 'Something went wrong opening the chest. Please try again.')
    }

    const [levelUp, inventory] = await Promise.all([
      checkAndApplyLevelUp(playerId),
      getPlayerInventory(playerId),
    ])

    const rewards = []
    if (xp > 0) rewards.push({ type: 'xp', amount: xp })
    if (goldAmount > 0) rewards.push({ type: 'currency', amount: goldAmount })
    const cappedNames = []
    for (const reward of rolled) {
      const template = await getItemBySlug(reward.itemSlug)
      const name = template?.name || reward.itemSlug
      if (capped.includes(reward.itemSlug)) {
        cappedNames.push(name)
        continue
      }
      rewards.push({
        type: 'item',
        itemSlug: reward.itemSlug,
        name,
        quantity: reward.quantity ?? 1,
        highlighted: !!reward.highlighted,
      })
    }

    const baseMessage = openMessage || `You open the ${label.toLowerCase()}.`
    const message = cappedNames.length
      ? `${baseMessage} You are carrying as ${cappedNames.join(' and ')} as you can hold, and leave ${cappedNames.length > 1 ? 'those' : 'that'} behind.`
      : baseMessage

    const playerEvents = [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(action, 'success', message, {
          roomId: roomState.roomId,
          inventory,
          player: updatedUser,
          showModal: true,
          modalContent: {
            type: 'icon',
            icon,
            iconColor,
            title: label,
            header: `${label} Opened`,
            message,
          },
          questComplete: {
            questTitle: '',
            rewards,
            levelUp: levelUp?.leveled ? levelUp : null,
            newQuestTitles: [],
          },
        }),
      },
    ]
    if (levelUp?.leveled) playerEvents.push({ event: 'player:level-up', payload: levelUp })

    return { success: true, action, playerEvents }
  }
}

/**
 * A guild supply pack: the guild tops your consumables back up to a floor rather
 * than handing out a fixed batch. Legacy behaviour exactly — it sets each of the
 * four supplies to its minimum if you are below it, and tells you it did nothing
 * if you are already stocked. That makes it a safety net rather than a farm.
 *
 * Both guilds run the same pack with their own colour of supplies: the warriors
 * stock red (HP), the wizards blue (MP).
 */
function makeGuildPackHandler({ questId, label, icon, iconColor, joinMessage, pack }) {
  return async (playerId, roomState) => {
    const { getHeldQuantity, grantItemOnce, getPlayerInventory } = require('./services/inventory-service')

    roomState.touchActivity()

    const isMember = await makeGuildMemberCheck(questId)(playerId)
    if (!isMember) {
      return {
        success: true,
        action: 'grab pack',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload('grab pack', 'info', joinMessage, {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: { type: 'icon', icon, iconColor, title: label, message: joinMessage },
            }),
          },
        ],
      }
    }

    const lines = []
    const granted = []
    for (const entry of pack) {
      const held = await getHeldQuantity(playerId, entry.slug)
      const shortfall = entry.floor - held
      if (shortfall <= 0) {
        lines.push(`You already have ${held} ${entry.label}.`)
        continue
      }
      const result = await grantItemOnce(playerId, entry.slug, shortfall)
      if (result.granted) {
        lines.push(`You top up to ${entry.floor} ${entry.label}.`)
        granted.push({ itemSlug: entry.slug, quantity: shortfall })
      } else {
        lines.push(`You could not carry any more ${entry.label}.`)
      }
    }

    const inventory = await getPlayerInventory(playerId)
    const message = granted.length
      ? `You replenish your ${label}.`
      : `Your ${label} is already full.`

    return {
      success: true,
      action: 'grab pack',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: createActionFeedbackPayload('grab pack', 'success', message, {
            roomId: roomState.roomId,
            inventory,
            showModal: true,
            modalContent: {
              type: 'icon',
              icon,
              iconColor,
              title: label,
              message: lines.join('\n'),
            },
          }),
        },
      ],
    }
  }
}

/** The Warrior's Guild pack: reds, meatballs, red potions, red balm. */
const makeWarriorPackHandler = () =>
  makeGuildPackHandler({
    questId: 'quest_warriorsguild_000',
    label: "Warrior's Pack",
    icon: 'npc-warrior',
    iconColor: 'blue-400',
    joinMessage: 'Join the Warrior’s Guild to claim a Warrior’s Pack. Speak to the recruiter.',
    pack: [
      { slug: 'reds', floor: 3, label: 'reds' },
      { slug: 'meatball', floor: 5, label: 'meatballs' },
      { slug: 'red-potion', floor: 5, label: 'red potions' },
      { slug: 'red-balm', floor: 1, label: 'red balm' },
    ],
  })

/** The Wizard's Guild pack: the same four slots in blue. */
const makeWizardPackHandler = () =>
  makeGuildPackHandler({
    questId: 'quest_wizardsguild_000',
    label: "Wizard's Pack",
    icon: 'npc-wizard',
    iconColor: 'purple-400',
    joinMessage: 'Join the Wizard’s Guild to claim a Wizard’s Pack. Speak to the recruiter.',
    pack: [
      { slug: 'blues', floor: 3, label: 'blues' },
      { slug: 'bluefish', floor: 5, label: 'bluefish' },
      { slug: 'blue-potion', floor: 5, label: 'blue potions' },
      { slug: 'blue-balm', floor: 1, label: 'blue balm' },
    ],
  })

/**
 * A guild's lair teleport: the standing perk of membership, and the reason the
 * hall is worth walking back to. Members only, refused in battle, and — like the
 * flee and respawn paths — the move itself runs through the client's normal
 * teleport dispatch so party pulls, room events and persistence all behave. The
 * server decides *whether*; `teleportRoomId` only says *where*.
 */
/** The Mining Guild's pack: potions, food, and a pickaxe to break. */
const makeMiningPackHandler = () =>
  makeGuildPackHandler({
    questId: 'quest_miningguild_000',
    label: 'Mining Pack',
    icon: 'npc-miner2',
    iconColor: 'yellow-600',
    joinMessage: 'Join the Mining Guild to claim a Mining Pack. Speak to the recruiter.',
    pack: [
      { slug: 'red-potion', floor: 5, label: 'red potions' },
      { slug: 'blue-potion', floor: 5, label: 'blue potions' },
      { slug: 'bluefish', floor: 5, label: 'bluefish' },
      { slug: 'meatball', floor: 5, label: 'meatballs' },
      { slug: 'pickaxe', floor: 1, label: 'pickaxe' },
    ],
  })

function makeGuildTeleportHandler({ action, questId, toRoomId, label, icon, iconColor, joinMessage, message }) {
  return async (playerId, roomState) => {
    roomState.touchActivity()

    const respond = (outcome, text, extra = {}) => ({
      success: outcome === 'success',
      action,
      playerEvents: [
        {
          event: 'action:feedback',
          payload: createActionFeedbackPayload(action, outcome, text, {
            roomId: roomState.roomId,
            ...extra,
          }),
        },
      ],
    })

    if (!(await makeGuildMemberCheck(questId)(playerId))) {
      return respond('info', joinMessage, {
        showModal: true,
        modalContent: { type: 'icon', icon, iconColor, title: label, message: joinMessage },
      })
    }

    if (roomState.activeBattles.get(playerId)?.isActive) {
      return respond('failure', 'You cannot leave the room in the middle of battle!')
    }

    // Membership is confirmed, so authorize this one teleport. The client still
    // performs the move, but the teleport handler now accepts a non-network
    // destination only when a grant like this one names it — otherwise echoing
    // `teleportRoomId` back would be indistinguishable from asking for any room.
    grantTeleport(playerId, toRoomId)
    return respond('success', message, { teleportRoomId: toRoomId })
  }
}

/**
 * Babylon Gardens' single flower.
 *
 * A deliberately strange rule kept from the original: you may only pick here if
 * you are already carrying a flower, and never past two. It is the "Twice as
 * Nice" quest's whole joke — the Plaza gardener wants a *matched pair*, so you
 * have to bring the first one in from the Grassy Field yourself.
 */
async function pickGardenFlower(playerId, roomState) {
  const { getHeldQuantity, grantItemOnce, getPlayerInventory } = require('./services/inventory-service')

  roomState.touchActivity()

  const held = await getHeldQuantity(playerId, 'flower')
  const respond = (outcome, message, extra = {}) => ({
    success: outcome === 'success',
    action: 'pick flower',
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload('pick flower', outcome, message, {
          roomId: roomState.roomId,
          showModal: true,
          modalContent: { type: 'icon', icon: 'flower', iconColor: 'yellow-400', title: 'Babylon Gardens', message },
          ...extra,
        }),
      },
    ],
  })

  if (held <= 0) {
    return respond(
      'info',
      "For some strange reason you cannot pick a flower here unless you already have one. Go and pick the first one out in the Grassy Field."
    )
  }
  if (held >= 2) {
    return respond('info', 'You already have two flowers. That is as many as anyone here needs.')
  }

  const granted = await grantItemOnce(playerId, 'flower', 1)
  if (!granted.granted) {
    return createErrorResult('pick flower', 'You could not pick the flower.')
  }

  const inventory = await getPlayerInventory(playerId)
  return respond('success', 'You pick a second flower from the trellis. [ 2 total ]', { inventory })
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
    'open gold chest': makeGoldChestHandler({
      roomId: '001',
      flagField: 'chest1',
      goldMin: 100,
      goldMax: 200,
      lockedMessage:
        'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
    }),
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
    'view shop': makeShopHandler('006'),
  },
  '024': {
    'talk to jack lumber': createNpcTalkHandler({
      npcId: 'jack_lumber',
      action: 'talk to jack lumber',
      icon: 'npc-jacklumber',
      iconColor: 'green-400',
      title: 'Jack Lumber',
      preCheck: async (playerId) => {
        const { prisma } = require('../db-client')
        const user = await prisma.user.findUnique({ where: { id: playerId }, select: { chest1: true } })
        return !!user?.chest1
      },
      preCheckMessage: "\"How'd you get here? Go back and open that gold chest at the Crossroads first. Then we'll talk.\"",
      idleDialogs: [
        {
          ifCompleted: 'quest_jacklumber_000',
          message: '"The Forest Path is open! Get out there and see what\'s beyond the Grassy Field. And remember — keep that hatchet sharp and your bow ready!"',
        },
        {
          ifCompleted: 'quest_jacklumber_intro',
          message: '"You\'ve got work to do, Wanderer! Check your quests and get to it."',
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
    // Jack's tree farm is the starter tree and deliberately unlike every other
    // one: no timer at all — click away for 1 wood a chop — but it refuses once
    // you're holding 5. The cap, not a cooldown, is what limits it, so it can't
    // be farmed. That's enough to learn crafting (a Wooden Bow costs 3) without
    // the Forest's per-room walk, and it tops back up whenever you spend down.
    'chop wood': makeGatherAction({
      itemSlug: 'wood',
      itemNamePlural: 'wood',
      quantity: 1,
      emptyVerb: 'grow',
      toolTiers: [
        { slug: 'iron-hatchet', quantity: 1, label: 'iron hatchet' },
        { slug: 'hatchet', quantity: 1, label: 'hatchet' },
      ],
      missingToolMessage: 'You need a hatchet to chop wood here. There should be one at Jack\'s cabin to the south.',
      maxHeld: 5,
      maxHeldMessage: 'You already have 5 wood — enough for anything Jack will teach you. Come back if you run low.',
    }),
  },
  '020': {
    'rest at waterfall': async (playerId, roomState) => roomState.executeWaterfallRest(playerId),
    'pick wheat': makeWheatAction(),
  },
  '021': {
    'craft': executeCraft,
  },

  // ==================== FOREST ====================
  // Berry bushes, at the exact rooms the original game placed them. Each bush's
  // batch size is the legacy per-room amount; the rolling cooldown replaces the
  // legacy "top up to N, re-pick forever" pattern.

  // --- Freddie's Cow Farm (103) ---
  // The farm gate is a toll, not a quest: 50 gold buys one trip north, and the
  // gate spends the pass on the way through (see ROOM_GATES['103']).
  '103': {
    'talk to freddie': createNpcTalkHandler({
      npcId: 'freddie',
      action: 'talk to freddie',
      icon: 'npc-freddie',
      iconColor: 'amber-400',
      title: 'Freddie',
      idleDialogs: [
        {
          ifCompleted: 'quest_freddie_001',
          message: '"Look at that — proper leatherwork." Freddie slaps the workbench. "Hides are still fifty gold a trip, mind. Hammer\'s free, though. Always is."',
        },
        {
          ifCompleted: 'quest_freddie_intro',
          message: '"Grab a hammer, pay the toll, take your five hides. Then find a crafting table and make something out of them."',
        },
        {
          ifCompleted: null,
          message: 'A wiry man in a leather apron looks up from a half-tanned hide. "Afternoon. Cows are through the gate. Gate\'s fifty gold."',
        },
      ],
    }),
    'pay toll': async (playerId, roomState) => {
      const { prisma } = require('../db-client')
      const { isLeverPulled, pullLever, COW_TOLL } = require('./lever-state')
      const TOLL = 50
      const action = 'pay toll'

      roomState.touchActivity()

      const say = (outcome, message) => ({
        success: outcome === 'success',
        action,
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload(action, outcome, message, {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: { type: 'icon', icon: 'npc-freddie', iconColor: 'amber-400', title: 'Freddie', message },
            }),
          },
        ],
      })

      if (isLeverPulled(playerId, COW_TOLL)) {
        return say('info', 'You already paid the toll. Go north and get yourself some leather.')
      }

      // Charge and open in one conditional write, so two clicks in flight cannot
      // both pass the balance check and take 100 gold for one trip.
      let updated
      try {
        updated = await prisma.user.update({
          where: { id: playerId, currency: { gte: TOLL } },
          data: { currency: { decrement: TOLL } },
          select: { id: true, currency: true },
        })
      } catch (error) {
        // P2025 = the conditional update matched nothing, i.e. the balance check
        // failed. Anything else is a real fault and should not read as "broke".
        if (error?.code === 'P2025') {
          return say('info', "You don't have 50 gold to pay the toll.")
        }
        console.error('[Cow Farm toll] Failed to charge toll:', error)
        return createErrorResult(action, 'Something went wrong paying the toll. Please try again.')
      }

      pullLever(playerId, COW_TOLL)
      const message = 'You hand Freddie 50 gold. The gate to the cow farm swings open.'
      return {
        success: true,
        action,
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload(action, 'success', message, {
              roomId: roomState.roomId,
              player: updated,
              showModal: true,
              modalContent: { type: 'icon', icon: 'npc-freddie', iconColor: 'amber-400', title: 'Freddie', message },
            }),
          },
        ],
      }
    },
    'get hammer': makeFreeItemAction({
      itemSlug: 'hammer',
      itemName: 'a hammer',
      capLabel: 'hammer',
      icon: 'craft',
      iconColor: 'amber-500',
      grantMessage: 'You take a hammer from the crate by the workshop door. You will need it to work leather.',
      alreadyHaveMessage: 'You already have a hammer. If you lose it, come back here for another free one.',
    }),
  },

  // --- More Cows (103c): the woodpile behind the farm ---
  '103c': {
    'get wood': makeGatherAction({
      itemSlug: 'wood',
      itemNamePlural: 'wood',
      topUpTo: 5,
      maxHeldMessage: "You can't pick up more than 5 pieces of wood here. Come back if you run low.",
      topUpMessage: (collected) => `You grab a stack of ${collected} wood from behind the fence.`,
    }),
  },

  // --- Forest Gate directory (104) ---
  '104': {
    'read sign': {
      showModal: true,
      message: 'You read the Forest Path Directory.',
      modalContent: {
        title: 'You read the Forest Path Directory',
        heading: {
          text: 'Forest Path Directory',
          parts: ['Forest Path', 'Directory'],
          description: 'The crossroads of the whole Forest — every road out of it, and what waits down each one.',
        },
        locations: [
          { name: 'Traveling Wizard', direction: 'north', description: 'Spell training, then on to the Kobold Lair, the Dark Forest and the Mountains.' },
          { name: 'The Forest', direction: 'northeast', description: "Hunter Bill, the Forest Gnome, and more trees than you can chop." },
          { name: "Freddie's Cow Farm", direction: 'west', description: 'Leather, a free hammer, and the road back to the Grassy Field.' },
          { name: 'Traveling Warrior', direction: 'south', description: 'Skill training, then the Ogre Lair and the road to Red Town.' },
        ],
        questMessage: 'The Ogre Lair lies southwest and the Kobold Lair northwest. Both run deep, and both end in a boss worth a guild membership.',
        questMessageDescription: 'Ogres drop strength and defense gear; kobolds drop magic gear. Pick your fight.',
      },
    },
  },

  // --- Forest Clearing directory (121) ---
  '121': {
    'read sign': {
      showModal: true,
      message: 'You read the Forest Directory.',
      modalContent: {
        title: 'You read the Forest Directory',
        heading: {
          text: 'Forest Directory',
          parts: ['Forest', 'Directory'],
          description: 'Seven roads out of the clearing, and what is at the end of each.',
        },
        locations: [
          { name: 'Gold Chest', direction: 'north', description: 'Past the river. Hunter Bill holds the key.' },
          { name: 'Large Clearing', direction: 'west', description: 'A massive tree, and a stack of free leather under it.' },
          { name: 'Abandoned Campsite', direction: 'east', description: 'Somebody left in a hurry. Worth searching.' },
          { name: 'Forest Gnome', direction: 'south', description: 'A tree hut, three quests, and a spare hatchet.' },
          { name: 'Hunter Bill', direction: 'northwest', description: 'Hunting quests, skills, and a fire that supercharges you.' },
          { name: 'Forest Entrance', direction: 'southwest', description: 'Back to the stone path and the Forest Gate.' },
          { name: 'Forest Lake', direction: 'southeast', description: 'Bluefish, and the path on toward the Dark Forest Gate.' },
        ],
        questMessage: 'Not every path out of this forest is on a map. Some of them you have to search for.',
        questMessageDescription: 'The trees north of the deep forest look solid. They are not.',
      },
    },
  },

  // --- Under the Massive Tree (117): the leather stack ---
  '117': {
    'get leather': makeGatherAction({
      itemSlug: 'leather',
      itemNamePlural: 'leather',
      topUpTo: 5,
      maxHeldMessage: 'You already have 5 leather. Come back if you run low — for more than 5 you will have to hunt for it.',
      topUpMessage: (collected) => `You pick up ${collected} pieces of leather from the stack under the tree.`,
    }),
  },

  // --- Red Guard Tower (124): the arrow bundles at its base ---
  '124': {
    'grab arrows': makeGatherAction({
      itemSlug: 'arrow',
      itemNamePlural: 'arrows',
      topUpTo: 50,
      maxHeldMessage: 'You already have more than 50 arrows. Come back if you run low.',
      topUpMessage: (collected) => `You grab a bundle of arrows from the guard stores. [ +${collected} arrows ]`,
    }),
  },

  // --- Forest Lake (131): the bluefish shallows ---
  '131': {
    'fish': makeGatherAction({
      itemSlug: 'bluefish',
      itemNamePlural: 'bluefish',
      topUpTo: 10,
      maxHeldMessage: 'There are no more fish left in the lake. Come back later.',
      topUpMessage: (collected) => `You fish in the lake and catch ${collected} bluefish.`,
    }),
  },

  // ==================== FOREST UNDERGROUND ====================
  // The two lair entrances warn you what is below and what it drops. Both signs
  // are the original's word for word, in the modal the other directories use.
  '111': {
    'read sign': {
      showModal: true,
      message: 'You read the sign hammered into the rock.',
      modalContent: {
        title: 'You read the sign',
        heading: {
          text: "Ogres Below!",
          parts: ['Ogres', 'Below!'],
          description: 'A crude board nailed over the mouth of the cave.',
        },
        locations: [
          { name: 'Ogre Lair', direction: 'down', description: 'Goblins and rats near the entrance. Ogres, orcs and worse the deeper you go.' },
        ],
        questMessage: 'The enemies below generally drop STRENGTH and DEFENSE increasing equipment.',
        questMessageDescription: "Defeat the Ogre Lieutenant to join the Warrior's Guild.",
      },
    },
  },
  '115': {
    'read sign': {
      showModal: true,
      message: 'You read the weathered sign.',
      modalContent: {
        title: 'You read the sign',
        heading: {
          text: 'Magical Kobolds Below!',
          parts: ['Magical Kobolds', 'Below!'],
          description: 'A weathered board propped against the rim of the hole.',
        },
        locations: [
          { name: 'Kobold Lair', direction: 'down', description: 'Kobolds, shamans, ninjas and warlocks, and a temple full of them.' },
        ],
        questMessage: 'The enemies below generally drop MAGIC increasing equipment.',
        questMessageDescription: "Defeat the Kobold Master to join the Wizard's Guild.",
      },
    },
  },

  // --- Ogre Treasure Room (111h) ---
  // Behind the searched passage off the Ogre Yard. The original rolled a weapon
  // or helmet AND a Tier III ring on every open, plus potions and coin, on a
  // 100-click lock. Two pools reproduce that; the lock becomes an hour, the same
  // window the Thieve's Den chest uses.
  '111h': {
    'open chest': makeRepeatableChestHandler({
      roomId: '111h',
      action: 'open chest',
      label: 'Ogre Treasure Chest',
      cooldownMs: 60 * 60 * 1000,
      goldMin: 500,
      goldMax: 1500,
      xp: 200,
      icon: 'chest',
      iconColor: 'amber-500',
      openMessage: 'You heave the lid off the ogres\' chest. Everything they have ever taken off anyone is in here.',
      pools: [
        [
          { itemSlug: 'giant-club', quantity: 1, highlighted: true },
          { itemSlug: 'warhammer', quantity: 1, highlighted: true },
          { itemSlug: 'off-hand-dagger', quantity: 1, highlighted: true },
          { itemSlug: 'iron-hood', quantity: 1, highlighted: true },
        ],
        [
          { itemSlug: 'ring-of-strength-iii', quantity: 1 },
          { itemSlug: 'ring-of-dexterity-iii', quantity: 1 },
          { itemSlug: 'ring-of-magic-iii', quantity: 1 },
          { itemSlug: 'ring-of-defense-iii', quantity: 1 },
        ],
        [{ itemSlug: 'red-potion', quantityMin: 2, quantityMax: 4 }],
      ],
    }),
  },

  // --- Kobold Hidden Chamber (115f) ---
  // Behind the Control Room lever. Same shape as the ogres' chest, stocked with
  // the magic-side gear the kobolds drop.
  '115f': {
    'open chest': makeRepeatableChestHandler({
      roomId: '115f',
      action: 'open chest',
      label: 'Kobold Treasure Chest',
      cooldownMs: 60 * 60 * 1000,
      goldMin: 500,
      goldMax: 1500,
      xp: 200,
      icon: 'chest',
      iconColor: 'blue-300',
      openMessage: 'The kobolds\' chest opens on a hoard nobody was ever meant to find.',
      pools: [
        [
          { itemSlug: 'iron-staff', quantity: 1, highlighted: true },
          { itemSlug: 'iron-battle-staff', quantity: 1, highlighted: true },
          { itemSlug: 'tower-shield', quantity: 1, highlighted: true },
          { itemSlug: 'gray-hood', quantity: 1, highlighted: true },
        ],
        [
          { itemSlug: 'ring-of-strength-iii', quantity: 1 },
          { itemSlug: 'ring-of-dexterity-iii', quantity: 1 },
          { itemSlug: 'ring-of-magic-iii', quantity: 1 },
          { itemSlug: 'ring-of-defense-iii', quantity: 1 },
        ],
        [{ itemSlug: 'blue-potion', quantityMin: 2, quantityMax: 4 }],
      ],
    }),
  },

  // --- Kobold Control Room (115h) ---
  // One lever, one false wall. Session-scoped like the original's `koboldswitch`:
  // the chamber has to be re-opened every time you come back down.
  '115h': {
    'flip lever': async (playerId, roomState) => {
      const { pullLever, isLeverPulled, getRoomStateNote, getRoomActionOverrides, KOBOLD_SWITCH } = require('./lever-state')
      const action = 'flip lever'

      roomState.touchActivity()

      const already = isLeverPulled(playerId, KOBOLD_SWITCH)
      const message = already
        ? 'You already flipped this switch. You have a feeling a doorway has opened up somewhere in this cave.'
        : 'You flip the lever and hear grinding noises come from inside the west wall.'
      if (!already) pullLever(playerId, KOBOLD_SWITCH)

      return {
        success: true,
        action,
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload(action, already ? 'info' : 'success', message, {
              roomId: roomState.roomId,
              showModal: true,
              modalContent: {
                type: 'icon',
                icon: 'lever-down',
                iconColor: already ? 'gray-500' : 'green-400',
                title: 'Control Room Lever',
                message,
              },
              stateNote: getRoomStateNote(playerId, '115h'),
              actionOverrides: getRoomActionOverrides(playerId, '115h'),
            }),
          },
        ],
      }
    },
  },

  '120': {
    'pick redberry': makeGatherAction({
      itemSlug: 'redberry',
      itemNamePlural: 'redberries',
      cooldownMs: 15 * 60 * 1000,
      quantity: 20,
      emptyVerb: 'grow',
    }),
    'grab ring': makeFreeItemAction({
      itemSlug: 'ring-of-dexterity-iii',
      itemName: 'a Ring of Dexterity III',
      capLabel: 'Ring of Dexterity III',
      icon: 'ring',
      iconColor: 'green-400',
      grantMessage: 'You pick a Ring of Dexterity III out of the silt at the river\'s edge. Somebody lost this a long time ago.',
      alreadyHaveMessage: 'You already have a Ring of Dexterity III. If you lose it, come back here for another free one.',
    }),
  },
  '125': {
    'pick redberry': makeGatherAction({
      itemSlug: 'redberry',
      itemNamePlural: 'redberries',
      cooldownMs: 15 * 60 * 1000,
      quantity: 10,
      emptyVerb: 'grow',
    }),
  },
  '130': {
    'pick redberry': makeGatherAction({
      itemSlug: 'redberry',
      itemNamePlural: 'redberries',
      cooldownMs: 15 * 60 * 1000,
      quantity: 15,
      emptyVerb: 'grow',
    }),
  },
  '129': {
    'pick blueberry': makeGatherAction({
      itemSlug: 'blueberry',
      itemNamePlural: 'blueberries',
      cooldownMs: 30 * 60 * 1000,
      quantity: 10,
      emptyVerb: 'grow',
    }),
  },
  '135': {
    'pick blueberry': makeGatherAction({
      itemSlug: 'blueberry',
      itemNamePlural: 'blueberries',
      cooldownMs: 30 * 60 * 1000,
      quantity: 15,
      emptyVerb: 'grow',
    }),
  },
  '118': {
    // Bill's fire supercharges rather than merely restoring — the original set
    // hp/mp to max + 10 here, which is why hunters stage out of this camp.
    'rest at camp': async (playerId, roomState) =>
      roomState.applyRest(playerId, {
        action: 'rest at camp',
        overchargeBonus: 10,
        overchargeMessage: "You rest at Hunter Bill's camp and supercharge yourself. Your HP and MP are fully restored, plus an extra +10 to each.",
      }),
    'talk to hunter bill': createNpcTalkHandler({
      npcId: 'hunter_bill',
      action: 'talk to hunter bill',
      icon: 'npc-hunterbill',
      iconColor: 'green-400',
      title: 'Hunter Bill',
      idleDialogs: [
        {
          ifCompleted: 'quest_hunterbill_000',
          message: '"Bigfoot and the whole six — nobody\'s done that in a while." Bill leans back against a tree. "Go crack that gold chest northeast of here. You earned what\'s in it."',
        },
        {
          ifCompleted: 'quest_hunterbill_intro',
          message: '"Still hunting? Good. The forest gives up what it owes eventually — just keep walking it."',
        },
        {
          ifCompleted: null,
          message: 'The hunter glances up from his bow and goes back to stringing it. "Come find me once the forest lets you in properly."',
        },
      ],
    }),
  },
  '119': {
    'open gold chest': makeGoldChestHandler({
      roomId: '119',
      flagField: 'chest2',
      goldMin: 500,
      goldMax: 1000,
      lockedMessage:
        'The gold chest is locked. You need a Gold Key to open it. Hunter Bill hands one over to whoever finishes his hunt — his camp is southwest of here.',
    }),
  },
  '128': {
    'talk to forest gnome': createNpcTalkHandler({
      npcId: 'forest_gnome',
      action: 'talk to forest gnome',
      icon: 'npc-forestgnome',
      iconColor: 'green-400',
      title: 'Forest Gnome',
      idleDialogs: [
        {
          ifCompleted: 'quest_forestgnome_000',
          message: '"Trolls handled, door hung, potions brewed. You\'re alright, Wanderer." The gnome stretches out in his hut. "Spare hatchet\'s always here if you lose yours."',
        },
        {
          ifCompleted: 'quest_forestgnome_intro',
          message: '"Berries, wood, trolls — take them in whatever order suits you. Grab the spare hatchet on your way out."',
        },
        {
          ifCompleted: null,
          message: 'The gnome watches you from the branches without climbing down. "Nice hut, isn\'t it? Come find me once you\'ve earned your way into this forest properly."',
        },
      ],
    }),
  },
  // ==================== RED TOWN ====================
  // Seven quest givers across five rooms, six shops, four chests, two rest
  // points and the town's two directory signs. Guild interiors (225a-h / 226a-f)
  // are still skipped — the original moved every guild action down to the guild
  // entrance, which is what these rooms do.

  // --- Red Guard Captain, Forest Lookout (215) ---
  '215': {
    'talk to red guard captain': createNpcTalkHandler({
      npcId: 'red_guard_captain',
      action: 'talk to red guard captain',
      icon: 'npc-redguardcaptain',
      iconColor: 'red-500',
      title: 'Red Guard Captain',
      idleDialogs: [
        {
          ifCompleted: 'quest_redguardcaptain_003',
          message: '"Thieves down, swords delivered, sewers thinned. The tower ladder is yours whenever you want the forest." The Captain goes back to watching the treeline.',
        },
        {
          ifCompleted: 'quest_redguardcaptain_intro',
          message: '"Still work on the board. Take them in whatever order suits you — the ladder opens the moment any one of them is done."',
        },
        {
          ifCompleted: null,
          message: 'The Captain keeps his eyes on the trees. "Unless you have business up here, mind the ladder on your way down."',
        },
      ],
    }),
  },

  // --- Town Hall Plaza (221) ---
  '221': {
    'talk to the people': createNpcTalkHandler({
      npcId: 'town_hall_plaza',
      action: 'talk to the people',
      icon: 'npc-townhallplaza',
      iconColor: 'red-500',
      title: 'Town Hall Plaza',
      idleDialogs: [
        {
          ifCompleted: 'quest_townhallplaza_003',
          message: 'The gardener waves, the chef shouts something about the meatballs, and Suzie holds her bear up for you to see. Nobody here needs anything else from you today.',
        },
        {
          ifCompleted: 'quest_townhallplaza_intro',
          message: 'The Plaza is as busy as ever. Flowers, meat, and one very upset little girl — take them in any order.',
        },
        {
          ifCompleted: null,
          message: 'People mill about the benches and tables, trading and passing through. Nobody has asked you for anything yet.',
        },
      ],
    }),
  },

  // --- Mayor Rudolf, Town Hall Office (222) ---
  '222': {
    'talk to mayor': createNpcTalkHandler({
      npcId: 'mayor_rudolf',
      action: 'talk to mayor',
      icon: 'npc-mayor',
      iconColor: 'red-500',
      title: 'Mayor Rudolf',
      idleDialogs: [
        {
          ifCompleted: 'quest_mayorrudolf_000',
          message: '"Red Town owes you a debt it cannot properly pay." The Mayor nods at the door west. "The Gardens chest is yours. And the dining room north is open to you now."',
        },
        {
          ifCompleted: 'quest_mayorrudolf_intro',
          message: '"The Scorpion King, when you are ready. Below the Spider Cave, out in the Grassy Field. The bounty stands."',
        },
        {
          ifCompleted: null,
          message: 'The Mayor works through a stack of paperwork without looking up. "Whatever it is, put it on the pile."',
        },
      ],
    }),
  },

  // --- Wizard's Guild (225): two quest givers, a stall, a fire and the lair teleport ---
  '225': {
    'talk to wizard recruiter': createNpcTalkHandler({
      npcId: 'wizards_guild_recruiter',
      action: 'talk to wizard recruiter',
      icon: 'npc-wizard',
      iconColor: 'purple-400',
      title: "Wizard's Guild Recruiter",
      idleDialogs: [
        {
          ifCompleted: 'quest_wizardsguild_000',
          message: '"Welcome, member. The stall is open to you, the fire is yours to rest at, and Morty has been asking after you."',
        },
        {
          ifCompleted: 'quest_wizardsguild_intro',
          message: '"The Kobold Master, northwest in the Forest. Come back when it is done and the guild is yours."',
        },
        {
          ifCompleted: null,
          message: 'The robed crowd talks over you about potions and reagents. Nobody has offered you anything yet.',
        },
      ],
    }),
    'talk to wizard morty': createNpcTalkHandler({
      npcId: 'wizard_morty',
      action: 'talk to wizard morty',
      icon: 'npc-wizard2',
      iconColor: 'purple-400',
      title: 'Wizard Morty',
      preCheck: makeGuildMemberCheck('quest_wizardsguild_000'),
      preCheckMessage: '"Members only." Morty does not look up. "Speak to the recruiter, put down the Kobold Master, then come back."',
      idleDialogs: [
        {
          ifCompleted: 'quest_wizardmorty_003',
          message: '"Gray matter, the dead of the Catacombs, and the Troll Queen herself." Morty finally looks impressed. "Alright. You are a powerful wizard."',
        },
        {
          ifCompleted: 'quest_wizardmorty_intro',
          message: '"Three things, remember. Take them in whatever order you like — they are all equally unpleasant."',
        },
        {
          ifCompleted: null,
          message: 'Morty stirs something and ignores you entirely.',
        },
      ],
    }),
    'view shop': makeShopHandler('225', {
      lockedMessage: 'The stall keeper shakes her head. "Guild members only. Speak to the recruiter."',
      icon: 'npc-wizard',
      iconColor: 'purple-400',
    }),
    'read sign': {
      showModal: true,
      message: "You read the Wizard's Guild sign.",
      modalContent: {
        title: "Wizard's Guild",
        type: 'icon',
        icon: 'npc-wizard',
        iconColor: 'purple-400',
        message:
          'Do you want to bend fire and lightning to your will? To heal what should not heal, and unmake what should not be unmade? Then the Wizard’s Guild wants you.\n\nProve yourself by defeating the Kobold Master. Earn your place and you unlock stronger spells, elite gear and exclusive Wizard Quests.\n\nInitiation bonus: a Wizard Staff and a Wizard Hat. You will look the part immediately.',
      },
    },
    'rest at wizard fire': async (playerId, roomState) => {
      const isMember = await makeGuildMemberCheck('quest_wizardsguild_000')(playerId)
      if (!isMember) {
        return {
          success: true,
          action: 'rest at wizard fire',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload('rest at wizard fire', 'info', 'Join the Wizard’s Guild to rest at its fire.', {
                roomId: roomState.roomId,
                showModal: true,
                modalContent: {
                  type: 'icon',
                  icon: 'npc-wizard',
                  iconColor: 'purple-400',
                  title: "Wizard's Guild",
                  message: 'Join the Wizard’s Guild to rest at its fire. Speak to the recruiter.',
                },
              }),
            },
          ],
        }
      }
      return roomState.applyRest(playerId, {
        action: 'rest at wizard fire',
        overchargeBonus: 100,
        overchargeMessage: 'You rest at the Wizard’s Fire. Your HP and MP are fully restored, plus an extra +100 to each.',
      })
    },
    'grab pack': makeWizardPackHandler(),
    'teleport to kobold lair': makeGuildTeleportHandler({
      action: 'teleport to kobold lair',
      questId: 'quest_wizardsguild_000',
      toRoomId: '115',
      label: "Wizard's Guild",
      icon: 'npc-wizard',
      iconColor: 'purple-400',
      joinMessage: 'Join the Wizard’s Guild to use its lair teleport. Speak to the recruiter.',
      message: 'You teleport to the entrance of the Kobold Lair!',
    }),
  },

  // --- Warrior's Guild (226): two quest givers, a stall, a fire and the Warrior's Pack ---
  '226': {
    'talk to warrior recruiter': createNpcTalkHandler({
      npcId: 'warriors_guild_recruiter',
      action: 'talk to warrior recruiter',
      icon: 'npc-warrior',
      iconColor: 'blue-400',
      title: "Warrior's Guild Recruiter",
      idleDialogs: [
        {
          ifCompleted: 'quest_warriorsguild_000',
          message: '"Welcome, member. The rack is open to you, the fire is yours, and grab a pack on your way out. Pete has work if you want it."',
        },
        {
          ifCompleted: 'quest_warriorsguild_intro',
          message: '"The Ogre Lieutenant, southwest in the Forest. Come back when it is done and the guild is yours."',
        },
        {
          ifCompleted: null,
          message: 'The warriors outside the hall size you up and go back to their conversation.',
        },
      ],
    }),
    'talk to warrior pete': createNpcTalkHandler({
      npcId: 'warrior_pete',
      action: 'talk to warrior pete',
      icon: 'npc-warrior2',
      iconColor: 'blue-400',
      title: 'Warrior Pete',
      preCheck: makeGuildMemberCheck('quest_warriorsguild_000'),
      preCheckMessage: '"Members only, friend." Pete jerks a thumb at the recruiter. "Put down the Ogre Lieutenant first."',
      idleDialogs: [
        {
          ifCompleted: 'quest_warriorpete_003',
          message: '"Knights, sharks and three Champions." Pete grins for the first time. "Fine. You’re a warrior. I’ll say it out loud and everything."',
        },
        {
          ifCompleted: 'quest_warriorpete_intro',
          message: '"Three things, any order. None of them are close by and none of them are easy. That’s rather the point."',
        },
        {
          ifCompleted: null,
          message: 'Pete leans on the weapon rack and says nothing.',
        },
      ],
    }),
    'view shop': makeShopHandler('226', {
      lockedMessage: 'The quartermaster folds his arms. "Guild members only. Talk to the recruiter."',
      icon: 'npc-warrior',
      iconColor: 'blue-400',
    }),
    'read sign': {
      showModal: true,
      message: "You read the Warrior's Guild sign.",
      modalContent: {
        title: "Warrior's Guild",
        type: 'icon',
        icon: 'npc-warrior',
        iconColor: 'blue-400',
        message:
          'Do you love crushing enemies with massive warhammers and razor-sharp swords? Want to block devastating blows with an unbreakable shield? Dream of becoming the strongest warrior the world has ever known? Then the Warrior’s Guild wants you.\n\nProve your strength by defeating the Ogre Lieutenant. Earn your place, and you’ll unlock powerful skills, elite gear, and exclusive Warrior Quests.\n\nInitiation Bonus: TWO FREE SWORDS. Because one just isn’t enough.',
      },
    },
    'rest at warrior fire': async (playerId, roomState) => {
      const isMember = await makeGuildMemberCheck('quest_warriorsguild_000')(playerId)
      if (!isMember) {
        return {
          success: true,
          action: 'rest at warrior fire',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload('rest at warrior fire', 'info', 'Join the Warrior’s Guild to rest at its fire.', {
                roomId: roomState.roomId,
                showModal: true,
                modalContent: {
                  type: 'icon',
                  icon: 'npc-warrior',
                  iconColor: 'blue-400',
                  title: "Warrior's Guild",
                  message: 'Join the Warrior’s Guild to rest at its fire. Speak to the recruiter.',
                },
              }),
            },
          ],
        }
      }
      return roomState.applyRest(playerId, {
        action: 'rest at warrior fire',
        overchargeBonus: 100,
        overchargeMessage: 'You rest at the Warrior’s Fire and supercharge yourself. Your HP and MP are fully restored, plus an extra +100 to each.',
      })
    },
    'grab pack': makeWarriorPackHandler(),
    'teleport to ogre lair': makeGuildTeleportHandler({
      action: 'teleport to ogre lair',
      questId: 'quest_warriorsguild_000',
      toRoomId: '111',
      label: "Warrior's Guild",
      icon: 'npc-warrior',
      iconColor: 'blue-400',
      joinMessage: 'Join the Warrior’s Guild to use its lair teleport. Speak to the recruiter.',
      message: 'You teleport to the entrance of the Ogre Lair!',
    }),
  },

  // --- Shops ---
  '207': { 'view shop': makeShopHandler('207', { icon: 'veggies', iconColor: 'green-500' }) },
  '216': { 'view shop': makeShopHandler('216') },
  '220': { 'view shop': makeShopHandler('220', { icon: 'bar', iconColor: 'red-500' }) },
  '227': { 'view shop': makeShopHandler('227', { icon: 'sword1', iconColor: 'red-500' }) },
  '229': { 'view shop': makeShopHandler('229', { icon: 'steak', iconColor: 'red-500' }) },
  '236': { 'view shop': makeShopHandler('236', { icon: 'shop', iconColor: 'gray-500' }) },
  '237': { 'view shop': makeShopHandler('237', { icon: 'tent', iconColor: 'red-500' }) },

  // --- Grand Square: the fountain, the crafting fire, and the town directory ---
  '210': {
    'rest at fountain': async (playerId, roomState) =>
      roomState.applyRest(playerId, {
        action: 'rest at fountain',
        overchargeBonus: 25,
        overchargeMessage: 'You rest at the fountain and supercharge yourself. Your HP and MP are fully restored, plus an extra +25 to each.',
      }),
    'craft': executeCraft,
    'read sign': {
      showModal: true,
      message: 'You read the Red Town Directory.',
      modalContent: {
        title: 'You read the Red Town Directory',
        heading: {
          text: 'Red Town Directory',
          parts: ['Red Town', 'Directory'],
          description: 'Every road out of the Grand Square, and where it goes.',
        },
        locations: [
          { name: 'Red Guard Barracks', direction: 'north', description: "The Captain's quests. Complete any one of them and the forest lookout opens to you." },
          { name: 'Town Hall', direction: 'east', description: 'The Plaza, the Mayor, the Babylon Gardens and the gold chest.' },
          { name: 'Wizards Way', direction: 'south', description: 'The south gate, Vincenzo’s stand, and the back alley down to the sewers.' },
          { name: 'Town Exit', direction: 'west', description: 'The Grand Gate, the stables, and the road to Rocky Flats.' },
          { name: "Adam's General Store", direction: 'northeast', description: 'The broadest stock in town.' },
          { name: "Michael's Weapon Shop", direction: 'southwest', description: 'Blades from floor to ceiling, if you have the coin.' },
          { name: "Warrior's Guild", direction: 'northwest', description: 'Skills, elite gear and exclusive quests — for members.' },
          { name: "Wizard's Guild", direction: 'southeast', description: 'Spells, staves and exclusive quests — for members.' },
        ],
        questMessage: 'Guilds are scattered throughout the land, and always the best place to learn stronger skills and spells.',
        questMessageDescription: 'Both Red Town guilds take an initiation quest before they take you.',
      },
    },
  },

  // --- The Red Guard Captain's office: the sign over the bowl of spare rings.
  // The ring itself is a room item (see config/room-loot.js), so picking it up
  // uses the shared pickup flow and the autoRespawn refill is what makes "if you
  // lose it, come back for another free one" true.
  '214': {
    'read sign': {
      showModal: true,
      message: 'You read the sign on the Captain’s desk.',
      modalContent: {
        title: 'You read the sign',
        type: 'icon',
        icon: 'sign-metal',
        iconColor: 'red-600',
        message: 'FREE RING\n\nGrab a free Ring of Strength III out of the bowl. One each — and if you lose it, come back for another.',
      },
    },
  },

  // --- Red Town Courtyard directory ---
  '218': {
    'read sign': {
      showModal: true,
      message: 'You read the Red Town Courtyard Directory.',
      modalContent: {
        title: 'You read the Courtyard Directory',
        heading: {
          text: 'Red Courtyard Directory',
          parts: ['Red Courtyard', 'Directory'],
          description: 'The courtyard roads, and the open grate in the middle of it.',
        },
        locations: [
          { name: 'Red Town Church', direction: 'north', description: 'Make peace. Or at least stand somewhere quiet.' },
          { name: "Todd's Pub & Inn", direction: 'east', description: 'Rest, drink, and restock your potions.' },
          { name: 'Back Alley', direction: 'south', description: 'Be wary of thieves.' },
          { name: 'Grand Square', direction: 'west', description: 'The town centre, the crafting fire and both guilds.' },
          { name: 'Town Hall', direction: 'northeast', description: 'Quests, the Mayor, and the gold chest.' },
          { name: 'Red Town Docks', direction: 'southeast', description: 'Currently closed.' },
          { name: 'Red Town Sewers', direction: 'down', description: 'Through the open grate. Bring a weapon.' },
        ],
        questMessage: 'The sewer grate in this courtyard is the northern way in. The back alley holds the other one.',
        questMessageDescription: 'The Red Guard Captain pays for sewer vermin, if you were looking for a reason.',
      },
    },
  },

  // --- Babylon Gardens: the odd second flower, and the town's gold chest ---
  '224': {
    'pick flower': pickGardenFlower,
    'open gold chest': makeGoldChestHandler({
      roomId: '224',
      flagField: 'chest3',
      goldMin: 2000,
      goldMax: 2000,
      lockedMessage:
        'The gold chest is locked. You need a Gold Key to open it — Mayor Rudolf hands one over for the Scorpion King, and his office is east of here and up.',
    }),
  },

  // ==================== RED TOWN SEWERS ====================
  // The one safe room down here, exactly as the original had it: danger level 0,
  // no battle set, and a full restore rather than an overcharge.
  '232x': {
    'rest at oasis': async (playerId, roomState) =>
      roomState.applyRest(playerId, {
        action: 'rest at oasis',
        fullRestore: true,
        fullRestoreMessage: 'You rest at the Sewer Oasis. Clean water, dry stone, and air you can stand — your HP and MP are fully replenished.',
      }),
  },

  // The gray chest across the sewer river, and the potions stacked beside it.
  '232y': {
    'open gray chest': makeRepeatableChestHandler({
      roomId: '232y',
      action: 'open gray chest',
      label: 'Gray Chest',
      cooldownMs: 60 * 60 * 1000,
      goldMin: 100,
      goldMax: 400,
      xp: 75,
      icon: 'chest2',
      iconColor: 'gray-400',
      openMessage: 'You lift the lid of the gray chest. Somebody restocks this thing, and you would rather not know who.',
      pools: [
        [
          { itemSlug: 'red-potion', quantity: 4 },
          { itemSlug: 'arrow', quantity: 25 },
          { itemSlug: 'crossbow-bolt', quantity: 25 },
          { itemSlug: 'ring-of-health-regen', quantity: 1, highlighted: true },
          { itemSlug: 'ring-of-mana-regen', quantity: 1, highlighted: true },
        ],
      ],
    }),
  },

  // ==================== THIEVE'S DEN ====================
  // The treasure room. Legacy rolled a weapon/armour piece AND a Ring of X V on
  // every open, which is why this chest declares two pools.
  '232o': {
    'open treasure chest': makeRepeatableChestHandler({
      roomId: '232o',
      action: 'open treasure chest',
      label: "Thieve's Treasure Chest",
      cooldownMs: 60 * 60 * 1000,
      goldMin: 200,
      goldMax: 600,
      xp: 150,
      icon: 'chest',
      iconColor: 'amber-500',
      openMessage: 'You throw back the lid of the treasure chest. Half of Red Town is in here.',
      pools: [
        [
          { itemSlug: 'iron-boomerang', quantity: 1, highlighted: true },
          { itemSlug: 'iron-bow', quantity: 1, highlighted: true },
          { itemSlug: 'bandit-gloves', quantity: 1, highlighted: true },
          { itemSlug: 'bandit-boots', quantity: 1, highlighted: true },
        ],
        [
          { itemSlug: 'ring-of-strength-v', quantity: 1 },
          { itemSlug: 'ring-of-dexterity-v', quantity: 1 },
          { itemSlug: 'ring-of-magic-v', quantity: 1 },
          { itemSlug: 'ring-of-defense-v', quantity: 1 },
        ],
      ],
    }),
  },

  // ==================== THE CATACOMBS ====================
  // The Silver Vault. The original wired up the click cooldown and the "try again
  // later" message but never filled in the rewards — the chest opened onto
  // nothing. Filled here from the silver set the Babylon Gardens chest rolls, at
  // one piece per open, which is what a room called the Silver Vault ought to do.
  '232z': {
    'open silver chest': makeRepeatableChestHandler({
      roomId: '232z',
      action: 'open silver chest',
      label: 'Silver Chest',
      cooldownMs: 4 * 60 * 60 * 1000,
      goldMin: 500,
      goldMax: 1500,
      xp: 300,
      icon: 'chest2',
      iconColor: 'blue-300',
      openMessage: 'The silver chest opens without a sound, and the whole room brightens.',
      pools: [
        [
          { itemSlug: 'silver-sword', quantity: 1, highlighted: true },
          { itemSlug: 'silver-2h-sword', quantity: 1, highlighted: true },
          { itemSlug: 'silver-boomerang', quantity: 1, highlighted: true },
          { itemSlug: 'silver-bow', quantity: 1, highlighted: true },
          { itemSlug: 'silver-crossbow', quantity: 1, highlighted: true },
          { itemSlug: 'silver-shield', quantity: 1, highlighted: true },
          { itemSlug: 'silver-helmet', quantity: 1, highlighted: true },
          { itemSlug: 'silver-breastplate', quantity: 1, highlighted: true },
          { itemSlug: 'silver-gauntlets', quantity: 1, highlighted: true },
          { itemSlug: 'silver-boots', quantity: 1, highlighted: true },
          { itemSlug: 'silver-ring', quantity: 1, highlighted: true },
          { itemSlug: 'silver-necklace', quantity: 1, highlighted: true },
        ],
      ],
    }),
  },


  // ==================== ROCKY FLATS ====================

  // --- The Crossroads: the Dwarf Captain, and the map directory beside him ---
  '303': {
    'talk to dwarf captain': createNpcTalkHandler({
      npcId: 'dwarf_captain',
      action: 'talk to dwarf captain',
      title: 'Dwarf Captain',
      icon: 'npc-dwarfcaptain',
      iconColor: 'yellow-600',
      idleDialogs: [
        { message: '"The Rocky Flats is full of danger," he says, and goes back to watching the road. He has nothing else for you today.' },
      ],
    }),
    'read sign': {
      showModal: true,
      message: 'You read the Rocky Flats Map Directory.',
      modalContent: {
        title: 'You read the Rocky Flats Directory',
        heading: {
          text: 'Rocky Flats Directory',
          parts: ['Rocky Flats', 'Directory'],
          description: 'Six roads out of the Crossroads, and what is at the end of each.',
        },
        locations: [
          { name: 'Dwarf Village', direction: 'northeast', description: 'The Mining Guild, the Neverending Mine, the Treasury and the Silver Shop.' },
          { name: 'Dwarf Guard Ledge', direction: 'east', description: 'Free arrows, bolts and a polearm, and a good place to catch your breath.' },
          { name: 'Path to Red Town', direction: 'southeast', description: 'The stone road east to the Grand Red Gates.' },
          { name: 'Red Fort & Stone Grotto', direction: 'south', description: 'Bandit country. Red Beard holds the fort at the far end of it.' },
          { name: 'Abandoned Mine', direction: 'west', description: 'The condemned mine, and the muddy path on toward the Swamp.' },
          { name: 'Path to Grassy Field', direction: 'northwest', description: 'North to the Dwarf Guard gate, the Grassy Field and the Ocean.' },
        ],
        questMessage: 'The Captain has three postings of his own, and the Bounty Board in the village square has three more.',
        questMessageDescription: 'Clearing the Abandoned Mine earns the Gold Key for the Treasury chest.',
      },
    },
  },

  // --- The Ledge: the Dwarf Guard's supply crate, and a place to rest ---
  '306': {
    'grab arrows': makeGatherAction({
      itemSlug: 'arrow',
      itemNamePlural: 'arrows',
      topUpTo: 50,
      maxHeldMessage: 'You already have more than 50 arrows. Come back if you run low.',
      topUpMessage: (collected) => `You take a bundle of arrows from the guard's crate. [ +${collected} arrows ]`,
    }),
    'grab bolts': makeGatherAction({
      itemSlug: 'crossbow-bolt',
      itemNamePlural: 'bolts',
      topUpTo: 50,
      maxHeldMessage: 'You already have more than 50 bolts. Come back if you run low.',
      topUpMessage: (collected) => `You take a bundle of bolts from the guard's crate. [ +${collected} bolts ]`,
    }),
    'grab polearm': makeFreeItemAction({
      itemSlug: 'polearm',
      itemName: 'a polearm',
      capLabel: 'polearm',
      icon: 'equipment-polearm',
      iconColor: 'gray-400',
      grantMessage: 'You take the spare polearm off the rack and stow it in your pack.',
      alreadyHaveMessage: 'You already have a polearm. If you lose it, come back here for another free one.',
    }),
    'rest on the ledge': async (playerId, roomState) =>
      roomState.applyRest(playerId, {
        action: 'rest on the ledge',
        overchargeBonus: 50,
        overchargeMessage: 'You sit on the ledge and watch the road for a while. Your HP and MP are fully restored, plus an extra +50 to each.',
      }),
  },

  // --- The Dwarf Village Square: the Bounty Board, the coal fire, the directory ---
  '307': {
    'read bounty board': createNpcTalkHandler({
      npcId: 'dwarf_bounty_board',
      action: 'read bounty board',
      title: 'Dwarf Guard Bounty Board',
      icon: 'npc-bountyboard',
      iconColor: 'yellow-600',
      idleDialogs: [
        { message: 'The board is covered in wanted posters in three different hands, and every one of them has been collected on. Nothing new today.' },
      ],
    }),
    'rest at the coal fire': async (playerId, roomState) =>
      roomState.applyRest(playerId, {
        action: 'rest at the coal fire',
        overchargeBonus: 50,
        overchargeMessage: 'You warm up at the coal fire in the middle of the square. Your HP and MP are fully restored, plus an extra +50 to each.',
      }),
    'read sign': {
      showModal: true,
      message: 'You read the Dwarf Village Directory.',
      modalContent: {
        title: 'You read the Dwarf Village Directory',
        heading: {
          text: 'Dwarf Village Directory',
          parts: ['Dwarf Village', 'Directory'],
          description: 'Everything the Mining Village has, and which side of the square it is on.',
        },
        locations: [
          { name: 'Dwarf Treasury', direction: 'northwest', description: 'The Gold Chest. The Dwarf Captain holds the key.' },
          { name: 'Silver Shop', direction: 'north', description: 'Silver weapons and armour, at silver prices.' },
          { name: 'Neverending Mine', direction: 'northeast', description: 'Stone, iron, coal and mithril, all the way down.' },
          { name: 'Mining Guild', direction: 'east', description: 'The forge, the supply shop, and the guild quests.' },
          { name: 'Rocky Flats Ledge', direction: 'south', description: 'Free arrows, bolts and a polearm.' },
          { name: 'Rocky Flats Crossroads', direction: 'southwest', description: 'The Dwarf Captain, and every road off this map.' },
        ],
        questMessage: 'The Bounty Board here pays for grunts by the ten and for bosses by the head.',
        questMessageDescription: 'Membership of the Mining Guild opens the mine. Membership starts with Red Beard.',
      },
    },
  },

  // --- The Mining Guild: the recruiter, the leader, the forge and the supply shop ---
  // The whole guild in one room. See the note on room 308 in prisma/seed.ts for
  // why the original's five interior rooms are folded in here.
  '308': {
    'talk to mining recruiter': createNpcTalkHandler({
      npcId: 'mining_guild_recruiter',
      action: 'talk to mining recruiter',
      title: 'Mining Guild Recruiter',
      icon: 'npc-miner2',
      iconColor: 'yellow-600',
      idleDialogs: [
        { message: '"You are in. Talk to the Leader at the back — he is the one who decides what you are allowed to make."' },
      ],
    }),
    'talk to guild leader': createNpcTalkHandler({
      npcId: 'mining_guild_leader',
      action: 'talk to guild leader',
      title: 'Mining Guild Leader',
      icon: 'npc-miner',
      iconColor: 'yellow-600',
      preCheck: makeGuildMemberCheck('quest_miningguild_000'),
      preCheckMessage: 'The Guild Leader does not look up. "Members. Talk to the recruiter."',
      idleDialogs: [
        { message: 'He demonstrates perfect mining form at you for a while, then goes back to the bench. Nothing more for now.' },
      ],
    }),
    'view shop': makeShopHandler('308', {
      lockedMessage: 'Join the Mining Guild to buy from its supply shop. Speak to the recruiter.',
      icon: 'npc-miner2',
      iconColor: 'yellow-600',
    }),
    'grab pack': makeMiningPackHandler(),
    'rest at the forge': async (playerId, roomState) => {
      const isMember = await makeGuildMemberCheck('quest_miningguild_000')(playerId)
      if (!isMember) {
        return {
          success: true,
          action: 'rest at the forge',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload('rest at the forge', 'info', 'Join the Mining Guild to rest at the forge.', {
                roomId: roomState.roomId,
                showModal: true,
                modalContent: {
                  type: 'icon',
                  icon: 'npc-miner2',
                  iconColor: 'yellow-600',
                  title: 'Mining Guild',
                  message: 'Join the Mining Guild to rest at the forge. Speak to the recruiter.',
                },
              }),
            },
          ],
        }
      }
      return roomState.applyRest(playerId, {
        action: 'rest at the forge',
        overchargeBonus: 50,
        overchargeMessage: 'You rest at the Guild Forge. Your HP and MP are fully restored, plus an extra +50 to each.',
      })
    },
    'craft': executeCraft,
    'read sign': {
      showModal: true,
      message: 'You read the Mining Guild Directory.',
      modalContent: {
        title: 'You read the Mining Guild Directory',
        heading: {
          text: 'Mining Guild Directory',
          parts: ['Mining Guild', 'Directory'],
          description: 'What the hall holds, and what the guild expects of you.',
        },
        locations: [
          { name: 'The Forge', direction: 'here', description: 'Craft here once the Guild Leader has taught you a metal.' },
          { name: 'Supply Shop', direction: 'here', description: 'Pickaxes and hammers, in iron, steel and mithril.' },
          { name: 'Neverending Mine', direction: 'north', description: 'Stone and iron near the top, coal from Level 10, mithril from Level 20.' },
          { name: 'Dwarf Village Square', direction: 'west', description: 'The Bounty Board, the coal fire and the rest of the village.' },
        ],
        questMessage: 'Membership starts with Red Beard. After that the Guild Leader has three: the Phoenix, the Cyclops and the Minotaur.',
        questMessageDescription: 'Each one you put down is another metal you are allowed to work at the forge.',
      },
    },
  },

  // --- The Dwarf Treasury: the Gold Chest, behind the Captain's key ---
  '309': {
    'open gold chest': makeGoldChestHandler({
      roomId: '309',
      flagField: 'chest4',
      goldMin: 1500,
      goldMax: 2000,
      lockedMessage:
        'The gold chest is locked. The Dwarf Captain at the Crossroads hands over the key for clearing out the Abandoned Mine.',
    }),
  },

  // --- The Silver Shop ---
  '310': { 'view shop': makeShopHandler('310', { icon: 'shop', iconColor: 'blue-300' }) },

  // --- The mine head: free supplies for anyone going down ---
  '311': {
    'grab pickaxe': makeFreeItemAction({
      itemSlug: 'pickaxe',
      itemName: 'a pickaxe',
      capLabel: 'pickaxe',
      icon: 'pickaxe',
      iconColor: 'amber-400',
      grantMessage: 'You take a pickaxe off the trestle. It will not survive the whole mine, but it will get you started.',
      alreadyHaveMessage: 'You already have a pickaxe. Come back if you break it — and you will break it.',
    }),
    'grab red potion': makeGatherAction({
      itemSlug: 'red-potion',
      itemNamePlural: 'red potions',
      topUpTo: 5,
      maxHeldMessage: 'You already have 5 red potions. Come back if you run low.',
      topUpMessage: (collected) => `You take ${collected} red potions from the miners' stores.`,
    }),
    'grab blue potion': makeGatherAction({
      itemSlug: 'blue-potion',
      itemNamePlural: 'blue potions',
      topUpTo: 5,
      maxHeldMessage: 'You already have 5 blue potions. Come back if you run low.',
      topUpMessage: (collected) => `You take ${collected} blue potions from the miners' stores.`,
    }),
  },

  // --- The Abandoned Mine's sign ---
  '315': {
    'read sign': {
      showModal: true,
      message: 'You read the sign at the mine mouth.',
      modalContent: {
        title: 'You read the sign',
        type: 'icon',
        icon: 'sign',
        iconColor: 'gray-500',
        message: 'MINE HAS BEEN CONDEMNED\n\nENTER AT YOUR OWN RISK',
      },
    },
  },

  // --- Under the Grotto: the gloves in the statue's hands ---
  '321b': {
    'ex gloves': {
      showModal: true,
      message: 'You examine the gloves in the statue’s hands.',
      modalContent: {
        title: 'You examine the gloves',
        type: 'icon',
        icon: 'hand',
        iconColor: 'blue-400',
        message:
          'The gloves seem to be an antiquated offering. They are under a thick layer of dust, and you do not think anyone will mind if you take them.',
      },
    },
    'grab gloves': makeFreeItemAction({
      itemSlug: 'grotto-gloves',
      itemName: 'the Grotto Gloves',
      capLabel: 'grotto gloves',
      icon: 'hand',
      iconColor: 'blue-400',
      grantMessage: 'You lift the magical Grotto Gloves out of the statue’s open hands. Look at you go.',
      alreadyHaveMessage:
        'A loud voice comes from every direction at once: "The Dwarven gods allow you ONE pair of grotto gloves!!!"',
    }),
  },

  // --- The Red Fort's sign ---
  '322': {
    'read sign': {
      showModal: true,
      message: 'You read the sign nailed to the courtyard gate.',
      modalContent: {
        title: 'You read the sign',
        type: 'icon',
        icon: 'sign',
        iconColor: 'red-600',
        message: 'BANDIT TERRITORY!',
      },
    },
  },

  // --- The Red Fort Kitchen: the switch that opens the Grotto ---
  // Session-scoped, and spent on the way through the door it opens, exactly as
  // the original spent `$_SESSION['grottoswitch']`. See lever-state.js.
  '325': {
    'flip switch': async (playerId, roomState) => {
      const { isLeverPulled, pullLever, GROTTO_SWITCH, getRoomStateNote, getRoomActionOverrides } =
        require('./lever-state')
      roomState.touchActivity()

      if (isLeverPulled(playerId, GROTTO_SWITCH)) {
        return {
          success: true,
          action: 'flip switch',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: createActionFeedbackPayload('flip switch', 'info', 'You already flipped this switch. Something to the southeast is standing open.', {
                roomId: roomState.roomId,
                stateNote: getRoomStateNote(playerId, '325'),
                actionOverrides: getRoomActionOverrides(playerId, '325'),
              }),
            },
          ],
        }
      }

      pullLever(playerId, GROTTO_SWITCH)
      return {
        success: true,
        action: 'flip switch',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: createActionFeedbackPayload('flip switch', 'success', 'You flip the switch and hear a long grinding noise a very long way to the southeast.', {
              roomId: roomState.roomId,
              showModal: true,
              stateNote: getRoomStateNote(playerId, '325'),
              actionOverrides: getRoomActionOverrides(playerId, '325'),
              modalContent: {
                type: 'icon',
                icon: 'lever-down',
                iconColor: 'yellow-500',
                title: 'You flip the switch',
                message:
                  'Stone moves somewhere a long way off, and keeps moving for longer than seems reasonable. Whatever opened, it opened southeast of here — out past the fort, on the grass path by the Grotto.',
              },
            }),
          },
        ],
      }
    },
  },

  // --- Mine Level 0: the tutorial sign, and no ore whatsoever ---
  '311-00': {
    'read sign': {
      showModal: true,
      message: 'You read the Mine Room Zero sign.',
      modalContent: {
        title: 'You read the Mine Basics sign',
        heading: {
          text: 'Mine Basics',
          parts: ['Mine', 'Basics'],
          description: 'Nailed to the pit prop by the shaft, and worn smooth by a great many hands.',
        },
        locations: [
          { name: 'Dig down', direction: 'down', description: 'Every level down is a swing of the pick, and the pick brings ore up with it.' },
          { name: 'Work this level', direction: 'here', description: 'Mine here as often as you like. Something will find you eventually.' },
        ],
        questMessage:
          'STONE and IRON near the top. COAL from Mine Level 10, MITHRIL from Mine Level 20. A better pickaxe works a harder seam — a plain one only ever brings up stone.',
        questMessageDescription:
          'Every fifth level holds a boss and every tenth a worse one. Mine Level 10 is the Phoenix, 20 the Cyclops, 30 the Minotaur — the three the Mining Guild wants, and the three that decide what you are allowed to forge.',
      },
    },
  },

  '999': {
    'rest in lobby': async (playerId, roomState) => roomState.executeLobbyRest(playerId),
  },
}

/**
 * Every Forest room with choppable trees — the exact set that included
 * `function-choptree.php` in the original game. Merged in rather than repeated
 * inline: the rooms differ only in that they all host the same action, and
 * several of them (120/125/129/130/135) also carry a berry bush declared above.
 */
const FOREST_CHOP_WOOD_ROOMS = [
  '116', '117', '119', '120', '121', '122', '123', '124', '125',
  '126', '127', '129', '130', '131', '132', '133', '134', '135', '136',
]

/**
 * The denser stands: these rooms host two trees instead of one. Each is a
 * separate action key, so each carries its own rolling cooldown — the ActionCap
 * row is keyed by (player, room, action) — and the pair doubles the room's wood
 * without shortening anyone's timer.
 */
const FOREST_TWO_TREE_ROOMS = new Set(['117', '122', '124', '127', '129', '133', '134'])

const CHOP_WOOD_MISSING_TOOL =
  'You need a hatchet to chop these trees. The Forest Gnome keeps a spare one at his tree hut.'

/**
 * Working the level you are standing on. `mine down` is the same swing plus a
 * move, and rides on the shaft gate's `onPass` (room-gates.js) so both paths run
 * one ore table — see services/mining-service.js.
 *
 * Mine Level 0 is deliberately absent: the original put no ore in it and no
 * `mine here` button on it, which is what makes it the one safe room down there.
 */
function makeMineHereAction() {
  return async (playerId, roomState) => {
    const { mineOnce } = require('./services/mining-service')

    roomState.touchActivity()

    const result = await mineOnce(playerId, roomState.roomId)
    const outcome = result.outcome === 'mined' ? 'success' : 'info'

    return {
      success: result.outcome !== 'no-pickaxe',
      action: 'mine here',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: createActionFeedbackPayload('mine here', outcome, result.message, {
            roomId: roomState.roomId,
            ...(result.inventory ? { inventory: result.inventory } : {}),
          }),
        },
      ],
    }
  }
}

for (let depth = 1; depth <= 30; depth += 1) {
  const roomId = `311-${String(depth).padStart(2, '0')}`
  ROOM_ACTIONS[roomId] = {
    ...(ROOM_ACTIONS[roomId] || {}),
    'mine here': makeMineHereAction(),
  }
}

for (const roomId of FOREST_CHOP_WOOD_ROOMS) {
  const twoTrees = FOREST_TWO_TREE_ROOMS.has(roomId)
  ROOM_ACTIONS[roomId] = {
    ...(ROOM_ACTIONS[roomId] || {}),
    // The first tree keeps the original action key, so cooldowns already banked
    // against 'chop wood' in these rooms survive the split.
    'chop wood': makeChopWoodAction({ missingToolMessage: CHOP_WOOD_MISSING_TOOL }),
    ...(twoTrees
      ? { 'chop wood 2': makeChopWoodAction({ missingToolMessage: CHOP_WOOD_MISSING_TOOL }) }
      : {}),
  }
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

  // Tool requirement gate (e.g. a shovel is required to dig sand). `toolRequired`
  // names one tool; `toolRequiredAny` accepts a set of interchangeable tiers
  // (e.g. plain or iron hatchet) — owning any one of them opens the gate.
  const toolOptions = definition.toolRequired
    ? [definition.toolRequired]
    : (Array.isArray(definition.toolRequiredAny) ? definition.toolRequiredAny : [])
  if (toolOptions.length > 0) {
    let hasTool = false
    for (const slug of toolOptions) {
      if (await playerHasItem(playerId, slug)) {
        hasTool = true
        break
      }
    }
    if (!hasTool) {
      // Name the humblest acceptable tool — that's the one the player should go find.
      const missingTool = toolOptions[toolOptions.length - 1]
      const message = typeof definition.generateMessage === 'function'
        ? definition.generateMessage([{ success: false, reason: 'missingTool' }], { missingTool })
        : `You need a ${missingTool} to do that.`
      const outcome = typeof definition.determineOutcome === 'function'
        ? definition.determineOutcome({ success: false, effectResults: [{ success: false }], capInfo: { missingTool } }) || 'failure'
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

  // Definition-level precondition (e.g. a gather that refuses once the player
  // already holds its cap). Runs before the cooldown is consumed so a refusal
  // never burns the window.
  if (typeof definition.precondition === 'function') {
    const check = await definition.precondition(playerId)
    if (check && check.allowed === false) {
      const capInfo = check.capInfo || {}
      const message = typeof definition.generateMessage === 'function'
        ? definition.generateMessage([{ success: false }], capInfo)
        : 'You cannot do that right now.'
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

  // `resolve` lets a definition pick its effects per player (e.g. a better tool
  // raising a gather's yield). It runs after the cooldown is consumed so the
  // resolved batch and the locked window always describe the same collection.
  const resolved = typeof definition.resolve === 'function' ? await definition.resolve(playerId) : null
  const effects = Array.isArray(resolved?.effects)
    ? resolved.effects
    : (Array.isArray(definition.effects) ? definition.effects : [])
  const { results: effectResults, inventory } = await executeEffects(effects, playerId)

  const capInfo = definition.cooldownMs
    ? { remaining: 0, secondsUntilReset: cooldownSeconds }
    : null

  const message = typeof definition.generateMessage === 'function'
    ? definition.generateMessage(effectResults, capInfo, resolved?.context ?? null)
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
        // Echo the requested amount so message builders can report what was
        // actually granted rather than assuming the definition's default.
        quantity: effect.quantity || 1,
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
 *
 * `itemSlug` / `itemNamePlural` / `maxHeld` are static definition data, not
 * player state: the client already holds a live inventory, so it can decide on
 * its own whether the player is at a node's cap and re-render the moment that
 * changes — no per-player query here, and nothing to go stale.
 *
 * @returns {Array<{ action: string, cooldownMs: number, quantity: number|null,
 *                   itemSlug: string|null, itemNamePlural: string|null, maxHeld: number|null,
 *                   readyLabel: string|null }>}
 */
function getGatherActionsForRoom(roomId) {
  const actions = ROOM_ACTIONS[roomId]
  if (!actions) return []
  const result = []
  for (const [action, def] of Object.entries(actions)) {
    if (def && typeof def === 'object' && (def.isGather || def.cooldownMs)) {
      const grant = Array.isArray(def.effects)
        ? def.effects.find((e) => e?.type === 'grantItem')
        : null
      result.push({
        action,
        cooldownMs: def.cooldownMs ?? null,
        quantity: grant?.quantity ?? null,
        itemSlug: grant?.itemSlug ?? null,
        itemNamePlural: def.itemNamePlural ?? null,
        maxHeld: typeof def.maxHeld === 'number' ? def.maxHeld : null,
        readyLabel: def.readyLabel ?? null,
      })
    }
  }
  return result
}

module.exports = {
  executeRoomAction,
  ROOM_ACTIONS,
  CHEST_LOOT,
  REPEATABLE_CHEST_LOOT,
  getGatherActionForRoom,
  getGatherActionsForRoom,
}

