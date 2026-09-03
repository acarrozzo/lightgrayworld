-- Fast-travel discovery.
--
-- `User.discoveredTeleports` lists the world regions (by id, see
-- src/lib/game-data/world-map.js) whose fast-travel hub the player has stood
-- in. The original gated every teleport square behind reaching it first
-- ("Not found yet"); the modern network had been open to everyone. The VIP
-- rooms (Lobby, Room Zero, Solar Office) never need discovery and are not
-- recorded here.
--
-- Additive. Existing players are grandfathered from the evidence the row
-- already holds — the map flags that were set on arrival, and the room they
-- are standing in — so nobody loses a hub they have plainly already reached.
-- The same evidence backfills the map "found" flags that the arrival unlock
-- never wrote for the surface sheets, since the Map view now only offers
-- sheets a player has found.

ALTER TABLE "User" ADD COLUMN "discoveredTeleports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Everyone starts in Room Zero and walks out into the Grassy Field.
UPDATE "User" SET "roomZeroMap" = true, "grassyFieldMap" = true;

-- Reaching anything past the field means the Forest was crossed.
UPDATE "User" SET "forestMap" = true
  WHERE "forestMap" = false AND (
    "forestUndergroundMap" OR "redTownMap" OR "redTownSewersMap"
    OR "rockyFlatsMap" OR "rockyFlatsUndergroundMap" OR "neverEndingMineMap"
    OR "currentRoom" LIKE '1%' OR "currentRoom" LIKE '2%' OR "currentRoom" LIKE '3%'
  );

-- The Rocky Flats are entered from Red Town.
UPDATE "User" SET "redTownMap" = true
  WHERE "redTownMap" = false AND (
    "redTownSewersMap" OR "rockyFlatsMap" OR "rockyFlatsUndergroundMap" OR "neverEndingMineMap"
    OR "currentRoom" LIKE '2%' OR "currentRoom" LIKE '3%'
  );

UPDATE "User" SET "rockyFlatsMap" = true
  WHERE "rockyFlatsMap" = false AND (
    "rockyFlatsUndergroundMap" OR "neverEndingMineMap" OR "currentRoom" LIKE '3%'
  );

-- Fast travel follows the (now backfilled) sheets.
UPDATE "User" SET "discoveredTeleports" = ARRAY['grassy-field']::TEXT[];
UPDATE "User" SET "discoveredTeleports" = array_append("discoveredTeleports", 'forest') WHERE "forestMap";
UPDATE "User" SET "discoveredTeleports" = array_append("discoveredTeleports", 'red-town') WHERE "redTownMap";
UPDATE "User" SET "discoveredTeleports" = array_append("discoveredTeleports", 'rocky-flats') WHERE "rockyFlatsMap";
