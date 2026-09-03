-- The Blue Ocean and Under the Ocean.
--
-- 1. `oceanUnderwaterMap`: the second Blue Ocean map flag. `oceanMap` already
--    existed for the surface sheet; the rooms below it are drawn on their own
--    artwork (lightgray_map_blueocean_underwater.jpg), exactly as the Forest and
--    Red Town each carry a surface and a lower sheet.
--
-- 2. An ARTIFACT equip slot. The original's artifacts (Coral Coin, Squid Tooth,
--    Pearl of Wisdom) were a tenth equipment slot beside the mount. They are
--    worn like any other equipment row — one at a time, stat mods summed by
--    equipment-service.recomputeStatMods — so the only schema change is a new
--    value on the existing slot enum, as MOUNT was.
--
-- 3. `buffGloryClicks`: the click countdown for bathing in the Master Water
--    Temple's glory. Like the capsule counters it stores a duration; the
--    magnitude (+30 to all four core stats) lives in STAT_BUFF_FIELDS. See
--    src/lib/game-engine/services/buff-service.js.
--
-- Purely additive: both columns have defaults and the enum value is unused by
-- existing rows, so nothing needs a backfill.
ALTER TYPE "EquipSlot" ADD VALUE 'ARTIFACT';

ALTER TABLE "User" ADD COLUMN "oceanUnderwaterMap" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "buffGloryClicks" INTEGER NOT NULL DEFAULT 0;
