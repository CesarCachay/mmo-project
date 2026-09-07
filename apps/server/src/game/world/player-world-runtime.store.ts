import { Injectable } from '@nestjs/common';
import type { MapId, Player, PlayerInput } from '@cesar-mmo/shared';

@Injectable()
export class PlayerWorldRuntimeStore {
  private readonly playersById = new Map<string, Player>();
  private readonly inputsByPlayerId = new Map<string, PlayerInput>();
  private readonly playerIdsByMap = new Map<MapId, Set<string>>();

  addPlayer(player: Player): void {
    if (this.playersById.has(player.id)) {
      throw new Error(`Player "${player.id}" already exists in world runtime`);
    }

    this.playersById.set(player.id, player);
    this.addPlayerToMapIndex(player.id, player.mapId);
  }

  removePlayer(playerId: string): Player | undefined {
    const player = this.playersById.get(playerId);

    this.inputsByPlayerId.delete(playerId);

    if (!player) {
      return undefined;
    }

    this.playersById.delete(playerId);
    this.removePlayerFromMapIndex(playerId, player.mapId);

    return player;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.playersById.get(playerId);
  }

  setInput(playerId: string, input: PlayerInput): void {
    if (!this.playersById.has(playerId)) {
      return;
    }

    this.inputsByPlayerId.set(playerId, input);
  }

  getInput(playerId: string): PlayerInput | undefined {
    return this.inputsByPlayerId.get(playerId);
  }

  entries(): IterableIterator<[string, Player]> {
    return this.playersById.entries();
  }

  values(): IterableIterator<Player> {
    return this.playersById.values();
  }

  getActiveMapIds(): readonly MapId[] {
    return Array.from(this.playerIdsByMap.keys());
  }

  getPlayersInMap(mapId: MapId): Record<string, Player> {
    const result: Record<string, Player> = {};

    const playerIds = this.playerIdsByMap.get(mapId);

    if (!playerIds) {
      return result;
    }

    for (const playerId of playerIds) {
      const player = this.playersById.get(playerId);

      if (!player) {
        continue;
      }

      result[playerId] = player;
    }

    return result;
  }

  movePlayerToMap(playerId: string, targetMapId: MapId): Player | undefined {
    const player = this.playersById.get(playerId);

    if (!player) {
      return undefined;
    }

    const previousMapId = player.mapId;

    if (previousMapId === targetMapId) {
      return player;
    }

    this.removePlayerFromMapIndex(playerId, previousMapId);
    player.mapId = targetMapId;
    this.addPlayerToMapIndex(playerId, targetMapId);
    return player;
  }

  isDisplayNameInUse(displayName: string): boolean {
    const normalized = displayName.trim().toLowerCase();

    for (const player of this.playersById.values()) {
      if (player.displayName.trim().toLowerCase() === normalized) {
        return true;
      }
    }

    return false;
  }

  private addPlayerToMapIndex(playerId: string, mapId: MapId): void {
    let playerIds = this.playerIdsByMap.get(mapId);

    if (!playerIds) {
      playerIds = new Set<string>();

      this.playerIdsByMap.set(mapId, playerIds);
    }

    playerIds.add(playerId);
  }

  private removePlayerFromMapIndex(playerId: string, mapId: MapId): void {
    const playerIds = this.playerIdsByMap.get(mapId);

    if (!playerIds) {
      return;
    }

    playerIds.delete(playerId);

    if (playerIds.size === 0) {
      this.playerIdsByMap.delete(mapId);
    }
  }
}
