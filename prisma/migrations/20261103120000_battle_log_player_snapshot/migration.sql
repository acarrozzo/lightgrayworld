-- The player as the fight began, on every Battle Log row: level and XP as
-- columns (the bestiary's "First to fell" board orders wins by them), the rest
-- as JSON for the replay header. Older rows stay null and sit out the board.
-- AlterTable
ALTER TABLE "BattleLog" ADD COLUMN "playerLevel" INTEGER,
ADD COLUMN "playerXp" INTEGER,
ADD COLUMN "snapshot" JSONB;

-- CreateIndex
CREATE INDEX "BattleLog_enemySlug_outcome_playerLevel_playerXp_idx" ON "BattleLog"("enemySlug", "outcome", "playerLevel", "playerXp");
