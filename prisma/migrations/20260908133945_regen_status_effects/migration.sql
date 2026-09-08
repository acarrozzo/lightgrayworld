-- AlterTable
ALTER TABLE "User" ADD COLUMN     "buffTeaClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ironSkinAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ironSkinClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "magicArmorAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "poisonClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "poisonImmuneClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "regenerateClicks" INTEGER NOT NULL DEFAULT 0;

-- Item data that goes with the columns, so the world is playable the moment
-- the migration lands (prisma/seed.ts carries the same rows for fresh DBs).

-- Tea is the original's regen trickle again, not a flat potion; coffee runs
-- its original 100 clicks rather than 10.
UPDATE "ItemTemplate"
SET "description" = 'A cup of tea, found under the sea of all places. +5 HP and +5 MP regen every click for 100 clicks.',
    "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb), '{consumable}', '{"verb": "drink", "buff": {"field": "buffTeaClicks", "clicks": 100}}'::jsonb)
WHERE "slug" = 'tea';
UPDATE "ItemTemplate"
SET "description" = 'A cup o'' coffee from the Red Dining Room. +10 to every core stat for 100 clicks.',
    "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb), '{consumable,buff,clicks}', '100'::jsonb)
WHERE "slug" = 'coffee';

-- The antidote potion (Adam's General Store, 500 gold): cures poison and keeps
-- it off for 20 clicks.
INSERT INTO "ItemTemplate" ("id", "slug", "name", "description", "type", "max", "value", "metadata")
VALUES ('antidote-potion_001', 'antidote-potion', 'Antidote Potion',
  'Cures poison on the spot and keeps it off you for 20 clicks. Sold at Adam''s General Store.',
  'CONSUMABLE', 99, 500,
  '{"icon": "antidote", "consumable": {"verb": "drink", "cure": "poison", "buff": {"field": "poisonImmuneClicks", "clicks": 20}}}'::jsonb)
ON CONFLICT ("slug") DO NOTHING;

-- The rest of the regen ring ladder (I, III and V already exist), reached by
-- combining two of a tier at a crafting table.
INSERT INTO "ItemTemplate" ("id", "slug", "name", "description", "type", "max", "value", "equipSlot", "metadata")
VALUES
  ('ring-of-health-regen-ii_001', 'ring-of-health-regen-ii', 'Ring of Health Regen II', 'A second-order regeneration band, two of the tier below hammered into one. Restores 2 HP every click.', 'EQUIPMENT', 999, 8000, 'RING', '{"icon": "ring", "regen": {"hp": 2}}'::jsonb),
  ('ring-of-health-regen-iv_001', 'ring-of-health-regen-iv', 'Ring of Health Regen IV', 'A fourth-order regeneration band, two of the tier below hammered into one. Restores 4 HP every click.', 'EQUIPMENT', 999, 20000, 'RING', '{"icon": "ring", "regen": {"hp": 4}}'::jsonb),
  ('ring-of-health-regen-vi_001', 'ring-of-health-regen-vi', 'Ring of Health Regen VI', 'A sixth-order regeneration band, two of the tier below hammered into one. Restores 6 HP every click.', 'EQUIPMENT', 999, 48000, 'RING', '{"icon": "ring", "regen": {"hp": 6}}'::jsonb),
  ('ring-of-health-regen-vii_001', 'ring-of-health-regen-vii', 'Ring of Health Regen VII', 'A seventh-order regeneration band, two of the tier below hammered into one. Restores 7 HP every click.', 'EQUIPMENT', 999, 64000, 'RING', '{"icon": "ring", "regen": {"hp": 7}}'::jsonb),
  ('ring-of-health-regen-viii_001', 'ring-of-health-regen-viii', 'Ring of Health Regen VIII', 'A eighth-order regeneration band, two of the tier below hammered into one. Restores 8 HP every click.', 'EQUIPMENT', 999, 90000, 'RING', '{"icon": "ring", "regen": {"hp": 8}}'::jsonb),
  ('ring-of-health-regen-ix_001', 'ring-of-health-regen-ix', 'Ring of Health Regen IX', 'A ninth-order regeneration band, two of the tier below hammered into one. Restores 9 HP every click.', 'EQUIPMENT', 999, 120000, 'RING', '{"icon": "ring", "regen": {"hp": 9}}'::jsonb),
  ('ring-of-health-regen-x_001', 'ring-of-health-regen-x', 'Ring of Health Regen X', 'A tenth-order regeneration band, two of the tier below hammered into one. Restores 10 HP every click.', 'EQUIPMENT', 999, 160000, 'RING', '{"icon": "ring", "regen": {"hp": 10}}'::jsonb),
  ('ring-of-mana-regen-ii_001', 'ring-of-mana-regen-ii', 'Ring of Mana Regen II', 'A second-order regeneration band, two of the tier below hammered into one. Restores 2 MP every click.', 'EQUIPMENT', 999, 8000, 'RING', '{"icon": "ring", "regen": {"mp": 2}}'::jsonb),
  ('ring-of-mana-regen-iv_001', 'ring-of-mana-regen-iv', 'Ring of Mana Regen IV', 'A fourth-order regeneration band, two of the tier below hammered into one. Restores 4 MP every click.', 'EQUIPMENT', 999, 20000, 'RING', '{"icon": "ring", "regen": {"mp": 4}}'::jsonb),
  ('ring-of-mana-regen-vi_001', 'ring-of-mana-regen-vi', 'Ring of Mana Regen VI', 'A sixth-order regeneration band, two of the tier below hammered into one. Restores 6 MP every click.', 'EQUIPMENT', 999, 48000, 'RING', '{"icon": "ring", "regen": {"mp": 6}}'::jsonb),
  ('ring-of-mana-regen-vii_001', 'ring-of-mana-regen-vii', 'Ring of Mana Regen VII', 'A seventh-order regeneration band, two of the tier below hammered into one. Restores 7 MP every click.', 'EQUIPMENT', 999, 64000, 'RING', '{"icon": "ring", "regen": {"mp": 7}}'::jsonb),
  ('ring-of-mana-regen-viii_001', 'ring-of-mana-regen-viii', 'Ring of Mana Regen VIII', 'A eighth-order regeneration band, two of the tier below hammered into one. Restores 8 MP every click.', 'EQUIPMENT', 999, 90000, 'RING', '{"icon": "ring", "regen": {"mp": 8}}'::jsonb),
  ('ring-of-mana-regen-ix_001', 'ring-of-mana-regen-ix', 'Ring of Mana Regen IX', 'A ninth-order regeneration band, two of the tier below hammered into one. Restores 9 MP every click.', 'EQUIPMENT', 999, 120000, 'RING', '{"icon": "ring", "regen": {"mp": 9}}'::jsonb),
  ('ring-of-mana-regen-x_001', 'ring-of-mana-regen-x', 'Ring of Mana Regen X', 'A tenth-order regeneration band, two of the tier below hammered into one. Restores 10 MP every click.', 'EQUIPMENT', 999, 160000, 'RING', '{"icon": "ring", "regen": {"mp": 10}}'::jsonb)
ON CONFLICT ("slug") DO NOTHING;
