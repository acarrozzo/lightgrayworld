-- One enemy per room per player: the persisted roster array becomes a single slug.
-- Backfill from the front of each array (the enemy fought first); rows with an
-- empty array meant nothing present and are removed.
ALTER TABLE "PlayerRoomEnemy" ADD COLUMN "enemySlug" TEXT;
UPDATE "PlayerRoomEnemy" SET "enemySlug" = "enemySlugs"[1];
DELETE FROM "PlayerRoomEnemy" WHERE "enemySlug" IS NULL;
ALTER TABLE "PlayerRoomEnemy" ALTER COLUMN "enemySlug" SET NOT NULL;
ALTER TABLE "PlayerRoomEnemy" DROP COLUMN "enemySlugs";
