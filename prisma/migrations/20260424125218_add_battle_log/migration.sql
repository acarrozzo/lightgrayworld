-- CreateTable
CREATE TABLE "BattleLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enemySlug" TEXT NOT NULL,
    "enemyName" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "turnsCount" INTEGER NOT NULL,
    "totalDamageDealt" INTEGER NOT NULL,
    "totalDamageReceived" INTEGER NOT NULL,
    "maxSingleHit" INTEGER NOT NULL,
    "xpEarned" INTEGER NOT NULL,
    "goldEarned" INTEGER NOT NULL,
    "itemsDropped" JSONB NOT NULL DEFAULT '[]',
    "multiplayerBonus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BattleLog_userId_createdAt_idx" ON "BattleLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BattleLog" ADD CONSTRAINT "BattleLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
