/**
 * Classic item order.
 *
 * The first 241 entries are the order the original game listed
 * items in its INV tab (inv.php: 1h weapons, 2h weapons, ranged, shields, head,
 * body, hands, feet, rings, neck, artifacts, then mounts, then the Heal and
 * Buffs lists, quest items, keys and maps), mapped onto the modern slugs. Items
 * the original never had (58 of them: mini shields, horses, the
 * earth and gamma sets, crafting materials and tools) follow in the order
 * prisma/seed.ts declares them. Anything missing from this list sorts after it,
 * by name.
 *
 * This is presentation only. Regenerate by re-mapping inv.php's "equip ..."
 * buttons and its mount/heal/quest lists onto seed.ts slugs when either changes.
 */
export const CLASSIC_ITEM_ORDER = [
  'dagger', 'training-sword', 'short-sword', 'mace', 'broad-sword', 'long-sword', 'club', 'flail',
  'morning-star', 'samurai-sword', 'gladius', 'basic-staff', 'wooden-staff', 'wand',
  'wizard-staff', 'demon-dagger', 'gray-wand', 'three-chained-flail', 'bastard-sword',
  'giant-club', 'great-white-sword', 'iron-dagger', 'iron-sword', 'iron-staff', 'poison-saber',
  'ulfberht', 'axe-of-slaughter', 'silver-sword', 'silver-staff', 'steel-dagger',
  'staff-of-the-scorpion', 'guardian-blade', 'gilded-falcion', 'training-2h-sword', 'bo',
  'battle-axe', 'warhammer', 'wooden-bo', 'pike', 'claymore', 'great-sword', 'bo-staff',
  'battle-staff', 'dual-tomahawk', 'nunchaku', 'bone-knuckles', 'polearm', 'bone-cudgel',
  'hammerhead-hammer', 'iron-maul', 'iron-2h-sword', 'iron-battle-staff', 'iron-nunchaku',
  'great-axe', 'solomon-staff', 'silver-2h-sword', 'steel-nunchaku', 'heavy-hammer', 'glaive',
  'mithril-2h-sword', 'mithril-nunchaku', 'humongous-battleaxe', 'gargantuan-warhammer',
  'fortified-fauchard', 'neutron-staff', 'boomerang', 'chakram', 'wooden-bow', 'hunter-bow',
  'long-bow', 'crossbow', 'iron-boomerang', 'iron-chakram', 'iron-bow', 'enchanted-bow',
  'iron-crossbow', 'hand-crossbow', 'compound-crossbow', 'silver-boomerang', 'silver-bow',
  'silver-crossbow', 'steel-chakram', 'mithril-boomerang', 'mithril-chakram', 'black-crossbow',
  'galaxy-bow', 'training-shield', 'basic-shield', 'kite-shield', 'buckler', 'wooden-shield',
  'hunter-shield', 'off-hand-dagger', 'tower-shield', 'glowing-orb', 'enchanted-orb',
  'iron-shield', 'iron-kite-shield', 'red-shield', 'death-orb', 'silver-shield', 'viking-shield',
  'off-hand-sword', 'off-hand-mace', 'training-helmet', 'basic-helmet', 'basic-hood', 'red-hood',
  'green-hood', 'blue-hood', 'leather-hood', 'leather-helmet', 'horned-helmet', 'barbarian-helmet',
  'gray-hood', 'wizard-hat', 'battle-helm', 'scorpion-hood', 'iron-hood', 'iron-helmet',
  'haunted-helm', 'bandit-hood', 'earth-hood', 'kettle-helm', 'silver-helmet', 'gamma-hood',
  'training-armor', 'padded-armor', 'pajamas', 'green-cloak', 'black-robe', 'gray-robe',
  'leather-vest', 'leather-armor', 'sasquatch-cloak', 'turtle-shell', 'iron-armor', 'iron-cape',
  'champion-armor', 'silver-breastplate', 'steel-cape', 'mithril-cape', 'training-gloves',
  'wrist-bracers', 'glowing-brace', 'black-gloves', 'green-gloves', 'gray-gloves',
  'leather-gloves', 'hunter-gloves', 'troll-gloves', 'iron-gauntlets', 'iron-gloves',
  'bandit-gloves', 'gator-gloves', 'grotto-gloves', 'silver-gauntlets', 'training-boots',
  'red-boots', 'green-boots', 'black-boots', 'gray-boots', 'slippers', 'leather-boots',
  'troll-boots', 'bone-boots', 'iron-boots', 'bandit-boots', 'silver-boots', 'silk-moccasins',
  'ring-of-str', 'ring-of-dex', 'ring-of-mag', 'ring-of-def', 'ring-of-strength-ii',
  'ring-of-dexterity-ii', 'ring-of-magic-ii', 'ring-of-defense-ii', 'ring-of-strength-iii',
  'ring-of-dexterity-iii', 'ring-of-magic-iii', 'ring-of-defense-iii', 'ring-of-strength-v',
  'ring-of-dexterity-v', 'ring-of-magic-v', 'ring-of-defense-v', 'soldiers-ring', 'hunter-ring',
  'red-wizard-ring', 'yellow-wizard-ring', 'rabid-ring', 'silver-ring', 'ring-of-the-magi',
  'ring-of-strength-vii', 'ring-of-dexterity-vii', 'ring-of-magic-vii', 'ring-of-defense-vii',
  'ring-of-defense-x', 'ring-of-dexterity-xiii', 'ring-of-defense-xx', 'ring-of-health-regen',
  'ring-of-mana-regen', 'ring-of-health-regen-iii', 'ring-of-mana-regen-iii',
  'ring-of-health-regen-v', 'wooden-necklace', 'bone-necklace', 'stone-necklace', 'red-talisman',
  'green-pendant', 'vapor-necklace', 'silver-necklace', 'iron-necklace', 'warrior-pendant',
  'ranger-amulet', 'steel-necklace', 'mithril-necklace', 'redberry', 'raw-meat', 'cooked-meat',
  'red-potion', 'meatball', 'red-balm', 'blueberry', 'blue-potion', 'bluefish', 'blue-balm',
  'veggies', 'purple-potion', 'purple-balm', 'wings-potion', 'gills-potion', 'coffee', 'reds',
  'greens', 'blues', 'yellows', 'flower', 'scorpion-tail', 'bat-wing', 'gold-key', 'welcome-book',
  'shovel', 'dirt', 'wheat', 'sand', 'stone', 'wood', 'leather', 'iron', 'hatchet', 'iron-hatchet',
  'pickaxe', 'hammer', 'goblin-cloak', 'master-sword', 'crossbow-bolt', 'bread', 'string', 'arrow',
  'leather-whip', 'red-mini-shield', 'green-mini-shield', 'blue-mini-shield', 'starter-orb',
  'short-bow', 'gray-matter', 'pony', 'stallion', 'clydesdale', 'thoroughbred', 'donkey', 'mule',
  'mustang', 'unicorn', 'coal', 'mithril', 'mud', 'water', 'iron-pickaxe', 'steel-pickaxe',
  'mithril-pickaxe', 'iron-hammer', 'steel-hammer', 'mithril-hammer', 'javelin', 'iron-javelin',
  'steel-javelin', 'iron-ring', 'steel-ring', 'mithril-ring', 'earth-armor', 'earth-mittens',
  'earth-boots', 'gamma-robe', 'gamma-handwraps', 'gamma-boots', 'vambraces', 'heater-shield',
] as const

/**
 * Creates a Map of item slug to classic display index.
 * Items not in the list get a high order value (appear at end).
 */
export function getItemDisplayOrder(): Map<string, number> {
  const orderMap = new Map<string, number>()
  CLASSIC_ITEM_ORDER.forEach((slug, index) => {
    orderMap.set(slug, index)
  })
  return orderMap
}

/**
 * Get the classic display index for an item slug.
 * Returns the index if found, otherwise a high number so unknown items sort last.
 */
export function getItemOrderIndex(slug: string, orderMap: Map<string, number>): number {
  return orderMap.get(slug) ?? 999999
}
