-- Wheat and bread come out of the game (design decision, 2026-10-30).
--
-- Neither was ever in the original. Wheat was a "Pick Wheat" gather added to
-- Healing Springs (020), which in the original is a rest stop and nothing
-- else, and bread was a two-wheat recipe at the fire. Wendell's cart sold
-- bread too; it now just doesn't. Rows that held either are simply removed:
-- nobody but the owner has played, and that was the owner's call.

-- 1. Every row that points at either template, then the templates.
DELETE FROM "PlayerItem"
WHERE "templateId" IN (SELECT "id" FROM "ItemTemplate" WHERE "slug" IN ('wheat', 'bread'));

DELETE FROM "RoomItem"
WHERE "templateId" IN (SELECT "id" FROM "ItemTemplate" WHERE "slug" IN ('wheat', 'bread'));

DELETE FROM "PlayerItemSeen" WHERE "slug" IN ('wheat', 'bread');

DELETE FROM "ItemTemplate" WHERE "slug" IN ('wheat', 'bread');

-- 2. The Pick Wheat cooldowns, keyed by the action name.
DELETE FROM "ActionCap" WHERE "actionKey" = 'pick wheat';
