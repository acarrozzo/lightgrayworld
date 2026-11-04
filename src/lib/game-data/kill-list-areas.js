/**
 * The Kill List's boxes.
 *
 * The original's kl.php drew one box per area, in world order, each with a
 * hand-written level range and a colored heading, and listed every enemy of
 * that area in it from day one: gray until killed, then `lvl N: Name` and the
 * count in gold. These are those 27 boxes. An enemy says which box it is in
 * through `area` on its registry entry (game-data/enemies.js), so the page is
 * derived from the registry and nothing here names an enemy.
 *
 * `sheet` is the map sheet (world-map.js MAP_SHEETS id) whose discovery
 * reveals the box: arriving in any room of the sheet marks it found
 * (applyArrivalDiscoveries), so "found the map" and "set foot there" are the
 * same thing. A box also shows once anything in it has been killed, for the
 * enemies that roam onto other sheets (a Golden Bat in the Rocky Flats, a
 * Troll on the forest road).
 *
 * `levels` is the original's label, not derived — it ranged the box by feel
 * (Silver Temple is "80-1000"). `tone` is the heading's color, in the
 * original's own vocabulary; `lib/kill-list.ts` maps a tone to a theme token.
 */
const KL_AREAS = [
  { id: 'grassy-field', name: 'Grassy Field', levels: '1–5', sheet: 'grassy-field', tone: 'yellowgreen' },
  { id: 'spider-cave', name: 'Spider Cave', levels: '2–5', sheet: 'grassy-field', tone: 'gray' },
  { id: 'scorpion-pit', name: 'Scorpion Pit', levels: '5–30', sheet: 'grassy-field-underground', tone: 'lightred' },
  { id: 'bat-cave', name: 'Bat Cave', levels: '2–10', sheet: 'grassy-field-underground', tone: 'darkblue' },
  { id: 'forest-path', name: 'Forest Path', levels: '1–10', sheet: 'forest', tone: 'green' },
  { id: 'ogre-lair', name: 'Ogre Lair', levels: '2–13', sheet: 'forest-underground', tone: 'blue' },
  // The original's heading read "Kobold Layer"; the lair it is.
  { id: 'kobold-lair', name: 'Kobold Lair', levels: '3–13', sheet: 'forest-underground', tone: 'medpurple' },
  { id: 'forest', name: 'Forest', levels: '5–13', sheet: 'forest', tone: 'green' },
  { id: 'sewers', name: 'Sewers', levels: '1–10', sheet: 'red-town-sewers', tone: 'lightred' },
  { id: 'thieves-den', name: 'Thieves Den', levels: '5–14', sheet: 'red-town-sewers', tone: 'gold' },
  { id: 'catacombs', name: 'Catacombs', levels: '7–17', sheet: 'red-town-sewers', tone: 'white' },
  { id: 'abandoned-mine', name: 'Abandoned Mine', levels: '15–23', sheet: 'rocky-flats-underground', tone: 'green' },
  { id: 'stone-grotto', name: 'Stone Grotto', levels: '20–25', sheet: 'rocky-flats', tone: 'lightblue' },
  { id: 'red-beards-fort', name: "Red Beard's Fort", levels: '15–30', sheet: 'rocky-flats', tone: 'lightred' },
  { id: 'blue-ocean', name: 'Blue Ocean', levels: '10–40', sheet: 'ocean', tone: 'blue' },
  { id: 'under-the-ocean', name: 'Under the Ocean', levels: '15–25', sheet: 'ocean-underwater', tone: 'darkblue' },
  { id: 'water-temples', name: 'Water Temples', levels: '35–50', sheet: 'ocean', tone: 'lightblue' },
  { id: 'iron-mine', name: 'Iron Mine', levels: '15–30', sheet: 'neverending-mine', tone: 'lightbrown' },
  { id: 'steel-mine', name: 'Steel Mine', levels: '20–40', sheet: 'neverending-mine', tone: 'gray' },
  { id: 'mithril-mine', name: 'Mithril Mine', levels: '30–60', sheet: 'neverending-mine', tone: 'blue' },
  { id: 'mountain-path', name: 'Mountain Path', levels: '20–45', sheet: 'dark-forest', tone: 'gray' },
  { id: 'dark-forest', name: 'Dark Forest', levels: '20–45', sheet: 'dark-forest', tone: 'darkgreen' },
  { id: 'dark-keep', name: 'Dark Keep', levels: '30–60', sheet: 'dark-forest', tone: 'lgray' },
  { id: 'cathedral', name: 'Cathedral', levels: '40–60', sheet: 'mountains', tone: 'lightpurple' },
  { id: 'mountains', name: 'Mountains', levels: '30–60', sheet: 'mountains', tone: 'gray' },
  { id: 'the-despair', name: 'The Despair', levels: '50–100', sheet: 'the-despair', tone: 'ddgray' },
  { id: 'silver-temple', name: 'Silver Temple', levels: '80–1000', sheet: 'mountains', tone: 'lightblue' },
]

/**
 * The original stylesheet's color classes, as the Kill List used them for its
 * headings and for a boss's name. The names are the original's; what each one
 * means in the theme is the client's business (lib/kill-list.ts).
 */
const KL_TONES = [
  'yellowgreen', 'gray', 'lgray', 'ddgray', 'white', 'black',
  'green', 'darkgreen', 'blue', 'darkblue', 'lightblue',
  'red', 'lightred', 'gold', 'lightbrown', 'purple', 'medpurple', 'lightpurple',
]

const AREAS_BY_ID = new Map(KL_AREAS.map((area) => [area.id, area]))

/** @param {string} id */
function getKillListArea(id) {
  return AREAS_BY_ID.get(id) || null
}

module.exports = { KL_AREAS, KL_TONES, getKillListArea }
