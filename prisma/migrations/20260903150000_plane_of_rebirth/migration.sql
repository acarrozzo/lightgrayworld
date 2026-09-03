-- The Lobby (room 999) is where the dead wake, so it is named for it. Ids stay:
-- roomId 999, region 'lobby', the lobbyMap flag and the --world-lobby colour.
UPDATE "Room"
SET "name" = 'Plane of Rebirth',
    "subtitle" = 'Where the fallen wake',
    "description" = 'You find yourself in the center of a floating platform high in the sky bathed in sunlight. You are surrounded by a massive ring of pillars. The ground is a smooth, polished surface of white marble, and a fountain murmurs at the centre of the ring. The fallen wake beside it, and a rest there mends more than it should.'
WHERE "roomId" = '999';
