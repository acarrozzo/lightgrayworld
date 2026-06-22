-- Consolidate ItemTemplate.maxStack and ItemTemplate.maxPerPlayer into a single `max` cap.
-- The effective cap was always `maxPerPlayer ?? maxStack`, so backfill preserves behavior exactly.

ALTER TABLE "ItemTemplate" ADD COLUMN "max" INTEGER NOT NULL DEFAULT 99;

UPDATE "ItemTemplate" SET "max" = COALESCE("maxPerPlayer", "maxStack");

ALTER TABLE "ItemTemplate" DROP COLUMN "maxStack";
ALTER TABLE "ItemTemplate" DROP COLUMN "maxPerPlayer";
