-- Companions come out of the game (design decision, 2026-10-17).
--
-- The original's companions (Dwarf Axeman, Elf Ranger; Ogre Shieldmate and
-- Snow Berserker were granted but never swung) were a slot beside the mount
-- that rolled its own small hit on every attack turn. In play that was a flat
-- 3–9% of a fight that scaled with nothing and asked nothing of the player, so
-- the slot goes. The Baby Owl, which the original half-wrote as a pet, goes
-- with it; pets may return later as collectibles with no roll.
--
-- The three quests that paid out a companion now pay out gear (Hardwood Bow,
-- Hardwood Shield, Steel Orb), and the Snow Owl's Baby Owl drop share becomes
-- Mithril Gloves. Rows that held a companion are simply removed: nobody but the
-- owner has played, and that was the owner's call.

-- 1. The four companion templates and every row that points at one.
DELETE FROM "PlayerItem"
WHERE "templateId" IN (SELECT "id" FROM "ItemTemplate" WHERE "equipSlot" = 'COMPANION');

DELETE FROM "RoomItem"
WHERE "templateId" IN (SELECT "id" FROM "ItemTemplate" WHERE "equipSlot" = 'COMPANION');

DELETE FROM "PlayerItemSeen"
WHERE "slug" IN ('elf-ranger', 'ogre-shieldmate', 'snow-berserker', 'baby-owl');

DELETE FROM "ItemTemplate" WHERE "equipSlot" = 'COMPANION';

-- 2. The enum value. Postgres cannot drop a value from an enum in place, so
--    the type is rebuilt without it and the one column that uses it is cast
--    across. Nothing references 'COMPANION' any more after step 1.
ALTER TYPE "EquipSlot" RENAME TO "EquipSlot_old";
CREATE TYPE "EquipSlot" AS ENUM ('MAIN_HAND', 'OFF_HAND', 'HEAD', 'BODY', 'HANDS', 'FEET', 'RING', 'NECK', 'MOUNT', 'ARTIFACT');
ALTER TABLE "ItemTemplate"
  ALTER COLUMN "equipSlot" TYPE "EquipSlot" USING ("equipSlot"::text::"EquipSlot");
DROP TYPE "EquipSlot_old";

-- 3. The legacy string slot on Equipment, never written by the modern game.
ALTER TABLE "Equipment" DROP COLUMN "companion";

-- 4. The replacement rewards. The seed carries the same rows; this keeps a
--    migrated database playable without a reseed.
INSERT INTO "ItemTemplate" ("id", "slug", "name", "description", "type", "max", "value", "equipSlot", "weaponCategory", "metadata")
VALUES
  ('hardwood-bow_001', 'hardwood-bow', 'Hardwood Bow',
   'Lego''s own bow, cut from a Dark Forest hardwood and strung tight. Heavy for a bow, and the stave takes a blow. +60 DEX, +30 DEF.',
   'WEAPON', 999, 100000, 'MAIN_HAND', 'RANGED',
   '{"icon": "equipment-longbow", "ammo": "arrow", "isTwoHanded": true, "statMods": {"dex": 60, "def": 30}}'::jsonb)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "ItemTemplate" ("id", "slug", "name", "description", "type", "max", "value", "equipSlot", "metadata")
VALUES
  ('hardwood-shield_001', 'hardwood-shield', 'Hardwood Shield',
   'The shield off the Base Camp mess tent wall, mountain hardwood banded in iron. +80 DEF, +10 MAG.',
   'EQUIPMENT', 999, 50000, 'OFF_HAND',
   '{"icon": "kite-shield", "statMods": {"def": 80, "mag": 10}}'::jsonb),
  ('steel-orb_001', 'steel-orb', 'Steel Orb',
   'A polished steel sphere out of Chilly Pete''s coat, cold enough to sting. Held in the off hand: +20 STR, +20 DEX, +20 MAG.',
   'EQUIPMENT', 999, 50000, 'OFF_HAND',
   '{"icon": "magic", "statMods": {"str": 20, "dex": 20, "mag": 20}}'::jsonb)
ON CONFLICT ("slug") DO NOTHING;

-- 5. The Greenhorn Bow's restat (+50 DEX, +10 MAG; was +50 DEX, +25 DEF).
UPDATE "ItemTemplate"
SET "description" = 'The Ranger''s Guild''s initiation bow, sleek and powerful, and every new Ranger''s first. +50 DEX, +10 MAG.',
    "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb), '{statMods}', '{"dex": 50, "mag": 10}'::jsonb)
WHERE "slug" = 'greenhorn-bow';
