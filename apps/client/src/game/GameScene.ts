import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_SPEED,
  PLAYER_SIZE,
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
    up: false,
    down: false,
    left: false,
    right: false,
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
    this.handleInput();
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

  private handleInput() {
    const input: PlayerInput = {
      left: this.cursors.left.isDown || this.wasd.left.isDown,

      right: this.cursors.right.isDown || this.wasd.right.isDown,

      up: this.cursors.up.isDown || this.wasd.up.isDown,

      down: this.cursors.down.isDown || this.wasd.down.isDown,
    };

    if (this.hasInputChanged(input)) {
      this.socket.emit("playerInput", input);

      this.lastInput = input;
    }
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
    this.player.setPosition(player.x, player.y);

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
}
