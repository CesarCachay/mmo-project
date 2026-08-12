import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_SIZE,
  getMovementDelta,
  clampPlayerPosition,
} from "@cesar-mmo/shared";

import type { Player, PlayerInput } from "@cesar-mmo/shared";

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private wasd!: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;

  private socket!: Socket;

  private otherPlayers = new Map<string, Phaser.GameObjects.Rectangle>();

  private otherPlayerTargets = new Map<string, { x: number; y: number }>();

  private lastInput: PlayerInput = {
    sequence: 0,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  private inputSequence = 0;

  private serverPosition = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
  };

  constructor() {
    super("GameScene");
  }

  create() {
    this.createPlayer();
    this.createControls();
    this.connectToServer();

    this.add.text(20, 20, "MMO - Cesar Edition", {
      fontSize: "24px",
      color: "#ffffff",
    });
  }

  update(_: number, delta: number) {
    const input = this.getCurrentInput();

    this.sendInputIfChanged(input);

    this.predictLocalMovement(input, delta);

    this.reconcileLocalPlayer(delta);

    this.interpolateOtherPlayers(delta);
  }

  private createPlayer() {
    this.player = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      PLAYER_SIZE,
      PLAYER_SIZE,
      0x3498db,
    );
  }

  private createControls() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  }

  private getCurrentInput(): PlayerInput {
    return {
      sequence: this.inputSequence,

      left: this.cursors.left.isDown || this.wasd.left.isDown,

      right: this.cursors.right.isDown || this.wasd.right.isDown,

      up: this.cursors.up.isDown || this.wasd.up.isDown,

      down: this.cursors.down.isDown || this.wasd.down.isDown,
    };
  }

  private sendInputIfChanged(input: PlayerInput) {
    if (!this.hasInputChanged(input)) {
      return;
    }

    this.inputSequence++;

    const inputToSend: PlayerInput = {
      ...input,
      sequence: this.inputSequence,
    };

    this.socket.emit("playerInput", inputToSend);

    this.lastInput = inputToSend;
  }

  private hasInputChanged(input: PlayerInput) {
    return (
      input.up !== this.lastInput.up ||
      input.down !== this.lastInput.down ||
      input.left !== this.lastInput.left ||
      input.right !== this.lastInput.right
    );
  }

  private connectToServer() {
    this.socket = io("http://localhost:3000");

    this.socket.on("connect", () => {
      console.log("Connected:", this.socket.id);
    });

    this.socket.on("currentPlayers", (players: Record<string, Player>) => {
      Object.values(players).forEach((player) => {
        if (player.id === this.socket.id) {
          this.player.setPosition(player.x, player.y);

          return;
        }

        this.addOtherPlayer(player);
      });
    });

    this.socket.on("playerJoined", (player: Player) => {
      this.addOtherPlayer(player);
    });

    this.socket.on("playersState", (players: Record<string, Player>) => {
      Object.values(players).forEach((player) => {
        if (player.id === this.socket.id) {
          this.updateLocalPlayer(player);
          return;
        }

        const otherPlayer = this.otherPlayers.get(player.id);

        if (!otherPlayer) {
          this.addOtherPlayer(player);
          return;
        }

        this.otherPlayerTargets.set(player.id, {
          x: player.x,
          y: player.y,
        });
      });
    });

    this.socket.on("playerDisconnected", (playerId: string) => {
      const player = this.otherPlayers.get(playerId);

      if (!player) {
        return;
      }

      player.destroy();

      this.otherPlayers.delete(playerId);

      this.otherPlayerTargets.delete(playerId);
    });
  }

  private updateLocalPlayer(player: Player) {
    this.serverPosition = {
      x: player.x,
      y: player.y,
    };

    this.player.setFillStyle(player.color);
  }

  private addOtherPlayer(player: Player) {
    if (this.otherPlayers.has(player.id)) {
      return;
    }

    const rectangle = this.add.rectangle(
      player.x,
      player.y,
      PLAYER_SIZE,
      PLAYER_SIZE,
      player.color,
    );

    this.otherPlayers.set(player.id, rectangle);

    this.otherPlayerTargets.set(player.id, {
      x: player.x,
      y: player.y,
    });
  }

  private interpolateOtherPlayers(delta: number) {
    const interpolationRate = 12;

    const alpha = 1 - Math.exp(-interpolationRate * (delta / 1000));

    for (const [playerId, gameObject] of this.otherPlayers) {
      const target = this.otherPlayerTargets.get(playerId);

      if (!target) {
        continue;
      }

      gameObject.x = Phaser.Math.Linear(gameObject.x, target.x, alpha);

      gameObject.y = Phaser.Math.Linear(gameObject.y, target.y, alpha);
    }
  }

  private predictLocalMovement(input: PlayerInput, delta: number) {
    const movement = getMovementDelta(input, delta / 1000);

    const nextPosition = clampPlayerPosition({
      x: this.player.x + movement.x,
      y: this.player.y + movement.y,
    });

    this.player.setPosition(nextPosition.x, nextPosition.y);
  }

  private reconcileLocalPlayer(delta: number) {
    const errorX = this.serverPosition.x - this.player.x;

    const errorY = this.serverPosition.y - this.player.y;

    const distance = Math.sqrt(errorX * errorX + errorY * errorY);

    const reconciliationThreshold = 2;

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

    this.player.x = Phaser.Math.Linear(
      this.player.x,
      this.serverPosition.x,
      alpha,
    );

    this.player.y = Phaser.Math.Linear(
      this.player.y,
      this.serverPosition.y,
      alpha,
    );
  }
}
