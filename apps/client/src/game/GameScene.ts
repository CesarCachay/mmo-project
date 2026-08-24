import Phaser from "phaser";

import { isChatMessageInput, DEFAULT_MAP_ID } from "@cesar-mmo/shared";

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
import { MAP_REGISTRY } from "./maps/mapRegistry";

// class managers
import { NpcManager } from "./npc/NpcManager";
import { MapManager } from "./maps/MapManager";
import { GameNetworkClient } from "./network/GameNetworkClient";
import { RemotePlayerManager } from "./player/RemotePlayerManager";
import { LocalPlayerController } from "./player/LocalPlayerController";
import { MapTransitionController } from "./maps/MapTransitionController";
import { MovementInputController } from "./player/MovementInputController";
import type { NpcDirection, NpcInstance, NpcInteractionType } from "./npc/types";

// types
import type {
  PlayerInput,
  PlayerAvatarId,
  ChatMessage,
  ChatMessageInput,
  MapId,
  MapTransitionInput,
  MapTransitionResolved,
} from "@cesar-mmo/shared";

export class GameScene extends Phaser.Scene {
  private currentMapId: MapId = DEFAULT_MAP_ID;

  private mapManager!: MapManager;
  private player!: Phaser.GameObjects.Sprite;
  private localPlayerController!: LocalPlayerController;
  private movementInputController!: MovementInputController;

  private interactKey!: Phaser.Input.Keyboard.Key;

  private chatKey!: Phaser.Input.Keyboard.Key;

  private network!: GameNetworkClient;

  private playerNameLabel?: Phaser.GameObjects.Text;

  private nearbyNpc?: NpcInstance;
  private activeDialogueNpc?: NpcInstance;
  private readonly npcInteractionDistance = 36;
  private npcInteractionPrompt?: Phaser.GameObjects.Text;

  private dialogueBox!: DialogueBox;

  private chatBox!: ChatBox;

  // managers
  private npcManager!: NpcManager;
  private remotePlayerManager!: RemotePlayerManager;
  private mapTransitionController!: MapTransitionController;

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
    // Assets and tilesets
    for (const mapConfig of Object.values(MAP_REGISTRY)) {
      this.load.tilemapTiledJSON(mapConfig.key, mapConfig.path);

      for (const tileset of mapConfig.tilesets) {
        if (!this.textures.exists(tileset.key)) {
          this.load.image(tileset.key, tileset.path);
        }
      }
    }

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
    this.mapManager = new MapManager(this);
    this.mapManager.create(this.currentMapId);

    this.createPlayerAnimations();
    this.createPlayer();
    this.localPlayerController = new LocalPlayerController(this.player, this.avatarId);

    this.mapTransitionController = new MapTransitionController(
      this,
      (transitionId) => this.requestMapTransition(transitionId),
      (transition) => this.handleMapTransitionResolved(transition),
      () => this.localPlayerController.setIdle()
    );
    this.mapTransitionController.loadZones(this.mapManager.map);

    this.remotePlayerManager = new RemotePlayerManager(this, (displayName) =>
      this.createPlayerNameLabel(displayName)
    );
    this.npcManager = new NpcManager(this, (displayName) =>
      this.createPlayerNameLabel(displayName)
    );

    this.npcManager.create(this.mapManager.map);
    this.createNpcInteractionPrompt();
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
    this.updateNpcInteractionPrompt();
    this.handleNpcInteraction();

    const input = this.movementInputController.getCurrentInput(
      this.isMovementInputBlocked()
    );
    this.localPlayerController.updateAnimation(input);
    this.sendInputIfChanged(input);
    this.localPlayerController.predictMovement(
      input,
      delta,
      this.currentMapId,
      this.isMapTransitioning
    );

    this.localPlayerController.reconcile(delta);

    this.remotePlayerManager.interpolate(delta);
    this.updateLocalPlayerNamePosition();
    this.mapTransitionController.update(this.player.x, this.player.y);
  }

  private createDialogueUi() {
    this.dialogueBox = new DialogueBox(this);
  }

  private createChatUi() {
    this.chatBox = new ChatBox(this, (text) => this.sendChatMessage(text));
  }

  private createPlayer() {
    const spawn = this.mapManager.getPlayerSpawn();

    this.player = this.add.sprite(
      spawn.x,
      spawn.y,
      getPlayerTextureKey(this.avatarId, "down"),
      0
    );

    this.player.setDepth(5);
  }

  private updateNearbyNpc() {
    const previousNpc = this.nearbyNpc;

    this.nearbyNpc = this.npcManager.findNearby(
      this.player.x,
      this.player.y,
      this.npcInteractionDistance
    );

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

    this.activeDialogueNpc = npc;
    this.facePlayerAndNpc(npc);
    this.chatBox.setVisible(false);
    this.dialogueBox.start(npc.definition.displayName, dialogue.lines);
  }

  private getFacingDirection(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    fallback: NpcDirection
  ): NpcDirection {
    const deltaX = targetX - fromX;
    const deltaY = targetY - fromY;

    if (deltaX === 0 && deltaY === 0) {
      return fallback;
    }
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? "right" : "left";
    }

    return deltaY > 0 ? "down" : "up";
  }

  private facePlayerAndNpc(npc: NpcInstance): void {
    const playerDirection = this.getFacingDirection(
      this.player.x,
      this.player.y,
      npc.sprite.x,
      npc.sprite.y,
      this.localPlayerController.direction
    );
    const npcDirection = this.getFacingDirection(
      npc.sprite.x,
      npc.sprite.y,
      this.player.x,
      this.player.y,
      npc.definition.direction
    );

    this.localPlayerController.setDirection(playerDirection);
    this.localPlayerController.setIdle();

    npc.sprite.anims.stop();
    npc.sprite.setTexture(getNpcTextureKey(npc.definition.sprite, npcDirection), 0);
  }

  private restoreActiveDialogueNpcDirection(): void {
    const npc = this.activeDialogueNpc;
    if (!npc) {
      return;
    }
    npc.sprite.anims.stop();
    npc.sprite.setTexture(
      getNpcTextureKey(npc.definition.sprite, npc.definition.direction),
      0
    );

    this.activeDialogueNpc = undefined;
  }

  private createControls() {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      throw new Error("Keyboard input is not available");
    }

    keyboard.enableGlobalCapture();
    this.movementInputController = new MovementInputController(keyboard);
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

  private sendInputIfChanged(input: PlayerInput) {
    const inputToSend = this.movementInputController.getChangedInput(input);
    if (!inputToSend) {
      return;
    }
    this.network.sendPlayerInput(inputToSend);
  }

  private connectToServer(): void {
    this.network = new GameNetworkClient(this.displayName, this.avatarId);

    this.network.onConnectionRejected((error) => {
      this.network.disconnect();

      this.scene.start("JoinScene", {
        errorMessage: error.message,
        displayName: this.displayName,
        avatarId: this.avatarId,
      });
    });

    this.network.onConnect((socketId) => {
      console.log("Connected:", socketId);
    });

    this.network.onChatMessage((message) => {
      this.handleChatMessageReceived(message);
    });

    this.network.onCurrentPlayers((players) => {
      console.log("Numero de players:", players);

      Object.values(players).forEach((player) => {
        if (player.id === this.network.id) {
          this.localPlayerController.snapToPosition(player.x, player.y);
          this.playerNameLabel = this.createPlayerNameLabel(player.displayName);
          return;
        }

        if (player.mapId !== this.currentMapId) {
          return;
        }

        this.remotePlayerManager.add(player);
      });
    });

    this.network.onPlayerJoined((player) => {
      if (player.mapId !== this.currentMapId) {
        return;
      }
      this.remotePlayerManager.add(player);
    });

    this.network.onPlayersState((players) => {
      Object.values(players).forEach((player) => {
        // LOCAL PLAYER
        if (player.id === this.network.id) {
          if (player.mapId !== this.currentMapId) {
            return;
          }
          this.localPlayerController.setServerPosition(player.x, player.y);
          return;
        }

        // REMOTE PLAYER DE OTRO MAPA
        if (player.mapId !== this.currentMapId) {
          this.remotePlayerManager.remove(player.id);
          return;
        }

        // REMOTE PLAYER DEL MISMO MAPA
        this.remotePlayerManager.update(player);
      });
    });

    this.network.onTransitionResolved((transition) => {
      this.mapTransitionController.handleResolved(transition, this.currentMapId);
    });

    this.network.onPlayerDisconnected((playerId) => {
      this.remotePlayerManager.remove(playerId);
    });

    this.network.onPlayerLeftMap((playerId) => {
      this.remotePlayerManager.remove(playerId);
    });
  }

  private handleMapTransitionResolved(transition: MapTransitionResolved): void {
    if (transition.fromMapId !== this.currentMapId) {
      return;
    }

    this.mapTransitionController.resetExitTracking();
    this.changeCurrentMap(transition.targetMapId);
    this.localPlayerController.snapToPosition(transition.x, transition.y);
    this.updateCameraBounds();
    this.movementInputController.resetLastInputToNeutral();
    this.localPlayerController.setIdle();
    this.updateLocalPlayerNamePosition();
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

  private updateCameraBounds(): void {
    const map = this.mapManager.map;
    const camera = this.cameras.main;

    const mapWidth = map.widthInPixels;
    const mapHeight = map.heightInPixels;
    const viewportWidth = camera.width / camera.zoom;
    const viewportHeight = camera.height / camera.zoom;

    const horizontalPadding = Math.max(0, (viewportWidth - mapWidth) / 2);
    const verticalPadding = Math.max(0, (viewportHeight - mapHeight) / 2);

    camera.setBounds(
      -horizontalPadding,
      -verticalPadding,
      mapWidth + horizontalPadding * 2,
      mapHeight + verticalPadding * 2
    );
  }

  private setupCamera(): void {
    this.updateCameraBounds();
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

  private handleNpcInteraction() {
    if (this.isMapTransitioning) {
      return;
    }
    if (this.chatBox.isTyping()) {
      return;
    }
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      return;
    }
    if (this.dialogueBox.isOpen()) {
      this.dialogueBox.advance();
      if (!this.dialogueBox.isOpen()) {
        this.restoreActiveDialogueNpcDirection();
        this.chatBox.setVisible(true);
      }
      return;
    }

    if (!this.nearbyNpc) {
      return;
    }

    const interactionPrompt = this.getNpcInteractionPromptText(
      this.nearbyNpc.definition.interactionType
    );
    if (!interactionPrompt) {
      return;
    }
    this.interactWithNpc(this.nearbyNpc);
  }

  private createNpcInteractionPrompt(): void {
    this.npcInteractionPrompt = this.add
      .text(40, 0, "", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#ffffff",
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        padding: {
          x: 5,
          y: 3,
        },
      })
      .setOrigin(0.5, 1)
      .setDepth(30)
      .setVisible(false)
      .setResolution(2);
  }

  private updateNpcInteractionPrompt(): void {
    const prompt = this.npcInteractionPrompt;
    if (!prompt) {
      return;
    }
    if (
      this.isMapTransitioning ||
      !this.nearbyNpc ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping()
    ) {
      prompt.setVisible(false);
      return;
    }
    const npc = this.nearbyNpc;

    const promptText = this.getNpcInteractionPromptText(npc.definition.interactionType);
    if (!promptText) {
      prompt.setVisible(false);
      return;
    }

    prompt
      .setText(promptText)
      .setPosition(Math.round(npc.sprite.x), Math.round(npc.sprite.y - 28))
      .setVisible(true);
  }

  private getNpcInteractionPromptText(
    interactionType: NpcInteractionType
  ): string | undefined {
    switch (interactionType) {
      case "dialogue":
        return "[E] Hablar";

      case "shop":
      case "quest":
        return undefined;
    }
  }

  public sendChatMessage(text: string): void {
    if (!this.network.connected) {
      return;
    }
    const payload: ChatMessageInput = {
      text,
    };
    if (!isChatMessageInput(payload)) {
      return;
    }

    this.network.sendChatMessage(payload);
  }

  private handleChatMessageReceived(message: ChatMessage): void {
    const isOwnMessage = message.sender.playerId === this.network.id;
    this.chatBox.addMessage(message, isOwnMessage);
  }

  private handleChatFocus(): void {
    if (this.isMapTransitioning) {
      return;
    }
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

  private requestMapTransition(transitionId: string): void {
    if (this.isMapTransitioning) {
      return;
    }
    const payload: MapTransitionInput = {
      transitionId,
    };
    this.network.requestMapTransition(payload);
  }

  private destroyCurrentMap(): void {
    this.nearbyNpc = undefined;
    this.npcManager.destroy();
    this.mapTransitionController.clearZones();
    this.mapManager.destroy();
  }

  private changeCurrentMap(mapId: MapId): void {
    if (mapId === this.currentMapId) {
      return;
    }

    this.destroyCurrentMap();
    this.remotePlayerManager.clear();

    this.currentMapId = mapId;
    this.mapManager.create(this.currentMapId);
    this.mapTransitionController.loadZones(this.mapManager.map);
    this.npcManager.create(this.mapManager.map);
  }

  private get isMapTransitioning(): boolean {
    return this.mapTransitionController.isTransitioning;
  }

  private isMovementInputBlocked(): boolean {
    return (
      this.isMapTransitioning || this.dialogueBox.isOpen() || this.chatBox.isTyping()
    );
  }
}
