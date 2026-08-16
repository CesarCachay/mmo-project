import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

import {
  TOWN_01_MAP,
  PLAYER_SIZE,
  getMovementDelta,
  resolveMapCollision,
  isPlayerMoving,
  getDirectionFromInput,
  CHAT_EVENTS,
  isChatMessageInput,
} from "@cesar-mmo/shared";

import {
  NPC_ASSETS,
  NPC_FRAME_HEIGHT,
  NPC_FRAME_WIDTH,
  getNpcTextureKey,
} from "./config/npcAssets";

import {
  PLAYER_AVATARS,
  PLAYER_DIRECTIONS,
  getPlayerTextureKey,
  getPlayerAnimationKey,
} from "./config/playerAssets";

import { ChatBox } from "./ui/ChatBox";
import { DialogueBox } from "./ui/DialogueBox";
import { getDialogue } from "./dialogue/dialogues";
import type { NpcInteractionType } from "./npc/types";
import type {
  Player,
  PlayerInput,
  Direction,
  PlayerAvatarId,
  ChatMessage,
  ChatMessageInput,
} from "@cesar-mmo/shared";

type NpcDirection = "up" | "down" | "left" | "right";

type TiledCustomProperty = {
  name: string;
  value: unknown;
};

type NpcDefinition = {
  id: string;
  x: number;
  y: number;
  displayName: string;
  direction: NpcDirection;
  sprite: string;
  interactionType: NpcInteractionType;
  dialogueId?: string;
};

type NpcInstance = {
  definition: NpcDefinition;
  sprite: Phaser.GameObjects.Sprite;
  nameLabel: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private map!: Phaser.Tilemaps.Tilemap;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;

  private chatKey!: Phaser.Input.Keyboard.Key;

  private socket!: Socket;

  private otherPlayers = new Map<string, Phaser.GameObjects.Sprite>();
  private otherPlayerTargets = new Map<string, { x: number; y: number }>();

  private playerNameLabel?: Phaser.GameObjects.Text;
  private otherPlayerNameLabels = new Map<string, Phaser.GameObjects.Text>();

  private npcs = new Map<string, NpcInstance>();
  private nearbyNpc?: NpcInstance;
  private readonly npcInteractionDistance = 36;
  private dialogueBox!: DialogueBox;

  private chatBox!: ChatBox;

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
  private displayName = "";
  private avatarId: PlayerAvatarId = "male-01";

  constructor() {
    super("GameScene");
  }

  init(data: { displayName: string; avatarId: PlayerAvatarId }) {
    this.displayName = data.displayName;
    this.avatarId = data.avatarId;
  }

  preload() {
    this.load.tilemapTiledJSON("town-01", "/assets/maps/town-01/town-01.json");
    this.load.image("town-terrain", "/assets/maps/town-01/poke-sheet.png");
    this.load.image("town-buildings", "/assets/maps/town-01/poke-assets.png");

    // Players spritesheets
    Object.values(PLAYER_AVATARS).forEach((avatar) => {
      PLAYER_DIRECTIONS.forEach((direction) => {
        this.load.spritesheet(
          getPlayerTextureKey(avatar.id, direction),
          `/${avatar.path}/walk-${direction}.png`,
          {
            frameWidth: 24,
            frameHeight: 24,
          }
        );
      });
    });

    // NPCs
    this.preloadNpcSprites();
  }

  create() {
    this.createMap();
    this.createPlayerAnimations();
    this.createPlayer();
    this.createNpcs();
    this.setupCamera();
    this.createDialogueUi();
    this.createChatUi();
    this.createControls();
    this.connectToServer();

    this.add.text(8, 8, "MMO - Cesar Edition", {
      fontSize: "16px",
      color: "#ffffff",
    });
  }

  update(_: number, delta: number) {
    this.handleChatFocus();

    this.updateNearbyNpc();
    this.handleNpcInteraction();

    const input = this.getCurrentInput();
    this.updatePlayerAnimation(input);
    this.sendInputIfChanged(input);
    this.predictLocalMovement(input, delta);
    this.reconcileLocalPlayer(delta);
    this.interpolateOtherPlayers(delta);
    this.updateLocalPlayerNamePosition();
  }

  private createDialogueUi() {
    this.dialogueBox = new DialogueBox(this);
  }

  private createChatUi() {
    this.chatBox = new ChatBox(this, (text) => this.sendChatMessage(text));
  }

  private createPlayer() {
    const spawn = this.getPlayerSpawn();

    this.player = this.add.sprite(
      spawn.x,
      spawn.y,
      getPlayerTextureKey(this.avatarId, "down"),
      0
    );

    this.player.setDepth(5);

    this.serverPosition = {
      x: spawn.x,
      y: spawn.y,
    };
  }

  private updateNearbyNpc() {
    const previousNpc = this.nearbyNpc;
    this.nearbyNpc = this.findNearbyNpc();
    if (previousNpc?.definition.id !== this.nearbyNpc?.definition.id) {
      console.log("Nearby NPC:", this.nearbyNpc?.definition.id ?? "none");
    }
  }

  private interactWithNpc(npc: NpcInstance) {
    switch (npc.definition.interactionType) {
      case "dialogue":
        this.startNpcDialogue(npc);
        return;

      case "shop":
        console.warn("Shop interactions are not implemented yet");
        return;

      case "quest":
        console.warn("Quest interactions are not implemented yet");
        return;
    }
  }

  private startNpcDialogue(npc: NpcInstance) {
    const { dialogueId } = npc.definition;

    if (!dialogueId) {
      console.warn(`NPC ${npc.definition.id} has no dialogueId`);

      return;
    }
    const dialogue = getDialogue(dialogueId);

    if (!dialogue) {
      console.warn(`Dialogue not found: ${npc.definition.dialogueId}`);

      return;
    }

    this.dialogueBox.start(npc.definition.displayName, dialogue.lines);
  }

  private createControls() {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      throw new Error("Keyboard input is not available");
    }

    keyboard.enableGlobalCapture();

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;

    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.chatKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  private preloadNpcSprites() {
    for (const [spriteId, definition] of Object.entries(NPC_ASSETS)) {
      for (const direction of definition.directions) {
        const textureKey = getNpcTextureKey(spriteId, direction);

        this.load.spritesheet(textureKey, `${definition.folder}/walk-${direction}.png`, {
          frameWidth: NPC_FRAME_WIDTH,
          frameHeight: NPC_FRAME_HEIGHT,
        });
      }
    }
  }

  private getCurrentInput(): PlayerInput {
    if (this.dialogueBox.isOpen() || this.chatBox.isTyping()) {
      return {
        sequence: this.inputSequence,
        up: false,
        down: false,
        left: false,
        right: false,
      };
    }

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
    this.socket = io("http://localhost:3000", {
      auth: {
        displayName: this.displayName,
        avatarId: this.avatarId,
      },
    });

    this.socket.on("connectionRejected", (error: { code: string; message: string }) => {
      this.socket.disconnect();

      this.scene.start("JoinScene", {
        errorMessage: error.message,
        displayName: this.displayName,
        avatarId: this.avatarId,
      });
    });

    this.socket.on("connect", () => {
      console.log("Connected:", this.socket.id);
    });

    this.socket.on(CHAT_EVENTS.MESSAGE_RECEIVED, (message: ChatMessage) => {
      this.handleChatMessageReceived(message);
    });

    this.socket.on("currentPlayers", (players: Record<string, Player>) => {
      console.log("Numero de players:", players);

      Object.values(players).forEach((player) => {
        if (player.id === this.socket.id) {
          this.player.setPosition(player.x, player.y);
          this.playerNameLabel = this.createPlayerNameLabel(player.displayName);
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

      const nameLabel = this.otherPlayerNameLabels.get(playerId);
      nameLabel?.destroy();

      this.otherPlayers.delete(playerId);
      this.otherPlayerTargets.delete(playerId);
      this.otherPlayerNameLabels.delete(playerId);
    });
  }

  private updateLocalPlayer(player: Player) {
    this.serverPosition = {
      x: player.x,
      y: player.y,
    };
  }

  private updateLocalPlayerNamePosition() {
    if (!this.playerNameLabel) {
      return;
    }

    this.playerNameLabel.setPosition(
      Math.round(this.player.x),
      Math.round(this.player.y - 14)
    );
  }

  private addOtherPlayer(player: Player) {
    if (this.otherPlayers.has(player.id)) {
      return;
    }

    const sprite = this.add.sprite(
      player.x,
      player.y,
      getPlayerTextureKey(player.avatarId, player.direction),
      0
    );

    sprite.setDepth(5);

    this.otherPlayers.set(player.id, sprite);

    const nameLabel = this.createPlayerNameLabel(player.displayName);

    this.otherPlayerNameLabels.set(player.id, nameLabel);

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

      const nameLabel = this.otherPlayerNameLabels.get(playerId);

      if (nameLabel) {
        nameLabel.setPosition(Math.round(gameObject.x), Math.round(gameObject.y - 14));
      }
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
      TOWN_01_MAP
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

    this.player.x = Phaser.Math.Linear(this.player.x, this.serverPosition.x, alpha);

    this.player.y = Phaser.Math.Linear(this.player.y, this.serverPosition.y, alpha);
  }

  private createMap() {
    this.map = this.make.tilemap({
      key: "town-01",
    });

    const terrainTileset = this.map.addTilesetImage("town-terrain", "town-terrain");

    const buildingsTileset = this.map.addTilesetImage("town-buildings", "town-buildings");

    if (!terrainTileset || !buildingsTileset) {
      throw new Error("Could not load Tiled tilesets");
    }

    const tilesets = [terrainTileset, buildingsTileset];

    const groundLayer = this.map.createLayer("Ground", tilesets, 0, 0);

    const groundDetailsLayer = this.map.createLayer("GroundDetails", tilesets, 0, 0);

    const buildingsLayer = this.map.createLayer("Buildings", tilesets, 0, 0);

    const abovePlayerLayer = this.map.createLayer("AbovePlayer", tilesets, 0, 0);

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
      (object) => object.name === "playerSpawn"
    );

    if (!playerSpawn || playerSpawn.x === undefined || playerSpawn.y === undefined) {
      throw new Error('Object "playerSpawn" not found');
    }

    return {
      x: playerSpawn.x,
      y: playerSpawn.y,
    };
  }

  private createPlayerAnimations() {
    Object.values(PLAYER_AVATARS).forEach((avatar) => {
      PLAYER_DIRECTIONS.forEach((direction) => {
        const animationKey = getPlayerAnimationKey(avatar.id, direction);

        if (this.anims.exists(animationKey)) {
          return;
        }

        this.anims.create({
          key: animationKey,

          frames: this.anims.generateFrameNumbers(
            getPlayerTextureKey(avatar.id, direction),
            {
              start: 0,
              end: 11,
            }
          ),

          frameRate: 12,
          repeat: -1,
        });
      });
    });
  }

  private updatePlayerAnimation(input: PlayerInput) {
    this.playerDirection = getDirectionFromInput(input, this.playerDirection);

    const moving = isPlayerMoving(input);
    if (!moving) {
      this.setPlayerIdle();
      return;
    }

    this.player.play(getPlayerAnimationKey(this.avatarId, this.playerDirection), true);
  }

  private setPlayerIdle() {
    this.player.anims.stop();

    this.player.setTexture(getPlayerTextureKey(this.avatarId, this.playerDirection), 0);
  }

  private updateRemotePlayerAnimation(sprite: Phaser.GameObjects.Sprite, player: Player) {
    if (player.isMoving) {
      sprite.play(getPlayerAnimationKey(player.avatarId, player.direction), true);
      return;
    }
    sprite.anims.stop();
    sprite.setTexture(getPlayerTextureKey(player.avatarId, player.direction), 0);
  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    this.cameras.main.startFollow(this.player, true);
  }

  private createPlayerNameLabel(displayName: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, displayName, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 1,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  private getNpcDefinitions(): NpcDefinition[] {
    const objectsLayer = this.map.getObjectLayer("Objects");

    if (!objectsLayer) {
      throw new Error('Object layer "Objects" not found');
    }

    return objectsLayer.objects
      .filter((object) => object.type === "npc")
      .map((object) => {
        const properties = (object.properties ?? []) as TiledCustomProperty[];

        const getProperty = (name: string): unknown =>
          properties.find((property) => property.name === name)?.value;
        const displayName = getProperty("displayName");
        const direction = getProperty("direction");
        const sprite = getProperty("sprite");
        const dialogueId = getProperty("dialogueId");
        const interactionType = getProperty("interactionType");

        if (
          typeof object.x !== "number" ||
          typeof object.y !== "number" ||
          typeof object.name !== "string" ||
          typeof displayName !== "string" ||
          typeof direction !== "string" ||
          typeof sprite !== "string" ||
          typeof dialogueId !== "string"
        ) {
          throw new Error(`Invalid NPC definition: ${object.name}`);
        }

        if (
          direction !== "up" &&
          direction !== "down" &&
          direction !== "left" &&
          direction !== "right"
        ) {
          throw new Error(`Invalid NPC direction: ${direction}`);
        }
        if (
          interactionType !== "dialogue" &&
          interactionType !== "shop" &&
          interactionType !== "quest"
        ) {
          throw new Error(`Invalid NPC interaction type: ${String(interactionType)}`);
        }

        return {
          id: object.name,
          x: object.x,
          y: object.y,
          displayName,
          direction,
          sprite,
          interactionType,
          dialogueId,
        };
      });
  }

  private createNpcs() {
    const npcDefinitions = this.getNpcDefinitions();

    for (const npc of npcDefinitions) {
      const textureKey = getNpcTextureKey(npc.sprite, npc.direction);

      if (!this.textures.exists(textureKey)) {
        throw new Error(`NPC texture not found: ${textureKey}`);
      }

      const sprite = this.add.sprite(npc.x, npc.y, textureKey, 0);

      sprite.setDepth(5);

      const nameLabel = this.createPlayerNameLabel(npc.displayName);

      nameLabel.setPosition(Math.round(npc.x), Math.round(npc.y - 14));

      this.npcs.set(npc.id, {
        definition: npc,
        sprite,
        nameLabel,
      });
    }
  }

  private findNearbyNpc(): NpcInstance | undefined {
    let nearestNpc: NpcInstance | undefined;
    let nearestDistance = this.npcInteractionDistance;

    for (const npc of this.npcs.values()) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        npc.sprite.x,
        npc.sprite.y
      );

      if (distance <= nearestDistance) {
        nearestNpc = npc;
        nearestDistance = distance;
      }
    }

    return nearestNpc;
  }

  private handleNpcInteraction() {
    if (this.chatBox.isTyping()) {
      return;
    }

    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      return;
    }
    if (this.dialogueBox.isOpen()) {
      this.dialogueBox.advance();
      return;
    }
    if (!this.nearbyNpc) {
      return;
    }

    this.interactWithNpc(this.nearbyNpc);
  }

  public sendChatMessage(text: string): void {
    if (!this.socket.connected) {
      return;
    }
    const payload: ChatMessageInput = {
      text,
    };
    if (!isChatMessageInput(payload)) {
      return;
    }

    this.socket.emit(CHAT_EVENTS.SEND_MESSAGE, payload);
  }

  private handleChatMessageReceived(message: ChatMessage): void {
    const isOwnMessage = message.sender.playerId === this.socket.id;
    this.chatBox.addMessage(message, isOwnMessage);
  }

  private handleChatFocus(): void {
    if (this.chatBox.isTyping()) {
      return;
    }
    if (this.dialogueBox.isOpen()) {
      return;
    }
    if (!Phaser.Input.Keyboard.JustDown(this.chatKey)) {
      return;
    }

    this.chatBox.focusInput();
  }
}
