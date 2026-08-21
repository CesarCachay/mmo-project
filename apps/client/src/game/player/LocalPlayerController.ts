import Phaser from "phaser";

import {
  MAP_DATA_REGISTRY,
  PLAYER_SIZE,
  getDirectionFromInput,
  getMovementDelta,
  isPlayerMoving,
  resolveMapCollision,
} from "@cesar-mmo/shared";

import { getPlayerAnimationKey, getPlayerTextureKey } from "../config/playerAssets";

import type { Direction, MapId, PlayerAvatarId, PlayerInput } from "@cesar-mmo/shared";

export class LocalPlayerController {
  private readonly player: Phaser.GameObjects.Sprite;
  private readonly avatarId: PlayerAvatarId;

  private serverPosition: {
    x: number;
    y: number;
  };

  private playerDirection: Direction = "down";

  constructor(player: Phaser.GameObjects.Sprite, avatarId: PlayerAvatarId) {
    this.player = player;
    this.avatarId = avatarId;

    this.serverPosition = {
      x: player.x,
      y: player.y,
    };
  }

  get direction(): Direction {
    return this.playerDirection;
  }

  setDirection(direction: Direction): void {
    this.playerDirection = direction;
  }

  setServerPosition(x: number, y: number): void {
    this.serverPosition = { x, y };
  }

  snapToPosition(x: number, y: number): void {
    this.player.setPosition(x, y);
    this.serverPosition = { x, y };
  }

  updateAnimation(input: PlayerInput): void {
    this.playerDirection = getDirectionFromInput(input, this.playerDirection);
    const moving = isPlayerMoving(input);

    if (!moving) {
      this.setIdle();
      return;
    }

    this.player.play(getPlayerAnimationKey(this.avatarId, this.playerDirection), true);
  }

  setIdle(): void {
    this.player.anims.stop();
    this.player.setTexture(getPlayerTextureKey(this.avatarId, this.playerDirection), 0);
  }

  predictMovement(
    input: PlayerInput,
    delta: number,
    mapId: MapId,
    isMovementBlocked: boolean
  ): void {
    if (isMovementBlocked) {
      return;
    }

    const mapData = MAP_DATA_REGISTRY[mapId];
    const movement = getMovementDelta(input, delta / 1000);

    const nextPosition = {
      x: this.player.x + movement.x,
      y: this.player.y + movement.y,
    };

    const resolvedPosition = resolveMapCollision(
      {
        x: this.player.x,
        y: this.player.y,
      },
      nextPosition,
      PLAYER_SIZE,
      mapData
    );

    this.player.setPosition(resolvedPosition.x, resolvedPosition.y);
  }

  reconcile(delta: number): void {
    const errorX = this.serverPosition.x - this.player.x;
    const errorY = this.serverPosition.y - this.player.y;
    const distance = Math.sqrt(errorX * errorX + errorY * errorY);
    const reconciliationThreshold = 4;

    if (distance < reconciliationThreshold) {
      return;
    }

    const hardSnapDistance = 100;

    if (distance > hardSnapDistance) {
      this.player.setPosition(this.serverPosition.x, this.serverPosition.y);
      return;
    }

    const reconciliationRate = 5;
    const alpha = 1 - Math.exp(-reconciliationRate * (delta / 1000));
    this.player.x = Phaser.Math.Linear(this.player.x, this.serverPosition.x, alpha);
    this.player.y = Phaser.Math.Linear(this.player.y, this.serverPosition.y, alpha);
  }
}
