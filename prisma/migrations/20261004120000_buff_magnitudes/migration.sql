-- Buff magnitudes changed with the one-consumable-buff rule: capsules +20 -> +30,
-- tea +5/+5 -> +10/+10. The numbers live in code (buff-service.js, regen.js);
-- this only brings the item descriptions players read into line with them.
UPDATE "ItemTemplate" SET "description" = 'A fistful of red capsules. +30 STR for 100 clicks.' WHERE "slug" = 'reds';
UPDATE "ItemTemplate" SET "description" = 'A fistful of green capsules. +30 DEX for 100 clicks.' WHERE "slug" = 'greens';
UPDATE "ItemTemplate" SET "description" = 'A fistful of blue capsules. +30 MAG for 100 clicks.' WHERE "slug" = 'blues';
UPDATE "ItemTemplate" SET "description" = 'A fistful of yellow capsules. +30 DEF for 100 clicks.' WHERE "slug" = 'yellows';
UPDATE "ItemTemplate" SET "description" = 'A cup of tea, found under the sea of all places. +10 HP and +10 MP regen every click for 100 clicks.' WHERE "slug" = 'tea';
