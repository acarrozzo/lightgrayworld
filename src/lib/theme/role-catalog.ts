/**
 * What every semantic role means, and where it is used.
 *
 * The theme definitions say what colour a role *is*; this says what it is
 * *for*. That distinction is the whole reason the token vocabulary holds
 * together: `resource.hp` and `status.error` may resolve to similar reds in
 * some theme, but they answer different questions, and a component that reaches
 * for the wrong one welds two unrelated meanings together permanently.
 *
 * Consumed by the World Tool's theme reference. Kept beside the definitions so
 * a role added to `types.ts` and left undocumented here is visible immediately —
 * the page renders straight from `themeToCssVars`, so an undocumented variable
 * simply has no row.
 */

export interface RoleDoc {
  /** The token as a component author writes it, e.g. `action.attack`. */
  token: string
  /** The CSS custom property it resolves to. */
  cssVar: string
  /** What the role means. One sentence, in the game's own terms. */
  meaning: string
  /** Where it actually appears in the game. */
  usedFor: string
}

export interface RoleGroup {
  id: string
  title: string
  /** Why this group exists as a group. */
  blurb: string
  roles: RoleDoc[]
}

const role = (token: string, cssVar: string, meaning: string, usedFor: string): RoleDoc => ({
  token,
  cssVar,
  meaning,
  usedFor,
})

export const ROLE_CATALOG: RoleGroup[] = [
  {
    id: 'surfaces',
    title: 'Surfaces',
    blurb:
      'Ordered by elevation. Canvas is the page behind everything; sunken is a well cut into a panel; raised is a control or a card on a card. Terminal colours are never used here — an ANSI colour is chosen for contrast against a background, so painting a panel with one leaves nothing able to sit on top of it.',
    roles: [
      role('surface.canvas', '--surface-canvas', 'The page itself, behind every panel.', 'Body background, the ground under the room view and the login screen.'),
      role('surface.sunken', '--surface-sunken', 'A well cut into a panel — deeper than the thing containing it.', 'Feed bodies, chat scrollbacks, text inputs.'),
      role('surface.panel', '--surface-panel', 'The standard card. Most of the interface sits on this.', 'Room box, character panel, quest list, the header bar.'),
      role('surface.raised', '--surface-raised', 'A control, or a card resting on another card.', 'Buttons, inventory tiles, item rows, stat chips.'),
      role('surface.overlay', '--surface-overlay', 'A modal or popover floating above the page.', 'Settings modal, shop, avatar picker, quest reward dialogs.'),
      role('surface.hover', '--surface-hover', 'The resting surface, lifted, while the pointer is over it.', 'Every hoverable row, tab and button.'),
      role('surface.selected', '--surface-selected', 'A surface that is currently chosen.', 'Active tab, selected inventory item, current map.'),
      role('surface.disabled', '--surface-disabled', 'A control that cannot be used right now.', 'Buttons blocked by cost, cooldown or a missing requirement.'),
      role('scrim', '--scrim', 'The dim laid over the page behind a modal.', 'Modal and drawer backdrops.'),
      role('shadow', '--shadow', 'The shadow cast by a raised element.', 'Panel and modal drop shadows.'),
    ],
  },
  {
    id: 'text',
    title: 'Text',
    blurb:
      'A rank, not a palette. Each step down is less important, not merely dimmer — which is why the names describe standing rather than lightness, and why a light theme could later invert the values without a component changing.',
    roles: [
      role('text.bright', '--fg-bright', 'The most important text on screen.', 'Headings, player name, key numbers.'),
      role('text.primary', '--fg-primary', 'Body copy. The default for reading.', 'Room descriptions, feed messages, item text.'),
      role('text.secondary', '--fg-secondary', 'Supporting text that is still meant to be read.', 'Labels, secondary stats, timestamps.'),
      role('text.muted', '--fg-muted', 'Captions and hints — present, not competing.', 'Helper text, placeholders, counts.'),
      role('text.disabled', '--fg-disabled', 'Text belonging to something unavailable.', 'Disabled button labels, locked content.'),
      role('text.onAccent', '--fg-on-accent', 'Text drawn on top of a filled accent surface.', 'Primary button labels.'),
    ],
  },
  {
    id: 'structure',
    title: 'Borders and emphasis',
    blurb:
      'The interface’s own voice, separate from anything the game means. Accent is chrome — it must never read as a reward, which is why several themes deliberately place it away from their gold.',
    roles: [
      role('line.subtle', '--line-subtle', 'A quiet division between areas.', 'Panel edges, list separators, input borders.'),
      role('line.strong', '--line-strong', 'A division that needs to be seen.', 'Active borders, table rules, scrollbar thumbs.'),
      role('line.focus', '--line-focus', 'Keyboard focus. Must be visible in every theme.', 'Focus rings on every interactive element.'),
      role('accent', '--accent', 'The interface’s emphasis colour.', 'Primary buttons, links, active navigation.'),
      role('accent.hover', '--accent-hover', 'Accent, lifted, under the pointer.', 'Primary button and link hover.'),
      role('accent.muted', '--accent-muted', 'Accent held far back, for fills behind accent text.', 'Selected-tab washes, badge backgrounds.'),
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    blurb:
      'The verbs a player can perform. Each keeps its own role even where a theme resolves several to similar values, so a later theme can pull them apart without touching a component.',
    roles: [
      role('action.attack', '--action-attack', 'Striking something. Warm and hot — never pink.', 'The attack button, combat action chips, "attack dummy" room actions.'),
      role('action.search', '--action-search', 'Looking for what is not obvious.', 'The search action and the reveals it produces.'),
      role('action.rest', '--action-rest', 'Recovering. Calm, the opposite of attack.', 'The rest action and healing-spring interactions.'),
      role('action.look', '--action-look', 'Free observation that costs nothing.', 'Look, examine, and read-sign actions.'),
      role('action.talk', '--action-talk', 'Speaking to somebody.', 'NPC dialogue buttons, quest givers.'),
      role('action.travel', '--action-travel', 'Movement between rooms.', 'Compass and travel affordances.'),
      role('action.craft', '--action-craft', 'Making something. Forge-warm.', 'Crafting panel, fires, workbenches.'),
      role('action.gather', '--action-gather', 'Taking from the world.', 'Picking berries, mining, harvesting.'),
      role('action.use', '--action-use', 'Consuming or applying an item.', 'Use/equip actions, potion buttons.'),
    ],
  },
  {
    id: 'resources',
    title: 'Resources',
    blurb:
      'Vitals and currency. HP is deliberately a different role from both attack and error: a health bar, a damage number and a failed request are three different things that all happen to be red.',
    roles: [
      role('resource.hp', '--resource-hp', 'Health. Crimson — blood, not alarm.', 'HP bars in the header, character panel and battle frame.'),
      role('resource.mp', '--resource-mp', 'Magic points.', 'MP bars and spell costs.'),
      role('resource.xp', '--resource-xp', 'Experience and progress toward a level.', 'XP bar, progress readouts.'),
      role('resource.gold', '--resource-gold', 'Currency.', 'Gold counts, shop prices, reward tiles.'),
    ],
  },
  {
    id: 'stats',
    title: 'Core stats',
    blurb:
      'The four stats keep fixed identities so a number means the same thing everywhere it appears — the header, the character panel, the battle frame and the allocation modals.',
    roles: [
      role('stat.str', '--stat-str', 'Strength. Drives melee attack.', 'STR readouts and allocation controls.'),
      role('stat.dex', '--stat-dex', 'Dexterity. Drives ranged attack and ranged defence.', 'DEX readouts and allocation controls.'),
      role('stat.mag', '--stat-mag', 'Magic. Drives spells and magic defence.', 'MAG readouts and allocation controls.'),
      role('stat.def', '--stat-def', 'Defence. Reduces incoming melee.', 'DEF readouts and allocation controls.'),
    ],
  },
  {
    id: 'status',
    title: 'Status',
    blurb:
      'Message severity. Error is the loudest red in every theme and is kept clear of HP, attack and Red Town by construction, not by review.',
    roles: [
      role('status.success', '--status-success', 'Something worked.', 'Confirmations, successful pickups, connection indicator.'),
      role('status.error', '--status-error', 'Something failed or is blocked. The loudest signal.', 'Errors, blocked gates, failed actions, disconnection.'),
      role('status.warning', '--status-warning', 'Proceed carefully.', 'Low vitals, risky actions, cooldown notices.'),
      role('status.info', '--status-info', 'Neutral information.', 'Hints, notices, informational feed lines.'),
    ],
  },
  {
    id: 'combat',
    title: 'Combat',
    blurb:
      'Battle outcomes and numbers, kept separate from both status and resources. A damage number is not an error, and a victory is not a successful form submission.',
    roles: [
      role('combat.victory', '--combat-victory', 'You won.', 'Victory frame, its borders and headings.'),
      role('combat.defeat', '--combat-defeat', 'You lost.', 'Defeat frame, its borders and headings.'),
      role('combat.damage', '--combat-damage', 'Damage dealt or taken.', 'Damage numbers in the battle frame and feed.'),
      role('combat.heal', '--combat-heal', 'Health restored.', 'Healing numbers and restore effects.'),
      role('combat.miss', '--combat-miss', 'Nothing landed.', 'Miss and block readouts.'),
      role('combat.crit', '--combat-crit', 'An exceptional hit.', 'Critical numbers, enemy special actions.'),
    ],
  },
  {
    id: 'loot',
    title: 'Loot and enemies',
    blurb:
      'Rarity is a ladder and reads as one; enemy disposition tells a player at a glance whether a creature is a threat.',
    roles: [
      role('loot.common', '--loot-common', 'Ordinary.', 'Item cards and drop lists.'),
      role('loot.uncommon', '--loot-uncommon', 'Better than ordinary.', 'Item cards and drop lists.'),
      role('loot.rare', '--loot-rare', 'Rare.', 'Item cards and drop lists.'),
      role('loot.epic', '--loot-epic', 'Very rare.', 'Item cards, reward tiles.'),
      role('loot.legendary', '--loot-legendary', 'The best tier.', 'First-kill drops, legendary rewards.'),
      role('enemy.hostile', '--enemy-hostile', 'Will attack you.', 'Enemy names and roster chips.'),
      role('enemy.neutral', '--enemy-neutral', 'Will not attack unprovoked.', 'Neutral creature names.'),
      role('enemy.boss', '--enemy-boss', 'A named, serious threat.', 'Boss names and encounter framing.'),
    ],
  },
  {
    id: 'channels',
    title: 'Feed channels',
    blurb:
      'Who is speaking, and where. Colour is a secondary cue here — every channel also carries a label, because a player should never have to rely on hue alone to tell a whisper from a shout.',
    roles: [
      role('channel.room', '--channel-room', 'Said in this room.', 'Room chat lines and the room chat tab.'),
      role('channel.world', '--channel-world', 'Said to the whole world.', 'World chat lines and the world tab.'),
      role('channel.action', '--channel-action', 'Something you did.', 'Action results in the feed and activity bar.'),
      role('channel.dm', '--channel-dm', 'A direct message.', 'DM threads and notification badges.'),
      role('channel.system', '--channel-system', 'The game speaking.', 'System notices and server messages.'),
      role('channel.quest', '--channel-quest', 'Quest progress.', 'Quest feed lines and completion notices.'),
    ],
  },
  {
    id: 'terrain',
    title: 'Terrain',
    blurb:
      'Ground and material. These are the semantic descendants of the original world data’s own `grass`, `dirt`, `sand` and `forest` values — the rooms were already reaching for this vocabulary before there was a theme system to hold it.',
    roles: [
      role('terrain.grass', '--terrain-grass', 'Open grassland.', 'Room titles, compass directions leading onto grass.'),
      role('terrain.forest', '--terrain-forest', 'Deep woodland.', 'Forest room titles and exits.'),
      role('terrain.dirt', '--terrain-dirt', 'Bare earth and dirt roads.', 'Dirt-road rooms and their exits.'),
      role('terrain.sand', '--terrain-sand', 'Sand and shoreline.', 'Beach rooms and their exits.'),
      role('terrain.stone', '--terrain-stone', 'Worked or bare stone.', 'Stone paths, cave walls, room icons.'),
      role('terrain.water', '--terrain-water', 'Water.', 'Rivers, lakes, ocean rooms.'),
      role('terrain.ash', '--terrain-ash', 'Burnt or dead ground.', 'Ruined rooms, dark exits.'),
      role('terrain.bone', '--terrain-bone', 'Bone and pale remains.', 'Catacombs, graveyards, skull rooms.'),
    ],
  },
  {
    id: 'mood',
    title: 'Room mood',
    blurb:
      'Atmosphere, and the one group added beyond the original brief. The legacy world data spent raw reds and purples on room titles meaning danger and magic — a bloody path, an ogress’s fire altar, a wizard’s guild. A dangerous room is not the same thing as a hostile enemy, so it gets its own vocabulary rather than borrowing one.',
    roles: [
      role('mood.danger', '--mood-danger', 'This place is dangerous.', 'Bloody paths, fire altars, the scorpion pit, arenas.'),
      role('mood.arcane', '--mood-arcane', 'Magic is at work here.', 'Wizard guilds, magic altars, hidden exits on the atlas.'),
      role('mood.sacred', '--mood-sacred', 'A holy or protected place.', 'Churches, temples, shrines.'),
      role('mood.treasure', '--mood-treasure', 'Something valuable is here.', 'Treasure rooms, chests, the mining guild, lever exits.'),
      role('mood.calm', '--mood-calm', 'Safe, still, unthreatening.', 'Healing springs, quiet halls, resting places.'),
      role('mood.decay', '--mood-decay', 'Rotten, stagnant, abandoned.', 'Sewers, catacombs, ruined chambers.'),
    ],
  },
  {
    id: 'hues',
    title: 'Decorative hues',
    blurb:
      'Colour that distinguishes without meaning anything. The Quests tab is "the gold one", not "the reward one". Reach for these only where no semantic role applies — an attack button is `action.attack`, never `hue.red`.',
    roles: [
      role('hue.gray', '--hue-gray', 'Neutral identity.', 'Tabs, avatars, room-action buttons.'),
      role('hue.red', '--hue-red', 'Red identity.', 'Tabs; "pick redberry" and other literal-colour room actions.'),
      role('hue.gold', '--hue-gold', 'Gold identity.', 'Tabs, signs, NPC buttons.'),
      role('hue.green', '--hue-green', 'Green identity.', 'Tabs, teleport buttons.'),
      role('hue.sky', '--hue-sky', 'Sky identity.', 'Tabs and light-blue affordances.'),
      role('hue.blue', '--hue-blue', 'Blue identity.', 'Tabs; "pick blueberry" and other literal-colour room actions.'),
      role('hue.violet', '--hue-violet', 'Violet identity.', 'Tabs, level-up training points.'),
      role('hue.purple', '--hue-purple', 'Purple identity.', 'Tabs and DM accents.'),
      role('hue.pink', '--hue-pink', 'Pink identity.', 'Tabs and decorative highlights.'),
    ],
  },
]

/** Every documented CSS variable, for cross-checking against a theme's output. */
export const DOCUMENTED_VARS: string[] = ROLE_CATALOG.flatMap((g) => g.roles.map((r) => r.cssVar))

/** How a region's palette slots are used. */
export const REGION_SLOT_DOCS: { slot: string; meaning: string }[] = [
  { slot: 'base', meaning: 'The region’s identity colour. Everything else is derived from it.' },
  { slot: 'title', meaning: 'Room name. Lifted until it reads as a heading on a panel.' },
  { slot: 'subtitle', meaning: 'Room subtitle, held back from the title.' },
  { slot: 'icon', meaning: 'The room’s primary icon.' },
  { slot: 'direction', meaning: 'Compass buttons for exits leading through this region.' },
  { slot: 'accent', meaning: 'Regional highlights and map accents.' },
  { slot: 'tint', meaning: 'Atmospheric wash over the room panel. Carries alpha.' },
]
