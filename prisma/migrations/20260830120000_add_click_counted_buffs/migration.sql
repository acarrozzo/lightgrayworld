-- Click-counted stat buffs (reds / greens / blues / yellows).
--
-- Each column stores the number of remaining clicks on that buff, decremented
-- once per counted action alongside the existing `wings` / `gills` counters.
-- The bonus itself is a constant (+20) applied where the stat is consumed, so
-- these columns are durations, not magnitudes. See
-- src/lib/game-engine/services/buff-service.js.
--
-- Purely additive: every column has a default, so existing rows need no backfill.
ALTER TABLE "User" ADD COLUMN "buffStrClicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "buffDexClicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "buffMagClicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "buffDefClicks" INTEGER NOT NULL DEFAULT 0;
