class RoomState {
  constructor(roomId) {
    this.roomId = roomId;

    this.intents = [];
    this.facts = [];
    this.factSeq = 0;

    this.players = new Map();
    this.npcs = new Map();
  }

  addPlayer(playerState) {
    this.players.set(playerState.id, playerState);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  updatePlayer(playerId, updater) {
    const player = this.players.get(playerId);
    if (!player) return;
    const updated = updater({ ...player });
    this.players.set(playerId, updated);
  }

  getPlayerIds() {
    return Array.from(this.players.keys());
  }

  queueIntent(intent) {
    this.intents.push(intent);
  }

  processIntents(currentTick) {
    const { ready, pending } = this.partitionIntents(currentTick);
    this.replaceIntents(pending);

    const deduped = this.deduplicateIntents(ready);
    const ordered = this.orderIntents(deduped);

    const producedFacts = [];

    for (const intent of ordered) {
      const facts = this.resolveIntent(intent, currentTick);
      if (facts.length > 0) {
        facts.forEach((fact) => this.recordFact(fact));
        producedFacts.push(...facts);
      }
    }

    return producedFacts;
  }

  getFactsSince(seq) {
    return this.facts.filter((fact) => fact.seq > seq);
  }

  partitionIntents(currentTick) {
    const ready = [];
    const pending = [];

    for (const intent of this.intents) {
      if (intent.tickReceived <= currentTick) {
        ready.push(intent);
      } else {
        pending.push(intent);
      }
    }

    return { ready, pending };
  }

  replaceIntents(nextList) {
    this.intents.length = 0;
    this.intents.push(...nextList);
  }

  deduplicateIntents(intents) {
    const deduped = new Map();
    intents.forEach((intent) => deduped.set(intent.id, intent));
    return Array.from(deduped.values());
  }

  orderIntents(intents) {
    return intents.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.playerId.localeCompare(b.playerId);
    });
  }

  resolveIntent(intent, tickId) {
    switch (intent.type) {
      case 'move':
        return this.resolveMove(intent, tickId);
      case 'chat':
        return this.resolveChat(intent, tickId);
      case 'attack':
        return this.resolveAttack(intent, tickId);
      case 'use_item':
        return this.resolveUseItem(intent, tickId);
      case 'look':
        return this.resolveLook(intent, tickId);
      case 'action':
        return this.resolveGenericAction(intent, tickId);
      default:
        console.warn(`[RoomState:${this.roomId}] Unknown intent type`, intent);
        return [];
    }
  }

  resolveMove(intent, tickId) {
    const player = this.players.get(intent.playerId);
    if (!player) {
      return [];
    }

    const fact = this.createFact({
      tickId,
      type: 'player_moved',
      data: {
        playerId: intent.playerId,
        username: player.username,
        fromRoom: intent.data.fromRoom,
        toRoom: intent.data.toRoom,
      },
      affectedPlayers: [intent.playerId],
    })

    // After generating the fact, remove the player from this room
    this.removePlayer(intent.playerId)

    return [fact]
  }

  resolveChat(intent, tickId) {
    const player = this.players.get(intent.playerId);
    const username = player?.username ?? 'Unknown'
    const level = player?.level ?? 0

    return [
      this.createFact({
        tickId,
        type: 'chat',
        data: {
          playerId: intent.playerId,
          message: intent.data.message,
          username,
          level,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ];
  }

  resolveAttack(intent, tickId) {
    const player = this.players.get(intent.playerId)

    return [
      this.createFact({
        tickId,
        type: 'attack_intent',
        data: {
          playerId: intent.playerId,
          username: player?.username || intent.playerId,
          targetId: intent.data.targetId || null,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]
  }

  resolveUseItem(intent, tickId) {
    return [
      this.createFact({
        tickId,
        type: 'use_item',
        data: {
          playerId: intent.playerId,
          itemId: intent.data.itemId,
        },
        affectedPlayers: [intent.playerId],
      }),
    ];
  }

  resolveLook(intent, tickId) {
    return [
      this.createFact({
        tickId,
        type: 'look',
        data: {
          playerId: intent.playerId,
        },
        affectedPlayers: [intent.playerId],
      }),
    ];
  }

  resolveGenericAction(intent, tickId) {
    const player = this.players.get(intent.playerId)

    return [
      this.createFact({
        tickId,
        type: 'player_action',
        data: {
          playerId: intent.playerId,
          action: intent.data.action,
          username: player?.username || intent.playerId,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ];
  }

  createFact({ tickId, type, data, affectedPlayers }) {
    return {
      seq: this.nextSeq(),
      tickId,
      type,
      data,
      affectedPlayers,
      timestamp: Date.now(),
    };
  }

  recordFact(fact) {
    this.facts.push(fact);
    if (this.facts.length > 500) {
      this.facts.splice(0, this.facts.length - 500);
    }
  }

  nextSeq() {
    this.factSeq += 1;
    return this.factSeq;
  }
}

module.exports = {
  RoomState,
};
