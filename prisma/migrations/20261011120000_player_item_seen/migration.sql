-- Every item slug a player has ever obtained. A battle drop with no row here
-- is marked "new" on the victory card.
CREATE TABLE "PlayerItemSeen" (
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerItemSeen_pkey" PRIMARY KEY ("userId","slug")
);

ALTER TABLE "PlayerItemSeen" ADD CONSTRAINT "PlayerItemSeen_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: nothing a saved player already holds (bag or equipped) is new.
-- Items they once held and used up or sold are not recoverable, so those
-- will read as new the next time they drop.
INSERT INTO "PlayerItemSeen" ("userId", "slug", "firstSeenAt")
SELECT pi."playerId", it."slug", MIN(pi."createdAt")
FROM "PlayerItem" pi
JOIN "ItemTemplate" it ON it."id" = pi."templateId"
GROUP BY pi."playerId", it."slug"
ON CONFLICT DO NOTHING;
