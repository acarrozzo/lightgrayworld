-- Wings / Gills: the spell level and the running click countdown shared one
-- column, so SP spent on the (uncast-able) spell became a few clicks of
-- flight and then ticked away. The levels move to their own columns; `wings`
-- and `gills` stay the countdowns every gate and combat read. Any non-zero
-- value already there was only ever used as a countdown, so nothing is copied.
ALTER TABLE "User" ADD COLUMN "wingsSpell" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "gillsSpell" INTEGER NOT NULL DEFAULT 0;

-- The Despair: standing before the Forest Princess (525) once opens the way
-- down from 524 for good (the original's per-login `enterdespair`).
ALTER TABLE "User" ADD COLUMN "forestPrincessFlag" BOOLEAN NOT NULL DEFAULT false;

-- The Despair's map sheet (lightgray_map_the_despair.jpg), found on arrival
-- like every other sheet.
ALTER TABLE "User" ADD COLUMN "despairMap" BOOLEAN NOT NULL DEFAULT false;
