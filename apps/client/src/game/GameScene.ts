import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_COLORS,
  PLAYER_SPEED,
  PLAYER_SIZE,
  type Player,
} from "@cesar-mmo/shared";

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private socket!: Socket;

  private otherPlayers = new Map<string, Phaser.GameObjects.Rectangle>();

  private lastSentPosition = {
    x: 0,
    y: 0,
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

  private speed = 200;

  update(_: number, delta: number) {
    this.handleMovement(delta);
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

  private handleMovement(delta: number) {
    let directionX = 0;
    let directionY = 0;

    const movingLeft = this.cursors.left.isDown || this.wasd.left.isDown;
    const movingRight = this.cursors.right.isDown || this.wasd.right.isDown;
    const movingUp = this.cursors.up.isDown || this.wasd.up.isDown;
    const movingDown = this.cursors.down.isDown || this.wasd.down.isDown;

    if (movingLeft) {
      directionX -= 1;
    }

    if (movingRight) {
      directionX += 1;
    }

    if (movingUp) {
      directionY -= 1;
    }

    if (movingDown) {
      directionY += 1;
    }

    if (directionX === 0 && directionY === 0) {
      return;
    }

    const direction = new Phaser.Math.Vector2(
      directionX,
      directionY,
    ).normalize();

    const distance = PLAYER_SPEED * (delta / 1000);

    this.player.x += direction.x * distance;

    this.player.y += direction.y * distance;

    this.clampPlayerPosition();

    this.sendPlayerPosition();
  }

  private clampPlayerPosition() {
    const halfPlayerSize = PLAYER_SIZE / 2;

    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      halfPlayerSize,
      GAME_WIDTH - halfPlayerSize,
    );

    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      halfPlayerSize,
      GAME_HEIGHT - halfPlayerSize,
    );
  }

  private sendPlayerPosition() {
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);

    if (x === this.lastSentPosition.x && y === this.lastSentPosition.y) {
      return;
    }

    this.lastSentPosition = {
      x,
      y,
    };

    this.socket.emit("playerMove", {
      x,
      y,
    });
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

    this.socket.on("playerMoved", (player: Player) => {
      const otherPlayer = this.otherPlayers.get(player.id);

      if (!otherPlayer) {
        return;
      }

      otherPlayer.setPosition(player.x, player.y);
    });

    this.socket.on("playerDisconnected", (playerId: string) => {
      const player = this.otherPlayers.get(playerId);

      if (!player) {
        return;
      }

      player.destroy();

      this.otherPlayers.delete(playerId);
    });
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
  }
}
