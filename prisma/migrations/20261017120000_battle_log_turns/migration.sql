-- The fight's ledger beside its summary: one compact row per turn, as the
-- engine resolved it. Older rows have none and read as "No turn record".
-- A retreat now writes a row too, outcome 'FLED' (the column is already TEXT).
ALTER TABLE "BattleLog" ADD COLUMN "turns" JSONB NOT NULL DEFAULT '[]';
