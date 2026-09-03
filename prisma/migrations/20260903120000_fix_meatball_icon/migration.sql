-- The Meatball template wore the steak icon (and the crafting card copied it).
-- The crafting sheet now reads icons from the template, so fix the row itself.
UPDATE "ItemTemplate"
SET "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb), '{icon}', '"meatball"')
WHERE "slug" = 'meatball';
