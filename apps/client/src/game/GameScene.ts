import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

type Player = {
  id: string;
  x: number;
  y: number;
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private socket!: Socket;

  private otherPlayers = new Map<string, Phaser.GameObjects.Rectangle>();

  private speed = 200;

  constructor() {
    super("GameScene");
  }

  create() {
    this.createPlayer();

    this.createControls();

    this.connectToServer();

    this.add.text(20, 20, "MMO Client - Cesar Edition", {
      fontSize: "24px",
      color: "#ffffff",
    });
  }

  update(_: number, delta: number) {
    this.handleMovement(delta);
  }

  private createPlayer() {
    this.player = this.add.rectangle(400, 300, 32, 32, 0x3498db);
  }

  private createControls() {
    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  private handleMovement(delta: number) {
    const distance = this.speed * (delta / 1000);

    let moved = false;

    if (this.cursors.left.isDown) {
      this.player.x -= distance;
      moved = true;
    }

    if (this.cursors.right.isDown) {
      this.player.x += distance;
      moved = true;
    }

    if (this.cursors.up.isDown) {
      this.player.y -= distance;
      moved = true;
    }

    if (this.cursors.down.isDown) {
      this.player.y += distance;
      moved = true;
    }

    if (moved) {
      this.socket.emit("playerMove", {
        x: this.player.x,
        y: this.player.y,
      });
    }
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

    const rectangle = this.add.rectangle(player.x, player.y, 32, 32, 0xe74c3c);

    this.otherPlayers.set(player.id, rectangle);
  }
}
