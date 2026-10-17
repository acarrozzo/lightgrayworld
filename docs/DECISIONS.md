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
