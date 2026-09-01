-- CreateIndex
CREATE INDEX "PlayerItem_playerId_idx" ON "PlayerItem"("playerId");
-- CreateIndex
CREATE UNIQUE INDEX "PlayerItem_playerId_templateId_key" ON "PlayerItem"("playerId", "templateId");
