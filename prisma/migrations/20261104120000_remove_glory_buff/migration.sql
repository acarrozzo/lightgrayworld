-- Bathe in Glory is gone from the Master Water Temple (425). The room keeps a
-- plain +100 rest ("rest at the temple"); the +20-all-stats Glory countdown
-- that the bath also started has no other source, so its column goes with it.
--
-- Any player mid-Glory loses the remaining clicks. Nothing else references
-- the column: the magnitude lived in STAT_BUFF_FIELDS (buff-service.js), which
-- no longer lists it, and the client's buff mirrors read the same list.
ALTER TABLE "User" DROP COLUMN "buffGloryClicks";
