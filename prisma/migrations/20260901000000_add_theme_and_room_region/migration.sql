-- Terminal colour themes.
--
-- `User.theme` is the account-level memory of the player's selected theme, so
-- the choice follows them to another browser. Local storage still carries the
-- device-level copy, which is what the login screen and the pre-paint bootstrap
-- read before anyone has authenticated.
--
-- `Room.region` gives every room a world region, which is what the theme layer
-- colours against. It is seeded from `getRegionForRoom()` in
-- src/lib/theme/regions.ts; the backfill below reproduces that function's rules
-- in SQL so existing rows are correct immediately rather than after a reseed.
--
-- Purely additive. Both columns have defaults, and the existing nameColor /
-- subtitleColor / iconColor / directionColors values are migrated in place by
-- the same statement set rather than dropped — see the token rewrite at the end.
ALTER TABLE "User" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'light-gray';

ALTER TABLE "Room" ADD COLUMN "region" TEXT NOT NULL DEFAULT 'grassyField';

-- Region backfill. Order matters: the explicit room sets are applied before the
-- id-prefix fallbacks, exactly as the TypeScript does.
UPDATE "Room" SET "region" = 'roomZero'   WHERE "roomId" = '000';
UPDATE "Room" SET "region" = 'lobby'      WHERE "roomId" = '999';
UPDATE "Room" SET "region" = 'solarOffice' WHERE "roomId" = '088';

UPDATE "Room" SET "region" = 'beach'
  WHERE "roomId" IN ('015', '016', '017', '018', '019');

UPDATE "Room" SET "region" = 'caves'
  WHERE "roomId" IN ('008', '009', '010', '011',
                     '028', '028b', '028c', '028d', '028e', '028f', '028g', '028h', '028i');

UPDATE "Room" SET "region" = 'scorpionPit'
  WHERE "roomId" IN ('012b', '012c', '012d', '012e', '012f', '012g', '012h');

UPDATE "Room" SET "region" = 'grassyFieldUnderground'
  WHERE "roomId" IN ('003b', '003bb');

UPDATE "Room" SET "region" = 'forestUnderground'
  WHERE "roomId" IN ('111a', '111b', '111c', '111d', '111e', '111f', '111g', '111h', '111i', '111j', '111k',
                     '115a', '115b', '115c', '115d', '115e', '115f', '115g', '115h', '115i', '115j', '115k');

UPDATE "Room" SET "region" = 'redTownSewers'
  WHERE "roomId" IN ('232a', '232b', '232c', '232d', '232e', '232f', '232g', '232h', '232i', '232j',
                     '232k', '232l', '232m', '232n', '232o', '232p', '232q', '232r', '232s', '232t',
                     '232u', '232v', '232w', '232x', '232y', '232z');

UPDATE "Room" SET "region" = 'rockyFlatsUnderground'
  WHERE "roomId" IN ('315a', '315b', '315c', '315d', '321b', '311-00');

UPDATE "Room" SET "region" = 'neverendingMine'
  WHERE "roomId" LIKE '311-%' AND "roomId" <> '311-00';

-- The Red Guard Captain's lookout tower carries a Red Town id but stands in the
-- forest, and reads as forest.
UPDATE "Room" SET "region" = 'forest' WHERE "roomId" = '215';

-- Prefix fallbacks, applied only where nothing more specific has claimed the row.
UPDATE "Room" SET "region" = 'rockyFlats'
  WHERE "region" = 'grassyField' AND "roomId" LIKE '3%';
UPDATE "Room" SET "region" = 'redTown'
  WHERE "region" = 'grassyField' AND "roomId" LIKE '2%';
UPDATE "Room" SET "region" = 'forest'
  WHERE "region" = 'grassyField' AND "roomId" LIKE '1%';

-- ---------------------------------------------------------------------
-- Room colour tokens.
--
-- The four override columns held raw Tailwind fragments that components
-- interpolated into class names. They now hold semantic tokens resolved to
-- CSS variables (see src/lib/theme/room-colors.ts).
--
-- Two things were tangled in the old values. Meaning: `forest`, `grass`,
-- `dirt` and `sand` were already semantic, while `red-*` meant danger (a
-- bloody path, a fire altar, a scorpion pit) rather than Red Town. Slot: the
-- shade tracked which field the value sat in, not what it meant — one room
-- would carry nameColor red-500, subtitleColor red-800 and iconColor red-600,
-- three shades of a single idea. The theme derives that ramp per slot now, so
-- the shades collapse onto one token.
--
-- Greys are the exception that needs slot awareness: a grey room *name* is
-- plain text, a grey room *icon* is stone.
--
-- Generated from legacyRoomColorToken() so this and prisma/seed.ts cannot
-- drift. Rows already holding tokens are untouched by every statement.
-- ---------------------------------------------------------------------
-- nameColor
UPDATE "Room" SET "nameColor" = 'mood.arcane' WHERE "nameColor" IN ('purple-400', 'purple-500', 'purple-600', 'violet-400', 'violet-500', 'pink-400');
UPDATE "Room" SET "nameColor" = 'mood.calm' WHERE "nameColor" IN ('blue-300', 'blue-400', 'blue-500', 'blue-600', 'blue-700', 'blue-800', 'blue-900', 'sky-400', 'sky-500');
UPDATE "Room" SET "nameColor" = 'mood.danger' WHERE "nameColor" IN ('red-200', 'red-300', 'red-400', 'red-500', 'red-600', 'red-700', 'red-800', 'red-900', 'orange-500', 'orange-600');
UPDATE "Room" SET "nameColor" = 'mood.treasure' WHERE "nameColor" IN ('yellow-300', 'yellow-400', 'yellow-500', 'yellow-600', 'yellow-700', 'amber-400', 'amber-500', 'amber-600');
UPDATE "Room" SET "nameColor" = 'terrain.dirt' WHERE "nameColor" IN ('dirt');
UPDATE "Room" SET "nameColor" = 'terrain.forest' WHERE "nameColor" IN ('forest', 'green-600', 'green-700');
UPDATE "Room" SET "nameColor" = 'terrain.grass' WHERE "nameColor" IN ('grass', 'green-300', 'green-400', 'green-500');
UPDATE "Room" SET "nameColor" = 'terrain.sand' WHERE "nameColor" IN ('sand');
UPDATE "Room" SET "nameColor" = 'text.bright' WHERE "nameColor" IN ('white', 'gray-100', 'gray-200', 'neutral-200');
UPDATE "Room" SET "nameColor" = 'text.muted' WHERE "nameColor" IN ('gray-700');
UPDATE "Room" SET "nameColor" = 'text.primary' WHERE "nameColor" IN ('gray-300', 'gray-400', 'neutral-400');
UPDATE "Room" SET "nameColor" = 'text.secondary' WHERE "nameColor" IN ('gray-500', 'gray-600');

-- subtitleColor
UPDATE "Room" SET "subtitleColor" = 'mood.arcane' WHERE "subtitleColor" IN ('purple-400', 'purple-500', 'purple-600', 'violet-400', 'violet-500', 'pink-400');
UPDATE "Room" SET "subtitleColor" = 'mood.calm' WHERE "subtitleColor" IN ('blue-300', 'blue-400', 'blue-500', 'blue-600', 'blue-700', 'blue-800', 'blue-900', 'sky-400', 'sky-500');
UPDATE "Room" SET "subtitleColor" = 'mood.danger' WHERE "subtitleColor" IN ('red-200', 'red-300', 'red-400', 'red-500', 'red-600', 'red-700', 'red-800', 'red-900', 'orange-500', 'orange-600');
UPDATE "Room" SET "subtitleColor" = 'mood.treasure' WHERE "subtitleColor" IN ('yellow-300', 'yellow-400', 'yellow-500', 'yellow-600', 'yellow-700', 'amber-400', 'amber-500', 'amber-600');
UPDATE "Room" SET "subtitleColor" = 'terrain.dirt' WHERE "subtitleColor" IN ('dirt');
UPDATE "Room" SET "subtitleColor" = 'terrain.forest' WHERE "subtitleColor" IN ('forest', 'green-600', 'green-700');
UPDATE "Room" SET "subtitleColor" = 'terrain.grass' WHERE "subtitleColor" IN ('grass', 'green-300', 'green-400', 'green-500');
UPDATE "Room" SET "subtitleColor" = 'terrain.sand' WHERE "subtitleColor" IN ('sand');
UPDATE "Room" SET "subtitleColor" = 'text.muted' WHERE "subtitleColor" IN ('gray-400', 'gray-500', 'gray-600', 'gray-700', 'neutral-400');
UPDATE "Room" SET "subtitleColor" = 'text.primary' WHERE "subtitleColor" IN ('white');
UPDATE "Room" SET "subtitleColor" = 'text.secondary' WHERE "subtitleColor" IN ('gray-100', 'gray-200', 'gray-300', 'neutral-200');

-- iconColor
UPDATE "Room" SET "iconColor" = 'mood.arcane' WHERE "iconColor" IN ('purple-400', 'purple-500', 'purple-600', 'violet-400', 'violet-500', 'pink-400');
UPDATE "Room" SET "iconColor" = 'mood.calm' WHERE "iconColor" IN ('blue-300', 'blue-400', 'blue-500', 'blue-600', 'blue-700', 'blue-800', 'blue-900', 'sky-400', 'sky-500');
UPDATE "Room" SET "iconColor" = 'mood.danger' WHERE "iconColor" IN ('red-200', 'red-300', 'red-400', 'red-500', 'red-600', 'red-700', 'red-800', 'red-900', 'orange-500', 'orange-600');
UPDATE "Room" SET "iconColor" = 'mood.treasure' WHERE "iconColor" IN ('yellow-300', 'yellow-400', 'yellow-500', 'yellow-600', 'yellow-700', 'amber-400', 'amber-500', 'amber-600');
UPDATE "Room" SET "iconColor" = 'terrain.ash' WHERE "iconColor" IN ('gray-600', 'gray-700');
UPDATE "Room" SET "iconColor" = 'terrain.bone' WHERE "iconColor" IN ('gray-100', 'gray-200', 'neutral-200');
UPDATE "Room" SET "iconColor" = 'terrain.dirt' WHERE "iconColor" IN ('dirt');
UPDATE "Room" SET "iconColor" = 'terrain.forest' WHERE "iconColor" IN ('forest', 'green-600', 'green-700');
UPDATE "Room" SET "iconColor" = 'terrain.grass' WHERE "iconColor" IN ('grass', 'green-300', 'green-400', 'green-500');
UPDATE "Room" SET "iconColor" = 'terrain.sand' WHERE "iconColor" IN ('sand');
UPDATE "Room" SET "iconColor" = 'terrain.stone' WHERE "iconColor" IN ('gray-300', 'gray-400', 'gray-500', 'neutral-400');
UPDATE "Room" SET "iconColor" = 'text.bright' WHERE "iconColor" IN ('white');

-- directionColors (JSON): rewrite each legacy value in place
UPDATE "Room" SET "directionColors" =
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  "directionColors"::text,
    '"grass"', '"terrain.grass"'),
    '"forest"', '"terrain.forest"'),
    '"dirt"', '"terrain.dirt"'),
    '"sand"', '"terrain.sand"'),
    '"white"', '"text.bright"'),
    '"gray-100"', '"terrain.bone"'),
    '"gray-200"', '"terrain.bone"'),
    '"gray-300"', '"terrain.stone"'),
    '"gray-400"', '"terrain.stone"'),
    '"gray-500"', '"terrain.stone"'),
    '"gray-600"', '"terrain.ash"'),
    '"gray-700"', '"terrain.ash"'),
    '"neutral-200"', '"terrain.bone"'),
    '"neutral-400"', '"terrain.stone"'),
    '"red-200"', '"mood.danger"'),
    '"red-300"', '"mood.danger"'),
    '"red-400"', '"mood.danger"'),
    '"red-500"', '"mood.danger"'),
    '"red-600"', '"mood.danger"'),
    '"red-700"', '"mood.danger"'),
    '"red-800"', '"mood.danger"'),
    '"red-900"', '"mood.danger"'),
    '"orange-500"', '"mood.danger"'),
    '"orange-600"', '"mood.danger"'),
    '"yellow-300"', '"mood.treasure"'),
    '"yellow-400"', '"mood.treasure"'),
    '"yellow-500"', '"mood.treasure"'),
    '"yellow-600"', '"mood.treasure"'),
    '"yellow-700"', '"mood.treasure"'),
    '"amber-400"', '"mood.treasure"'),
    '"amber-500"', '"mood.treasure"'),
    '"amber-600"', '"mood.treasure"'),
    '"green-300"', '"terrain.grass"'),
    '"green-400"', '"terrain.grass"'),
    '"green-500"', '"terrain.grass"'),
    '"green-600"', '"terrain.forest"'),
    '"green-700"', '"terrain.forest"'),
    '"blue-300"', '"mood.calm"'),
    '"blue-400"', '"mood.calm"'),
    '"blue-500"', '"mood.calm"'),
    '"blue-600"', '"mood.calm"'),
    '"blue-700"', '"mood.calm"'),
    '"blue-800"', '"mood.calm"'),
    '"blue-900"', '"mood.calm"'),
    '"sky-400"', '"mood.calm"'),
    '"sky-500"', '"mood.calm"'),
    '"purple-400"', '"mood.arcane"'),
    '"purple-500"', '"mood.arcane"'),
    '"purple-600"', '"mood.arcane"'),
    '"violet-400"', '"mood.arcane"'),
    '"violet-500"', '"mood.arcane"'),
    '"pink-400"', '"mood.arcane"')::jsonb
WHERE "directionColors" IS NOT NULL;
