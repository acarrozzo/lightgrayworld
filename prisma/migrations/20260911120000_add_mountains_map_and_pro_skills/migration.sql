-- The Mountains (legacy r600/), the last of the original's four "Savior" lands.
--
-- 1. `mountainsMap`: the found flag for lightgray_map_mountains.jpg, one sheet
--    for the whole region (the Cathedral is drawn on it too).
--
-- 2. The Master Trainer's three "Pro" proficiencies. The original's
--    skills-spells-calculator taught One Handed Pro, Two Handed Pro and Ranged
--    Pro at the Master Trainer (610) once the matching base skill reached 20:
--    each level multiplied the gear-side STR (or DEX) by +5%, for 5 SP a level.
--    They had no columns here because their only teacher was not ported.
--
-- Purely additive: every column has a default, so nothing needs a backfill.
ALTER TABLE "User" ADD COLUMN "mountainsMap" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "oneHandedPro" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "twoHandedPro" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "rangedPro" INTEGER NOT NULL DEFAULT 0;
