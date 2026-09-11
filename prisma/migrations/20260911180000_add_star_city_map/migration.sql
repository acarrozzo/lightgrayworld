-- Star City: `starCityMap`, the found flag for lightgray_map_starcity.jpg.
-- Only Camp Hero (701) stands on it — the one room the original built there.
-- Its own migration because the Mountains migration had already been applied
-- when Camp Hero was added.
ALTER TABLE "User" ADD COLUMN "starCityMap" BOOLEAN NOT NULL DEFAULT false;
