import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

import {
  TOWN_01_MAP,
  PLAYER_SIZE,
  getMovementDelta,
  resolveMapCollision,
  isPlayerMoving,
  getDirectionFromInput,
} from "@cesar-mmo/shared";

import type { Player, PlayerInput, Direction } from "@cesar-mmo/shared";

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;

  private map!: Phaser.Tilemaps.Tilemap;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private wasd!: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;

  private socket!: Socket;

  private otherPlayers = new Map<string, Phaser.GameObjects.Sprite>();

  private otherPlayerTargets = new Map<string, { x: number; y: number }>();

  private lastInput: PlayerInput = {
    sequence: 0,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  private inputSequence = 0;

  private serverPosition!: {
    x: number;
    y: number;
  };

  private playerDirection: Direction = "down";

  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.tilemapTiledJSON("town-01", "/assets/maps/town-01/town-01.json");

    this.load.image("town-terrain", "/assets/maps/town-01/poke-sheet.png");

    this.load.image("town-buildings", "/assets/maps/town-01/poke-assets.png");

    this.load.spritesheet(
      "player-walk-down",
      "/assets/characters/player/walk-down.png",
      {
        frameWidth: 24,
        frameHeight: 24,
      },
    );
    this.load.spritesheet(
      "player-walk-left",
      "/assets/characters/player/walk-left.png",
      {
        frameWidth: 24,
        frameHeight: 24,
      },
    );
    this.load.spritesheet(
      "player-walk-right",
      "/assets/characters/player/walk-right.png",
      {
        frameWidth: 24,
        frameHeight: 24,
      },
    );
    this.load.spritesheet(
      "player-walk-up",
      "/assets/characters/player/walk-up.png",
      {
        frameWidth: 24,
        frameHeight: 24,
      },
    );
  }

  create() {
    this.createMap();
    this.createPlayerAnimations();
    this.createPlayer();
    this.setupCamera();
    this.createControls();
    this.connectToServer();

    this.add.text(20, 20, "MMO - Cesar Edition", {
      fontSize: "24px",
      color: "#ffffff",
    });
  }

  update(_: number, delta: number) {
    const input = this.getCurrentInput();

    this.updatePlayerAnimation(input);

    this.sendInputIfChanged(input);

    this.predictLocalMovement(input, delta);

    this.reconcileLocalPlayer(delta);

    this.interpolateOtherPlayers(delta);
  }

  private createPlayer() {
    const spawn = this.getPlayerSpawn();

    this.player = this.add.sprite(spawn.x, spawn.y, "player-walk-down", 0);

    this.player.setDepth(5);

    this.serverPosition = {
      x: spawn.x,
      y: spawn.y,
    };
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

        this.updateRemotePlayerAnimation(otherPlayer, player);
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
  }

  private addOtherPlayer(player: Player) {
    if (this.otherPlayers.has(player.id)) {
      return;
    }

    const sprite = this.add.sprite(
      player.x,
      player.y,
      `player-walk-${player.direction}`,
      0,
    );

    sprite.setDepth(5);

    this.otherPlayers.set(player.id, sprite);

    this.otherPlayerTargets.set(player.id, {
      x: player.x,
      y: player.y,
    });

    this.updateRemotePlayerAnimation(sprite, player);
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
      TOWN_01_MAP,
    );

    this.player.setPosition(resolvedPosition.x, resolvedPosition.y);
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

  private createMap() {
    this.map = this.make.tilemap({
      key: "town-01",
    });

    const terrainTileset = this.map.addTilesetImage(
      "town-terrain",
      "town-terrain",
    );

    const buildingsTileset = this.map.addTilesetImage(
      "town-buildings",
      "town-buildings",
    );

    if (!terrainTileset || !buildingsTileset) {
      throw new Error("Could not load Tiled tilesets");
    }

    const tilesets = [terrainTileset, buildingsTileset];

    this.map.createLayer("Ground", tilesets, 0, 0);

    this.map.createLayer("GroundDetails", tilesets, 0, 0);

    this.map.createLayer("Buildings", tilesets, 0, 0);

    const groundLayer = this.map.createLayer("Ground", tilesets, 0, 0);

    const groundDetailsLayer = this.map.createLayer(
      "GroundDetails",
      tilesets,
      0,
      0,
    );

    const buildingsLayer = this.map.createLayer("Buildings", tilesets, 0, 0);

    const abovePlayerLayer = this.map.createLayer(
      "AbovePlayer",
      tilesets,
      0,
      0,
    );

    groundLayer?.setDepth(0);
    groundDetailsLayer?.setDepth(1);
    buildingsLayer?.setDepth(2);
    abovePlayerLayer?.setDepth(10);
  }

  private getPlayerSpawn() {
    const objectsLayer = this.map.getObjectLayer("Objects");

    if (!objectsLayer) {
      throw new Error('Object layer "Objects" not found');
    }

    const playerSpawn = objectsLayer.objects.find(
      (object) => object.name === "playerSpawn",
    );

    if (
      !playerSpawn ||
      playerSpawn.x === undefined ||
      playerSpawn.y === undefined
    ) {
      throw new Error('Object "playerSpawn" not found');
    }

    return {
      x: playerSpawn.x,
      y: playerSpawn.y,
    };
  }

  private createPlayerAnimations() {
    this.anims.create({
      key: "walk-down",
      frames: this.anims.generateFrameNumbers("player-walk-down", {
        start: 0,
        end: 11,
      }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "walk-left",
      frames: this.anims.generateFrameNumbers("player-walk-left", {
        start: 0,
        end: 11,
      }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "walk-right",
      frames: this.anims.generateFrameNumbers("player-walk-right", {
        start: 0,
        end: 11,
      }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "walk-up",
      frames: this.anims.generateFrameNumbers("player-walk-up", {
        start: 0,
        end: 11,
      }),
      frameRate: 12,
      repeat: -1,
    });
  }

  private updatePlayerAnimation(input: PlayerInput) {
    this.playerDirection = getDirectionFromInput(input, this.playerDirection);

    const moving = isPlayerMoving(input);

    if (!moving) {
      this.setPlayerIdle();

      return;
    }

    this.player.play(`walk-${this.playerDirection}`, true);
  }

  private setPlayerIdle() {
    this.player.anims.stop();

    this.player.setTexture(`player-walk-${this.playerDirection}`, 0);
  }

  private updateRemotePlayerAnimation(
    sprite: Phaser.GameObjects.Sprite,
    player: Player,
  ) {
    if (player.isMoving) {
      sprite.play(`walk-${player.direction}`, true);

      return;
    }

    sprite.anims.stop();
    sprite.setTexture(`player-walk-${player.direction}`, 0);
  }

  private setupCamera() {
    this.cameras.main.setBounds(
      0,
      0,
      this.map.widthInPixels,
      this.map.heightInPixels,
    );

    this.cameras.main.startFollow(this.player, true);
  }
}
