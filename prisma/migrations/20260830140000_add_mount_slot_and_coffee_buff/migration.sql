-- Red Town Stables + the Red Dining Room's coffee.
--
-- 1. A MOUNT equip slot. Mounts are worn like any other equipment row — one at a
--    time, stat mods summed by equipment-service.recomputeStatMods — so the only
--    schema change they need is a new value on the existing slot enum.
--
-- 2. `buffCoffeeClicks`: the click countdown for a cup of coffee. Like the
--    reds/greens/blues/yellows counters it stores a duration, not a magnitude —
--    but unlike those it boosts all four core stats at once, and by +10 rather
--    than +20. Both facts now live in STAT_BUFF_FIELDS rather than a shared
--    constant. See src/lib/game-engine/services/buff-service.js.
--
-- Purely additive: the new column has a default and the new enum value is unused
-- by existing rows, so nothing needs a backfill.
ALTER TYPE "EquipSlot" ADD VALUE 'MOUNT';

ALTER TABLE "User" ADD COLUMN "buffCoffeeClicks" INTEGER NOT NULL DEFAULT 0;
