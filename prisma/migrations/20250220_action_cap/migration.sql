-- Create ActionCap table
CREATE TABLE IF NOT EXISTS "ActionCap" (
    "id" TEXT PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "lastTickNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint to enforce per-player, per-room, per-action
CREATE UNIQUE INDEX IF NOT EXISTS "ActionCap_playerId_roomId_actionKey_key"
ON "ActionCap"("playerId", "roomId", "actionKey");

-- Supporting index for lookups by player and room
CREATE INDEX IF NOT EXISTS "ActionCap_playerId_roomId_idx"
ON "ActionCap"("playerId", "roomId");

-- Foreign key to User table (if User table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
    ALTER TABLE "ActionCap"
    ADD CONSTRAINT "ActionCap_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;
END $$;

