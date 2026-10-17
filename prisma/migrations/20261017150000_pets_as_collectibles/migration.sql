-- Pets come back as collectibles (2026-10-17), the other way round from the
-- companions that left this morning: a pet is a story you carry, never a
-- number. It cannot swing, block, carry, find or buff. It is seen beside your
-- name, remembered in the bag, and it talks now and then in the feed.
--
-- A pet is an ordinary bag item marked by `metadata.pet`, granted by its
-- source like any reward (Little Suzie's quest, the Dwarf Treasury chest).
-- The one pet "along" at a time is the slug in `User.activePet`, set from the
-- bag and cleared from it, free of any turn. The Baby Owl waits for a later
-- pass by design.

ALTER TABLE "User" ADD COLUMN "activePet" TEXT;

INSERT INTO "ItemTemplate" ("id", "slug", "name", "description", "type", "max", "value", "canSell", "canDrop", "metadata")
VALUES
  ('pet-hampster_001', 'pet-hampster', 'Pet Hampster',
   'Little Suzie''s hamster, spelled the way she spells it. It decided it liked your pocket better than her shoebox. A PET: company, nothing more.',
   'MISC', 1, 0, false, false,
   '{"icon": "enemy-Rat", "pet": true}'::jsonb),
  ('pet-bat_001', 'pet-bat', 'Pet Bat',
   'It was living in the Dwarf Treasury gold chest, which explains the state of the gold. It hangs off your pack and resents the daytime. A PET: company, nothing more.',
   'MISC', 1, 0, false, false,
   '{"icon": "enemy-Bat", "pet": true}'::jsonb)
ON CONFLICT ("slug") DO NOTHING;
