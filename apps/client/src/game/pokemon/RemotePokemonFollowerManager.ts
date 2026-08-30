import Phaser from "phaser";

import type { Player, PokemonFollowerPublicState } from "@cesar-mmo/shared";

import { PokemonFollowerController } from "./PokemonFollowerController";
import { PokemonOverworldSpriteLoader } from "./PokemonOverworldSpriteLoader";

interface RemotePlayerRenderPosition {
  x: number;
  y: number;
}

type GetRemotePlayerRenderPosition = (
  playerId: string
) => RemotePlayerRenderPosition | undefined;

function getFollowerKey(follower: PokemonFollowerPublicState): string {
  return `${follower.speciesId}:${follower.formId}`;
}

export class RemotePokemonFollowerManager {
  private readonly scene: Phaser.Scene;

  private readonly spriteLoader: PokemonOverworldSpriteLoader;

  private readonly getRemotePlayerRenderPosition: GetRemotePlayerRenderPosition;

  private readonly controllers = new Map<string, PokemonFollowerController>();

  private readonly playerStates = new Map<string, Player>();

  private readonly requestedFollowerKeys = new Map<string, string>();

  private readonly generations = new Map<string, number>();

  constructor(
    scene: Phaser.Scene,
    spriteLoader: PokemonOverworldSpriteLoader,
    getRemotePlayerRenderPosition: GetRemotePlayerRenderPosition
  ) {
    this.scene = scene;

    this.spriteLoader = spriteLoader;

    this.getRemotePlayerRenderPosition = getRemotePlayerRenderPosition;
  }

  public sync(player: Player): void {
    this.playerStates.set(player.id, player);

    const follower = player.pokemonFollower;

    if (!follower) {
      this.removeFollower(player.id);
      return;
    }

    const followerKey = getFollowerKey(follower);
    const requestedKey = this.requestedFollowerKeys.get(player.id);
    if (requestedKey === followerKey) {
      return;
    }

    this.requestedFollowerKeys.set(player.id, followerKey);
    const generation = this.nextGeneration(player.id);
    this.controllers.get(player.id)?.destroy();
    this.controllers.delete(player.id);
    void this.prepareFollower(player.id, follower, followerKey, generation);
  }

  public update(delta: number): void {
    for (const [playerId, controller] of this.controllers) {
      const player = this.playerStates.get(playerId);
      const renderPosition = this.getRemotePlayerRenderPosition(playerId);

      if (!player || !renderPosition) {
        continue;
      }

      controller.update(renderPosition.x, renderPosition.y, player.direction, delta);
    }
  }

  public remove(playerId: string): void {
    this.nextGeneration(playerId);
    this.controllers.get(playerId)?.destroy();
    this.controllers.delete(playerId);
    this.playerStates.delete(playerId);
    this.requestedFollowerKeys.delete(playerId);
  }

  public clear(): void {
    for (const playerId of Array.from(this.playerStates.keys())) {
      this.remove(playerId);
    }
  }

  private async prepareFollower(
    playerId: string,
    follower: PokemonFollowerPublicState,
    followerKey: string,
    generation: number
  ): Promise<void> {
    try {
      await this.spriteLoader.ensurePokemonLoaded(follower);

      if (this.generations.get(playerId) !== generation) {
        return;
      }

      if (this.requestedFollowerKeys.get(playerId) !== followerKey) {
        return;
      }

      const player = this.playerStates.get(playerId);

      const renderPosition = this.getRemotePlayerRenderPosition(playerId);

      if (!player || !renderPosition) {
        return;
      }

      const currentFollower = player.pokemonFollower;

      if (!currentFollower || getFollowerKey(currentFollower) !== followerKey) {
        return;
      }

      const controller = new PokemonFollowerController(this.scene);

      controller.create(
        currentFollower,
        renderPosition.x,
        renderPosition.y,
        player.direction
      );

      this.controllers.set(playerId, controller);
    } catch (error) {
      console.error(
        `[Remote Pokemon Follower] Failed to prepare follower for player ${playerId}`,
        error
      );

      if (this.generations.get(playerId) === generation) {
        this.requestedFollowerKeys.delete(playerId);
      }
    }
  }

  private removeFollower(playerId: string): void {
    this.nextGeneration(playerId);
    this.controllers.get(playerId)?.destroy();
    this.controllers.delete(playerId);
    this.requestedFollowerKeys.delete(playerId);
  }

  private nextGeneration(playerId: string): number {
    const generation = (this.generations.get(playerId) ?? 0) + 1;
    this.generations.set(playerId, generation);
    return generation;
  }
}
