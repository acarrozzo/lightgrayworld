-- Boss rest timers: when each player last killed each enemy. A ranked enemy
-- with a lair rests from this moment (src/lib/game-data/boss-rest.js).
ALTER TABLE "KillList" ADD COLUMN "lastKilledAt" TIMESTAMP(3);
