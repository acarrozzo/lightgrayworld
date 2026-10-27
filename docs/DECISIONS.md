# Decisions

The design calls that shaped the recreation, newest last. Each is a choice that could reasonably have gone another way, so it is written down to stop it being relitigated by accident. Dates are when the call was made.

**The original is reference, not source** (project start). Behavior and content are ported; the legacy code is never patched, copied back, or committed. A local copy may sit beside the repo, ignored by Git.

**Server authority over everything** (project start). One Socket.IO command path through a per-player action queue. The client may predict movement; it never decides a result. The old HTTP gameplay routes are 410 stubs and stay that way.

**Battles are player-scoped, not shared** (Sept 2026). Each player fights their own copy of a room's enemy, as in the original. Co-located fighters and party members give each other a 10% offensive and defensive bonus. Shared enemy HP, shared loot and party encounters were considered and declined; mixing the two models creates unclear ownership and exploits.

**One enemy per room per player** (Sept 2026). Multi-enemy waves were removed for a single typed present-enemy slot. Neutral mobs persist. Future NPCs are shared; mobs are per player.

**Buffs are counted in clicks** (Sept 2026). Every temporary effect is a click countdown on the player row, decremented once per counted action, chat excluded, exactly like the click counter. Only one consumable buff (capsules, coffee, tea) runs at a time; wings, gills, wards, spells and Glory sit outside that slot.

**Which actions provoke an enemy** (Sept 2026). Rest, search, use, equip, pickup and drop can provoke. Refusals and no-ops are free. A directional step out of a fight is refused; a teleport is allowed and is the escape hatch, as in the original, leaving the enemy standing at full HP for next time. Grace after a fight applies on a win only.

**Room supplies are per player** (Sept 2026). What a room hands out for free is tracked per player (take once, or top up to N), replacing shared loot piles. Harvests such as trees and berries stay room actions on a rolling cooldown with no held cap. Shared room item rows are only what players drop.

**HP 0 is death** (Sept 2026). The defeat card holds until the player chooses Rise, then they wake at 1 HP in the Plane of Rebirth with every buff cleared.

**Factions are derived, never stored** (Sept 2026). Standing is quests done out of the faction's total; guild membership is the membership quest turned in. "Talk to X" quests are a reward-free intro type completed from dialog.

**Travelers are a modern addition** (Sept 2026). The original had no moving NPCs. Route travelers' rooms are a pure function of UTC time; wanderers are process-local and reset on restart. A fightable traveler is still fought per player.

**Color is semantic** (Sept 2026). Components name a meaning (`resource.hp`, `status.error`, `mood.danger`), never a hue. Themes are typed recipes flattened to CSS variables. The account's theme wins over the device's. Room button hues are hand-picked per room and stay that way.

**Fast travel is the original's grid** (Sept 2026). The 3×3 region grid with Grassy Field at the center, hub discovery on arrival, 1 MP per jump, guild halls as membership sub-hubs.

**One tab bar, no full-screen modes** (Oct 2026). Explore, Char, Inv, World, Quests, Feed and Actions on one bar, with header sub-tabs. The World tab is one zoomable map from the 3×3 world down to a sheet.

**The header steps down by its own width** (Oct 2026). No separate phone and desktop markup. A written drop order decides what leaves as the bar narrows; HP, MP, level with XP percent, the four stats, Settings and the connection dot never leave.

**Steel is smelted, mithril is worked raw** (Oct 2026). The original stored coal, steel and mithril and sold the hammers for them but never wrote a steel or mithril recipe. Steel is a material made at the Mining Guild forge from one iron and one coal; mithril ore goes straight under the hammer. Both tiers copy the iron tier's unit counts, open when the Cyclops and Minotaur quests are turned in, and are forged at the Mining Guild only. A mithril hammer works steel; nothing stands in for the mithril hammer. Picks and hammers of each tier are craftable at 3 units plus wood, like iron's. No steel or mithril maul, no steel hatchet, and the javelins, necklaces, rings and Steel Master Helm stay drops and quest rewards.

**The story is told through the game's own grammar** (Oct 2026). Canon lives in `docs/STORY.md`. Lore reaches the player only through what already exists: signs and examine actions, giver dialog that changes with the giver's own quests, rotating idle lines and gated asides on a giver, rare placed arrival lines, item and enemy descriptions, the world feed. No cutscenes, lore tab or journal paragraphs. Every player-facing line is drafted for Anthony to rewrite in his own voice before it ships; draft tables live under `docs/story/`.

**Lines** (Oct 2026). The one system by which the world speaks outside the quest flow. A line is a short sentence from a set, served in order one press at a time per player (process-local cursor, reset on restart), shown in yellow italic in the room box until the next line or the next room (no modal, no turn), and written to the world feed as a `line` event with its speaker and a source tag (`room · speaker · set #n`) shown while the line-sources setting is on, so any line read in play can be found in the data; the World Tool's Lines page searches and filters the same sets by kind, room and speaker. Three kinds of set: a shopkeeper's `keeper.lines` (a talk button in the shop's room, and one line under the shop window's title), a room's `overheard.js` lines (a Listen In button), and a quest giver's idle lines and asides (heard through Talk, and again through a Chat button on the NPC card that never touches the quest flow). `game-data/lines.js` is the registry; the World Tool's Lines page reads it. Modals, lore tabs and journal paragraphs were declined.

**Full screen is a window over the tab, for the map and the book** (Oct 2026). Two tabs can cover the whole window: the World map (Oct 14) and the Skills and Spells book (Oct 26). Both wear one frame: the tab's sub-tabs, a slim HP/MP line, Leave full screen, Close. The choice is remembered per device when the player makes it with Maximize or Leave; a shortcut that always opens full screen (the compass's mini-map, a teacher's room button) does not change the memory; a fight always drops back to the docked tab. The docked pages stay. A teacher's room shows a "Skills" or "Spells" door only once that teacher's flag is set; the doors are derived from the teacher tables, not listed by hand. An index-plus-page layout and two books side by side were drawn and declined in favor of the existing cards given the width.
