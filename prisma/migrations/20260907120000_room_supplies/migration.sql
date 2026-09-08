-- Room supplies: what a room hands a player for free is per player again
-- (config/room-supplies.js), as in the original. RoomItem rows are only what
-- players drop from now on, so the seeded piles go, along with the respawn
-- columns nothing read.

-- 1. The seeded, auto-respawning piles (the ring bowl in 027, the racks, the
--    pantries). Player drops were never flagged and stay.
DELETE FROM "RoomItem" WHERE "autoRespawn" = true;

ALTER TABLE "RoomItem" DROP COLUMN "maxQuantity";
ALTER TABLE "RoomItem" DROP COLUMN "respawnSeconds";
ALTER TABLE "RoomItem" DROP COLUMN "autoRespawn";

-- 2. A dropped pile remembers who left it, for the "left by" rail.
ALTER TABLE "RoomItem" ADD COLUMN "droppedByName" TEXT;

-- 3. Bag caps. The room's own line ("one each", "up to 50") now lives in the
--    supply config, so ItemTemplate.max is purely how much a bag holds:
--    tools 99, everything that was effectively uncapped 999, training gear
--    stays at 1, mounts and companions stay at 1.
UPDATE "ItemTemplate" SET "max" = 999 WHERE "max" = 99999;
UPDATE "ItemTemplate" SET "max" = 99 WHERE "slug" IN (
  'shovel', 'hatchet', 'iron-hatchet', 'mithril-hatchet',
  'hammer', 'iron-hammer', 'steel-hammer', 'mithril-hammer',
  'pickaxe', 'iron-pickaxe', 'steel-pickaxe', 'mithril-pickaxe'
);
UPDATE "ItemTemplate" SET "max" = 999 WHERE "slug" IN ('bo', 'grotto-gloves');
