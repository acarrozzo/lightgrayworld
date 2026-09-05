-- The Dark Forest and the Dark Forest upper level (the Ranger's Guild tree
-- tops and the second floor of the Dark Keep).
--
-- 1. `darkForestUpperMap`: the second Dark Forest map flag. `darkForestMap`
--    already existed for the surface sheet; the rooms above it are drawn on
--    their own artwork (lightgray_map_dark_forest_upperlevel.jpg), the way the
--    Forest and Red Town each carry a surface and a second sheet.
--
-- 2. A COMPANION equip slot. The original's companions (the Dwarf Axeman, the
--    Elf Ranger) were a slot beside the mount that swung once on every attack
--    turn. They are worn like any other equipment row — one at a time — so the
--    only schema change is a new value on the slot enum, as ARTIFACT was.
--
-- 3. `silverAura`: learned once from the Silver Shaman in a full Silver set.
--    A standing +20 to every core stat, applied where buffs are (see
--    src/lib/game-engine/services/buff-service.js), never written into the
--    derived *Mod columns.
--
-- Purely additive: both columns have defaults and the enum value is unused by
-- existing rows, so nothing needs a backfill.
ALTER TYPE "EquipSlot" ADD VALUE 'COMPANION';

ALTER TABLE "User" ADD COLUMN "darkForestUpperMap" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "silverAura" BOOLEAN NOT NULL DEFAULT false;
