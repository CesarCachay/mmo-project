import Phaser from "phaser";
import {
  isChatMessageInput,
  DEFAULT_MAP_ID,
  getDialogue,
  isPlayerMoving,
  POKEMON_ITEM_REGISTRY,
  MAP_DATA_REGISTRY,
} from "@cesar-mmo/shared";
import {
  GAME_SCENE_KEY,
  WORLD_BOOT_ABORTED_EVENT,
  WORLD_READY_EVENT,
} from "./world/world-loading.contract";
import type { WorldEntryData, WorldReadyPayload } from "./world/world-loading.contract";

// assets
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
import { POKEMON_STARTER_ASSETS } from "./pokemon/pokemon-starter-assets";
import { PokemonSpriteLoader } from "./pokemon/PokemonSpriteLoader";
import { PokemonOverworldSpriteLoader } from "./pokemon/PokemonOverworldSpriteLoader";
import { getPokemonItemIconAsset } from "./items/pokemon-item-icon.registry";

// ui components
import { ChatDock } from "./ui/ChatDock";
import { DialogueBox } from "./ui/DialogueBox";
import { VirtualJoystick } from "./mobile/VirtualJoystick";
import { StarterSelectionPanel } from "./ui/StarterSelectionPanel";
import { TrainerHudNavigationController } from "./ui/TrainerHudNavigationController";
import { MobileGameplayUxController } from "./mobile/MobileGameplayUxController";

// helpers
import { MapAssetLoader } from "./maps/MapAssetLoader";

// movement (touch and keyboard)
import { MovementInputController } from "./player/MovementInputController";
import { KeyboardMovementInputSource } from "./input/KeyboardMovementInputSource";
import { TouchMovementInputSource } from "./input/TouchMovementInputSource";
import { CompositeMovementInputSource } from "./input/CompositeMovementInputSource";
import { WorldInteractionControlsController } from "./interaction/WorldInteractionControlsController";

// class managers
import { NpcManager } from "./npc/NpcManager";
import { MapManager } from "./maps/MapManager";
import { GameNetworkClient } from "./network/GameNetworkClient";
import { RemotePlayerManager } from "./player/RemotePlayerManager";
import { LocalPlayerController } from "./player/LocalPlayerController";
import { MapTransitionController } from "./maps/MapTransitionController";
import type { NpcDirection, NpcInstance } from "./npc/types";
import { RemotePokemonFollowerManager } from "./pokemon/RemotePokemonFollowerManager";
import { OverworldCameraController } from "./camera/OverworldCameraController";
import { TrainerPanelController } from "./ui/TrainerPanelController";
import { PokemonTrainerPresentationController } from "./pokemon/PokemonTrainerPresentationController";
import { TrainerSightController } from "./trainer-battle/TrainerSightController";
import { TrainerPreBattleController } from "./trainer-battle/TrainerPreBattleController";

// controllers
import { LazyBattleController } from "./battle/LazyBattleController";
import { PokemonStorageController } from "./storage/PokemonStorageController";
import { PokemonStorageTerminalInteractionController } from "./storage/PokemonStorageTerminalInteractionController";
import { PokemonShopController } from "./shop/PokemonShopController";
import { PokemonCenterHealingInteractionController } from "./pokemon-center/PokemonCenterHealingInteractionController";
import { PokemonCenterHealingPresentationController } from "./pokemon-center/PokemonCenterHealingPresentationController";
import { PokemonCenterHealingWorldFxController } from "./pokemon-center/PokemonCenterHealingWorldFxController";
import {
  POKEMON_CENTER_HEALING_AUDIO_KEYS,
  PokemonCenterHealingAudioController,
} from "./pokemon-center/PokemonCenterHealingAudioController";

// stores
import { selectedTrainerStore } from "../account/selected-trainer.store";
import { setAccountShellTrainerContext } from "../account/account-shell.controller";
import { initializeGameTopBar } from "../shell/GameTopBarController";

// types
import type {
  Player,
  PlayerInput,
  PlayerAvatarId,
  ChatMessage,
  ChatMessageInput,
  MapId,
  MapTransitionInput,
  MapTransitionResolved,
  DialogueSessionState,
  PokemonWildEncounterStartedPayload,
  PokemonBattleCompletedPayload,
} from "@cesar-mmo/shared";

type MapTransitionDefinition = Readonly<{
  targetMapId: MapId;
}>;

export class GameScene extends Phaser.Scene {
  private currentMapId: MapId = DEFAULT_MAP_ID;
  private hasAppliedInitialWorldState = false;

  private mapManager!: MapManager;
  private mapAssetLoader!: MapAssetLoader;
  private mapTransitionRequestPromise?: Promise<void>;
  private blackoutRecoveryPending = false;
  private blackoutRecoveryTimeout?: Phaser.Time.TimerEvent;
  private defeatedTrainerBattleIds = new Set<string>();
  private networkDisconnected = false;
  private player!: Phaser.GameObjects.Sprite;
  private localPlayerController!: LocalPlayerController;
  private movementInputController!: MovementInputController;
  private touchMovementInputSource!: TouchMovementInputSource;
  private virtualJoystick?: VirtualJoystick;
  private overworldCameraController!: OverworldCameraController;
  private trainerPanelController!: TrainerPanelController;
  private trainerHudNavigation!: TrainerHudNavigationController;
  private mobileGameplayUx?: MobileGameplayUxController;

  private worldInteractionControls!: WorldInteractionControlsController;
  private chatKey!: Phaser.Input.Keyboard.Key;

  private network!: GameNetworkClient;

  private nearbyNpc?: NpcInstance;
  private activeDialogueNpc?: NpcInstance;
  private readonly npcInteractionDistance = 36;

  private dialogueBox!: DialogueBox;
  private pendingDialogueNpc?: NpcInstance;
  private activeDialogueSessionId?: string;
  private isDialogueAdvancePending = false;

  private chatBox!: ChatDock;

  private starterSelectionPanel!: StarterSelectionPanel;

  private pokemonSpriteLoader!: PokemonSpriteLoader;

  private pokemonOverworldSpriteLoader!: PokemonOverworldSpriteLoader;

  private battleController!: LazyBattleController;

  private pokemonStorageController!: PokemonStorageController;
  private pokemonShopController!: PokemonShopController;
  private pokemonStorageTerminalInteraction!: PokemonStorageTerminalInteractionController;

  private pokemonCenterHealingInteraction!: PokemonCenterHealingInteractionController;
  private pokemonCenterHealingPresentation!: PokemonCenterHealingPresentationController;
  private pokemonCenterHealingWorldFx!: PokemonCenterHealingWorldFxController;
  private pokemonCenterHealingAudio!: PokemonCenterHealingAudioController;

  // managers
  private npcManager!: NpcManager;
  private trainerSightController!: TrainerSightController;
  private trainerPreBattleController!: TrainerPreBattleController;
  private remotePlayerManager!: RemotePlayerManager;
  private mapTransitionController!: MapTransitionController;
  private remotePokemonFollowerManager!: RemotePokemonFollowerManager;
  private pokemonTrainerPresentationController!: PokemonTrainerPresentationController;

  private avatarId: PlayerAvatarId = "male-01";

  constructor() {
    super(GAME_SCENE_KEY);
  }

  init(data: WorldEntryData): void {
    this.currentMapId = DEFAULT_MAP_ID;
    this.avatarId = data.avatarId;
    this.hasAppliedInitialWorldState = false;
    this.networkDisconnected = false;
  }

  preload(): void {
    this.mapAssetLoader = new MapAssetLoader(this);

    this.mapAssetLoader.queueForScenePreload(this.currentMapId);

    // Items icons
    for (const item of Object.values(POKEMON_ITEM_REGISTRY)) {
      const asset = getPokemonItemIconAsset(item.id);

      if (!this.textures.exists(asset.textureKey)) {
        this.load.image(asset.textureKey, asset.path);
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

    // audio - pokecenter
    this.load.audio(
      POKEMON_CENTER_HEALING_AUDIO_KEYS.STEP,
      "/assets/audio/pokemon-center/heal-step.wav"
    );
    this.load.audio(
      POKEMON_CENTER_HEALING_AUDIO_KEYS.COMPLETE,
      "/assets/audio/pokemon-center/heal-complete.wav"
    );

    // Pokemon Starter Assets
    Object.values(POKEMON_STARTER_ASSETS).forEach((asset) => {
      this.load.image(asset.textureKey, asset.path);
    });
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.hasAppliedInitialWorldState) {
        this.game.events.emit(WORLD_BOOT_ABORTED_EVENT);
      }
    });

    this.mapManager = new MapManager(this);
    this.mapManager.create(this.currentMapId);

    this.syncGameTopBar();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      initializeGameTopBar().clearWorldContext();
      setAccountShellTrainerContext(undefined);
    });

    this.installAudioUnlock();
    this.createPlayerAnimations();
    this.createPlayer();
    this.localPlayerController = new LocalPlayerController(this.player, this.avatarId);

    this.mapTransitionController = new MapTransitionController(
      this,
      (transitionId) => this.requestMapTransition(transitionId),
      (transition) => this.handleMapTransitionResolved(transition),
      () => this.localPlayerController.setIdle(),
      (transitionId) => this.prefetchMapTransitionDestination(transitionId)
    );
    this.mapTransitionController.loadZones(this.mapManager.map);

    this.remotePlayerManager = new RemotePlayerManager(this, (displayName) =>
      this.createPlayerNameLabel(displayName)
    );
    this.npcManager = new NpcManager(this, (displayName) =>
      this.createPlayerNameLabel(displayName)
    );

    this.npcManager.create(this.mapManager.map);

    this.trainerSightController = new TrainerSightController(
      this,
      this.npcManager,
      (npc) => this.handleTrainerAggroReady(npc),
    );
    this.trainerSightController.setDefeatedTrainerBattleIds(
      [...this.defeatedTrainerBattleIds],
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.trainerSightController.destroy();
    });

    this.trainerPreBattleController = new TrainerPreBattleController(this, {
      requestDialogue: (npc) => this.startNpcDialogue(npc),
      onReady: (npc) => this.handleTrainerPreBattleReady(npc),
      onCancelled: (npc, reason) =>
        this.handleTrainerPreBattleCancelled(npc, reason),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.trainerPreBattleController.destroy();
    });

    this.overworldCameraController = new OverworldCameraController(
      this.cameras.main,
      this.player,
      this.scale
    );
    this.setupCamera();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overworldCameraController.destroy();
    });

    this.createDialogueUi();
    this.createChatUi();
    this.createStarterSelectionUi();

    this.pokemonStorageTerminalInteraction =
      new PokemonStorageTerminalInteractionController(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pokemonStorageTerminalInteraction.destroy();
    });

    this.pokemonCenterHealingWorldFx = new PokemonCenterHealingWorldFxController(this);
    this.pokemonCenterHealingAudio = new PokemonCenterHealingAudioController(this);

    this.pokemonCenterHealingPresentation =
      new PokemonCenterHealingPresentationController(this, {
        onHealingStep: (stepNumber, totalSteps) => {
          this.pokemonCenterHealingWorldFx.pulseStep(stepNumber, totalSteps);
          this.pokemonCenterHealingAudio.playStep(stepNumber, totalSteps);
        },
        onHealingSuccessReveal: () => {
          this.pokemonCenterHealingWorldFx.complete();
          this.pokemonCenterHealingAudio.playComplete();
        },
      });
    this.pokemonCenterHealingInteraction = new PokemonCenterHealingInteractionController(
      this,
      {
        onHealRequested: (healingStationId: string) => {
          this.sound.unlock();
          this.pokemonCenterHealingWorldFx.begin(this.currentMapId, healingStationId);
          this.pokemonCenterHealingPresentation.beginHealing();
          this.network.requestPokemonCenterHealing(healingStationId);
        },
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pokemonCenterHealingInteraction.destroy();
      this.pokemonCenterHealingPresentation.destroy();
      this.pokemonCenterHealingWorldFx.destroy();
      this.pokemonCenterHealingAudio.destroy();
    });

    this.createPokemonPresentation();
    this.createBattleUi();

    this.createControls();
    this.createMobileControls();
    this.connectToServer();
  }

  update(_: number, delta: number) {
    this.trainerPanelController.update();
    this.trainerHudNavigation.update();

    this.handleChatFocus();

    this.updateTrainerSight();
    this.updateNearbyNpc();

    this.updatePokemonCenterHealingStation();
    this.updatePokemonStorageTerminal();

    this.updateWorldInteractionControls();
    this.handleWorldInteraction();

    const movementInputBlocked = this.isMovementInputBlocked();

    this.virtualJoystick?.setEnabled(!movementInputBlocked);

    const input = this.movementInputController.getCurrentInput(movementInputBlocked);

    this.localPlayerController.updateAnimation(input);
    this.sendInputIfChanged(input);

    const playerIsMoving = isPlayerMoving(input);

    this.localPlayerController.predictMovement(
      input,
      delta,
      this.currentMapId,
      this.isMapTransitioning
    );
    this.localPlayerController.reconcile(delta, playerIsMoving);
    this.overworldCameraController.update(
      delta,
      this.localPlayerController.direction,
      playerIsMoving
    );

    this.pokemonTrainerPresentationController.updateFollower(
      this.player.x,
      this.player.y,
      this.localPlayerController.direction,
      delta
    );

    this.remotePlayerManager.interpolate(delta);
    this.remotePokemonFollowerManager.update(delta);
    this.mapTransitionController.update(this.player.x, this.player.y);
  }

  private createDialogueUi() {
    this.dialogueBox = new DialogueBox(this);
  }

  private createChatUi(): void {
    this.chatBox = new ChatDock(this, (text) => this.sendChatMessage(text));
  }

  private createStarterSelectionUi(): void {
    this.starterSelectionPanel = new StarterSelectionPanel(this, {
      onSelect: (starterId) => {
        this.network.chooseStarter(starterId);
      },
    });
  }

  private createBattleUi(): void {
    this.battleController = new LazyBattleController(
      this,
      this.pokemonSpriteLoader,
      (input) => {
        this.network.sendBattleCommand(input);
      },
      (input) => {
        this.network.sendBattleReplacement(input);
      },
      (input) => {
        this.network.sendPokemonMoveLearningDecision(input);
      },
      (input) => {
        this.network.sendPokemonEvolutionDecision(input);
      },
      (payload) => {
        this.handleBattleCompletionAcknowledged(payload);
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearBlackoutRecoveryPending();
      this.battleController.destroy();
    });
  }

  private createPokemonStorageUi(): void {
    this.pokemonStorageController = new PokemonStorageController({
      openStorage: (terminalId) => {
        this.network.openPokemonStorage(terminalId);
      },
      closeStorage: () => {
        this.network.closePokemonStorage();
      },
      sendCommand: (command) => {
        this.network.sendPokemonStorageCommand(command);
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pokemonStorageController.destroy();
    });
  }

  private createPokemonShopUi(): void {
    this.pokemonShopController = new PokemonShopController({
      openShop: (npcId) => {
        this.network.openPokemonShop(npcId);
      },
      buyItem: (input) => {
        this.network.buyPokemonShopItem(input);
      },
      sellItem: (input) => {
        this.network.sellPokemonShopItem(input);
      },
      closeShop: (sessionId) => {
        this.network.closePokemonShop(sessionId);
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pokemonShopController.destroy();
    });
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

  private updateTrainerSight(): void {
    const externallyBlocked =
      !this.hasAppliedInitialWorldState ||
      this.networkDisconnected ||
      Boolean(this.mapTransitionRequestPromise) ||
      this.blackoutRecoveryPending ||
      this.isMapTransitioning ||
      this.trainerPreBattleController?.isBlockingGameplay ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isOpen ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
      this.pokemonShopController?.isBlockingGameplay ||
      this.pokemonCenterHealingInteraction?.isPending ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay;

    /*
     * Trainer sight is a server-authoritative gameplay gate. In mobile the
     * virtual joystick can predict the local sprite a few pixels ahead of the
     * server position. If sight uses the predicted sprite, the client may show
     * the alert and request dialogue while the server still sees the player
     * outside the lane/range, producing a dialogue-start-timeout.
     *
     * Use the latest server position for detection so the alert and the
     * server's dialogue validation are based on the same coordinates. Visual
     * movement continues to use prediction/reconciliation normally.
     */
    const trainerSightPosition =
      this.localPlayerController.authoritativePosition;

    this.trainerSightController.update(
      this.currentMapId,
      trainerSightPosition.x,
      trainerSightPosition.y,
      Boolean(externallyBlocked),
    );
  }

  private handleTrainerAggroReady(npc: NpcInstance): void {
    if (
      this.isTrainerNpcDefeated(npc) ||
      this.trainerPreBattleController.isBlockingGameplay ||
      this.pendingDialogueNpc ||
      this.activeDialogueNpc ||
      this.dialogueBox.isOpen()
    ) {
      return;
    }

    /*
     * Stop touch movement immediately before opening the Trainer pre-battle
     * handshake. This sends a neutral input before dialogue:start retries and
     * prevents the server from advancing another analogue movement tick while
     * the client is showing the alert/dialogue transition.
     */
    this.virtualJoystick?.reset();
    this.touchMovementInputSource.reset();

    const neutralInput = this.movementInputController.getCurrentInput(true);
    this.sendInputIfChanged(neutralInput);
    this.localPlayerController.setIdle();

    this.facePlayerAndNpc(npc);
    this.chatBox.setVisible(false);

    this.trainerPreBattleController.begin(npc);
  }

  private handleTrainerPreBattleReady(npc: NpcInstance): void {
    this.network.startTrainerBattle(npc.definition.id);

    console.log("[TrainerPreBattle] Trainer Battle start requested", {
      npcId: npc.definition.id,
      trainerBattleId: npc.definition.trainerBattleId,
    });
  }

  private handleTrainerPreBattleCancelled(
    npc: NpcInstance,
    reason: string,
  ): void {
    this.network.cancelDialogue();

    if (this.pendingDialogueNpc?.definition.id === npc.definition.id) {
      this.pendingDialogueNpc = undefined;
    }

    this.restoreNpcDirection(npc);
    this.chatBox.setVisible(true);

    console.warn("[TrainerPreBattle] cancelled", {
      npcId: npc.definition.id,
      trainerBattleId: npc.definition.trainerBattleId,
      reason,
    });
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
        this.trainerPanelController.close();
        this.pokemonShopController.requestOpen(npc.definition.id);
        return;

      case "quest":
        console.warn("Quest interactions are not implemented yet");
        return;

      case "trainer-battle":
        if (this.isTrainerNpcDefeated(npc)) {
          this.startNpcDialogue(npc);
          return;
        }

        console.warn(
          `Trainer battle interaction starts through sight/aggro: ${npc.definition.trainerBattleId ?? npc.definition.id}`,
        );
        return;
    }
  }

  private isTrainerNpcDefeated(npc: NpcInstance): boolean {
    const trainerBattleId = npc.definition.trainerBattleId;

    return Boolean(
      trainerBattleId &&
        this.defeatedTrainerBattleIds.has(trainerBattleId),
    );
  }

  private startNpcDialogue(npc: NpcInstance): boolean {
    if (this.activeDialogueNpc) {
      return this.activeDialogueNpc.definition.id === npc.definition.id;
    }

    if (this.pendingDialogueNpc) {
      if (this.pendingDialogueNpc.definition.id !== npc.definition.id) {
        return false;
      }

      /*
       * Idempotent retry for Trainer pre-battle dialogue. If the first START
       * was rejected because the authoritative position advanced between the
       * sight snapshot and request processing, re-send it for the same NPC.
       */
      this.network.startDialogue(npc.definition.id);
      return true;
    }

    this.pendingDialogueNpc = npc;
    this.network.startDialogue(npc.definition.id);
    return true;
  }

  private handleDialogueState(state: DialogueSessionState): void {
    const npc = this.activeDialogueNpc ?? this.pendingDialogueNpc;

    if (!npc) {
      return;
    }

    if (npc.definition.id !== state.npcId) {
      return;
    }

    if (
      this.activeDialogueSessionId &&
      this.activeDialogueSessionId !== state.sessionId
    ) {
      return;
    }

    this.isDialogueAdvancePending = false;

    if (state.completed) {
      const isTrainerPreBattle =
        this.trainerPreBattleController.isActiveFor(npc.definition.id);

      this.dialogueBox.hide();
      this.activeDialogueSessionId = undefined;
      this.pendingDialogueNpc = undefined;

      if (isTrainerPreBattle) {
        this.activeDialogueNpc = undefined;
        this.chatBox.setVisible(false);
        this.trainerPreBattleController.complete(npc.definition.id);
        return;
      }

      this.restoreActiveDialogueNpcDirection();
      this.chatBox.setVisible(true);
      return;
    }

    const dialogue = getDialogue(state.dialogueId);
    if (!dialogue) {
      console.warn(`Dialogue not found: ${state.dialogueId}`);
      return;
    }

    const line = dialogue.lines[state.lineIndex];
    if (line === undefined) {
      console.warn(`Dialogue line ${state.lineIndex} not found for ${state.dialogueId}`);
      return;
    }

    this.trainerPreBattleController.markDialogueStarted(npc.definition.id);

    if (!this.activeDialogueNpc) {
      this.activeDialogueNpc = npc;
      this.pendingDialogueNpc = undefined;
      this.facePlayerAndNpc(npc);
      this.chatBox.setVisible(false);
    }

    this.activeDialogueSessionId = state.sessionId;
    const isLastLine = state.lineIndex >= state.lineCount - 1;
    this.dialogueBox.showLine(npc.definition.displayName, line, isLastLine);
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

    this.restoreNpcDirection(npc);
    this.activeDialogueNpc = undefined;
  }

  private restoreNpcDirection(npc: NpcInstance): void {
    npc.sprite.anims.stop();
    npc.sprite.setTexture(
      getNpcTextureKey(npc.definition.sprite, npc.definition.direction),
      0
    );
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      throw new Error("Keyboard input is not available");
    }

    keyboard.enableGlobalCapture();

    const app = document.getElementById("app");

    if (!(app instanceof HTMLElement)) {
      throw new Error('World interaction controls require "#app"');
    }

    this.mobileGameplayUx = new MobileGameplayUxController(app);

    this.worldInteractionControls = new WorldInteractionControlsController({
      keyboard,
      parent: app,
    });

    const keyboardMovementInputSource = new KeyboardMovementInputSource(keyboard);
    this.touchMovementInputSource = new TouchMovementInputSource();

    const compositeMovementInputSource = new CompositeMovementInputSource([
      keyboardMovementInputSource,
      this.touchMovementInputSource,
    ]);

    this.movementInputController = new MovementInputController(
      compositeMovementInputSource
    );

    this.chatKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.worldInteractionControls.destroy();
      this.touchMovementInputSource.reset();
      this.mobileGameplayUx?.destroy();
      this.mobileGameplayUx = undefined;
    });
  }

  private createMobileControls(): void {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLElement)) {
      throw new Error('Mobile controls require "#app"');
    }

    this.virtualJoystick = new VirtualJoystick({
      parent: app,

      onChange: (state) => {
        this.touchMovementInputSource.setState(state);
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.virtualJoystick?.destroy();
      this.virtualJoystick = undefined;
      this.touchMovementInputSource.reset();
    });
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

  private createPokemonPresentation(): void {
    this.pokemonSpriteLoader = new PokemonSpriteLoader(this);
    this.pokemonOverworldSpriteLoader = new PokemonOverworldSpriteLoader(this);
    this.remotePokemonFollowerManager = new RemotePokemonFollowerManager(
      this,
      this.pokemonOverworldSpriteLoader,
      (playerId) => this.remotePlayerManager.getRenderPosition(playerId)
    );
    this.trainerPanelController = new TrainerPanelController(this, {
      isInteractionBlocked: () =>
        Boolean(this.pokemonStorageController?.isBlockingGameplay) ||
        Boolean(this.pokemonShopController?.isBlockingGameplay) ||
        Boolean(this.pokemonCenterHealingInteraction?.isPending) ||
        Boolean(this.pokemonCenterHealingPresentation?.isBlockingGameplay) ||
        Boolean(this.battleController?.isBlockingGameplay) ||
        this.isTrainerInteractionBlocking ||
        this.isMapTransitioning ||
        this.dialogueBox.isOpen() ||
        this.chatBox.isTyping() ||
        this.starterSelectionPanel.isVisible(),
      onUseOverworldItem: (input) => {
        this.network.usePokemonOverworldItem(input);
      },
      onReorderParty: (input) => {
        this.network.reorderPokemonParty(input);
      },
    });
    this.trainerHudNavigation = new TrainerHudNavigationController(
      this.trainerPanelController
    );
    this.pokemonTrainerPresentationController = new PokemonTrainerPresentationController(
      this,
      {
        pokemonSpriteLoader: this.pokemonSpriteLoader,
        pokemonOverworldSpriteLoader: this.pokemonOverworldSpriteLoader,
        trainerPanelController: this.trainerPanelController,
        getPlayerPresentationState: () => ({
          x: this.player.x,
          y: this.player.y,
          direction: this.localPlayerController.direction,
        }),
        onPartyPresenceChanged: (hasParty) => {
          this.trainerHudNavigation.setVisible(hasParty);
          this.starterSelectionPanel.setSelectionPending(false);

          if (!hasParty) {
            return;
          }

          this.starterSelectionPanel.hide();
          this.chatBox.setVisible(true);
        },
      }
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pokemonTrainerPresentationController.destroy();
      this.trainerHudNavigation.destroy();
    });
  }

  private sendInputIfChanged(input: PlayerInput) {
    if (this.networkDisconnected) {
      return;
    }

    const inputToSend = this.movementInputController.getChangedInput(input);
    if (!inputToSend) {
      return;
    }
    this.network.sendPlayerInput(inputToSend);
  }

  private connectToServer(): void {
    const selectedTrainer = selectedTrainerStore.getSelected();

    if (!selectedTrainer) {
      this.scene.start("TrainerSelectionScene", {
        errorMessage: "Debes seleccionar un Trainer antes de entrar al mundo.",
      });

      return;
    }

    this.network = new GameNetworkClient({
      selectedTrainerId: selectedTrainer?.trainerId,
    });

    this.createPokemonStorageUi();
    this.createPokemonShopUi();

    this.network.onConnectionRejected((error) => {
      this.network.destroy();

      if (error.code === "ACCOUNT_SESSION_REQUIRED") {
        selectedTrainerStore.clear();
        this.scene.start("AccountLoginScene");
        return;
      }

      selectedTrainerStore.clear();

      this.scene.start("TrainerSelectionScene", {
        errorMessage: error.message,
      });
    });

    this.network.onConnect((socketId) => {
      /*
       * On a reconnect we keep gameplay paused until currentPlayers applies
       * the fresh authoritative map/position snapshot. Initial connections
       * start with networkDisconnected=false and are already gated by
       * hasAppliedInitialWorldState.
       */
      console.log("Connected:", socketId);
    });

    this.network.onDisconnect((reason) => {
      this.handleNetworkDisconnected(reason);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.network.destroy();
    });

    this.network.onChatMessage((message) => {
      this.handleChatMessageReceived(message);
    });

    this.network.onDialogueState((state) => {
      this.handleDialogueState(state);
    });

    this.network.onPokemonTrainerState((payload) => {
      this.defeatedTrainerBattleIds = new Set(
        payload.trainerState.defeatedTrainerBattleIds ?? [],
      );
      this.trainerSightController?.setDefeatedTrainerBattleIds(
        [...this.defeatedTrainerBattleIds],
      );

      this.battleController.setTrainerState(payload.trainerState);
      void this.pokemonTrainerPresentationController.applyTrainerState(
        payload.trainerState
      );
    });

    this.network.onPokemonPartyReordered((payload) => {
      this.trainerPanelController.handlePokemonPartyReordered(payload);
    });

    this.network.onPokemonPartyReorderError((payload) => {
      this.trainerPanelController.handlePokemonPartyReorderError(payload);
    });

    this.network.onPokemonOverworldItemUsed((payload) => {
      void this.trainerPanelController.handleOverworldItemUsed(payload);
    });

    this.network.onPokemonOverworldItemError((payload) => {
      this.trainerPanelController.handleOverworldItemError(payload);
    });

    this.network.onPokemonCenterHealed((payload) => {
      this.pokemonCenterHealingInteraction.completeRequest();
      this.pokemonCenterHealingPresentation.presentSuccess(payload);
    });

    this.network.onPokemonCenterHealingError((payload) => {
      this.pokemonCenterHealingInteraction.completeRequest();
      this.pokemonCenterHealingWorldFx.cancel();
      this.pokemonCenterHealingAudio.cancel();
      this.pokemonCenterHealingPresentation.presentError(payload);
    });

    this.network.onStarterSelectionStatus((status) => {
      if (!status.unlocked) {
        return;
      }
      if (!this.pokemonTrainerPresentationController.canChooseStarter) {
        return;
      }

      this.chatBox.setVisible(false);
      this.trainerPanelController.close();
      this.starterSelectionPanel.show();
    });

    this.network.onWildEncounterStarted((payload) => {
      this.handleWildEncounterStarted(payload);
    });

    this.network.onBattleStarted((payload) => {
      const preBattleNpc = this.trainerPreBattleController.markBattleStarted();

      if (preBattleNpc) {
        this.restoreNpcDirection(preBattleNpc);
        this.chatBox.setVisible(true);
      }

      this.trainerPanelController.close();
      this.pokemonStorageController?.dismiss();
      this.pokemonShopController?.dismiss();
      void this.battleController.start(payload);
    });

    this.network.onBattleTurnResolved((payload) => {
      this.battleController.enqueueTurnPresentation(payload);
    });

    this.network.onBattleStateUpdated((payload) => {
      void this.battleController.applyStateUpdate(payload);
    });

    this.network.onBattleReplacementResolved((payload) => {
      void this.battleController.applyReplacement(payload);
    });

    this.network.onPokemonMoveLearningResolved((payload) => {
      this.battleController.applyMoveLearningResolved(payload);
    });

    this.network.onPokemonMoveLearningError((payload) => {
      this.battleController.applyMoveLearningError(payload);
    });

    this.network.onPokemonEvolutionRequired((payload) => {
      this.battleController.applyEvolutionRequired(payload);
    });

    this.network.onPokemonEvolutionResolved((payload) => {
      this.battleController.applyEvolutionResolved(payload);
    });

    this.network.onPokemonEvolutionError((payload) => {
      this.battleController.applyEvolutionError(payload);
    });

    this.network.onBattleCompleted((payload) => {
      this.battleController.complete(payload);
    });

    this.network.onPokemonStorageState((payload) => {
      this.pokemonStorageController.applyState(payload);
    });

    this.network.onPokemonStorageError((payload) => {
      console.warn("[PokemonStorage] authoritative error", payload);
      this.pokemonStorageController.applyError(payload);
    });

    this.network.onPokemonShopOpened((payload) => {
      this.trainerPanelController.close();
      this.pokemonShopController.applyOpened(payload);
    });

    this.network.onPokemonShopPurchased((payload) => {
      this.pokemonShopController.applyPurchased(payload);
    });

    this.network.onPokemonShopSold((payload) => {
      this.pokemonShopController.applySold(payload);
    });

    this.network.onPokemonShopClosed((payload) => {
      this.pokemonShopController.applyClosed(payload);
    });

    this.network.onPokemonShopError((payload) => {
      this.pokemonShopController.applyError(payload);
    });

    this.network.onCurrentPlayers((players) => {
      void this.handleCurrentPlayers(players);
    });

    this.network.onPlayerJoined((player) => {
      if (player.mapId !== this.currentMapId) {
        return;
      }
      this.remotePlayerManager.add(player);
      this.remotePokemonFollowerManager.sync(player);
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
        this.remotePokemonFollowerManager.sync(player);
      });
    });

    this.network.onTransitionResolved((transition) => {
      this.mapTransitionController.handleResolved(transition, this.currentMapId);
    });

    this.network.onPlayerDisconnected((playerId) => {
      this.remotePlayerManager.remove(playerId);
      this.remotePokemonFollowerManager.remove(playerId);
    });

    this.network.onPlayerLeftMap((playerId) => {
      this.remotePlayerManager.remove(playerId);
      this.remotePokemonFollowerManager.remove(playerId);
    });
  }

  private handleNetworkDisconnected(reason: string): void {
    if (!this.sys.isActive() || this.networkDisconnected) {
      return;
    }

    this.networkDisconnected = true;

    const preBattleNpc = this.trainerPreBattleController?.currentNpc;
    if (preBattleNpc) {
      this.restoreNpcDirection(preBattleNpc);
    }

    if (this.activeDialogueNpc) {
      this.restoreNpcDirection(this.activeDialogueNpc);
    }

    this.trainerPreBattleController?.clear();
    this.trainerSightController?.clear();

    this.pendingDialogueNpc = undefined;
    this.activeDialogueNpc = undefined;
    this.activeDialogueSessionId = undefined;
    this.isDialogueAdvancePending = false;
    this.dialogueBox?.hide();

    this.clearBlackoutRecoveryPending();
    this.battleController?.resetRuntime(`socket-disconnected:${reason}`);
    this.trainerPanelController?.close();
    this.pokemonStorageController?.dismiss();
    this.pokemonShopController?.dismiss();
    this.pokemonCenterHealingPresentation?.cancel();
    this.pokemonCenterHealingInteraction?.clear();
    this.pokemonCenterHealingWorldFx?.cancel();
    this.pokemonCenterHealingAudio?.cancel();

    this.movementInputController?.resetLastInputToNeutral();
    this.virtualJoystick?.reset();
    this.localPlayerController?.setIdle();
    this.worldInteractionControls?.hide();
    this.chatBox?.setVisible(true);

    console.warn("[GameNetwork] connection lost; gameplay paused", { reason });
  }

  private async applyInitialAuthoritativePlayerState(player: Player): Promise<void> {
    if (player.mapId !== this.currentMapId) {
      await this.mapAssetLoader.ensureMapLoaded(player.mapId);

      this.changeCurrentMap(player.mapId);
    }

    this.localPlayerController.setDirection(player.direction);

    this.localPlayerController.snapToPosition(player.x, player.y);

    this.pokemonTrainerPresentationController.resetFollowerToPlayerPosition(
      player.x,
      player.y,
      player.direction
    );

    this.mapTransitionController.resetExitTracking();

    this.overworldCameraController.resetForMap(this.currentMapId, this.mapManager.map);

    this.movementInputController.resetLastInputToNeutral();

    this.localPlayerController.setIdle();

    if (!this.hasAppliedInitialWorldState) {
      this.hasAppliedInitialWorldState = true;

      const camera = this.cameras.main;

      this.tweens.killTweensOf(camera);

      camera.setAlpha(0);

      this.tweens.add({
        targets: camera,
        alpha: 1,
        duration: 180,
        ease: "Linear",
      });

      this.game.events.emit(WORLD_READY_EVENT, {
        mapId: this.currentMapId,
      } satisfies WorldReadyPayload);
    }
  }

  private async handleMapTransitionResolved(
    transition: MapTransitionResolved
  ): Promise<void> {
    if (transition.fromMapId !== this.currentMapId) {
      return;
    }

    if (transition.transitionId === "blackout-recovery") {
      this.clearBlackoutRecoveryPending();
    }

    this.trainerPanelController.close();

    this.mapTransitionController.resetExitTracking();

    await this.mapAssetLoader.ensureMapLoaded(transition.targetMapId);

    this.changeCurrentMap(transition.targetMapId);

    this.localPlayerController.snapToPosition(transition.x, transition.y);

    this.pokemonTrainerPresentationController.resetFollowerToPlayerPosition(
      transition.x,
      transition.y,
      this.localPlayerController.direction
    );

    this.overworldCameraController.resetForMap(this.currentMapId, this.mapManager.map);

    this.movementInputController.resetLastInputToNeutral();

    this.localPlayerController.setIdle();
  }

  private handleBattleCompletionAcknowledged(
    payload: PokemonBattleCompletedPayload
  ): void {
    if (payload.outcome !== "trainer-battle-defeat") {
      return;
    }

    if (this.blackoutRecoveryPending) {
      return;
    }

    this.blackoutRecoveryPending = true;
    this.worldInteractionControls.hide();
    this.movementInputController.resetLastInputToNeutral();
    this.localPlayerController.setIdle();

    this.blackoutRecoveryTimeout?.remove(false);
    this.blackoutRecoveryTimeout = this.time.delayedCall(10_000, () => {
      if (!this.blackoutRecoveryPending) {
        return;
      }

      this.blackoutRecoveryPending = false;
      this.blackoutRecoveryTimeout = undefined;

      console.error(
        "[BlackoutRecovery] Timed out waiting for authoritative recovery transition"
      );
    });

    this.network.requestBlackoutRecovery();
  }

  private clearBlackoutRecoveryPending(): void {
    this.blackoutRecoveryPending = false;
    this.blackoutRecoveryTimeout?.remove(false);
    this.blackoutRecoveryTimeout = undefined;
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
            { start: 0, end: 11 }
          ),
          frameRate: 12,
          repeat: -1,
        });
      });
    });
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setAlpha(0);
    this.overworldCameraController.start(this.currentMapId, this.mapManager.map);
  }

  private createPlayerNameLabel(displayName: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, displayName, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  private handleWorldInteraction(): void {
    const interactPressed = this.worldInteractionControls.consumeInteract();

    if (!interactPressed) {
      return;
    }
    if (
      this.networkDisconnected ||
      this.isMapTransitioning ||
      this.blackoutRecoveryPending
    ) {
      return;
    }

    /*
     * Un diálogo activo tiene prioridad sobre los locks del overworld.
     * TrainerPreBattleController mantiene isBlockingGameplay=true durante
     * el diálogo para impedir movimiento, pero ese lock no debe impedir
     * que E/A avance la sesión de diálogo.
     */
    if (this.dialogueBox.isOpen()) {
      const sessionId = this.activeDialogueSessionId;
      if (!sessionId || this.isDialogueAdvancePending) {
        return;
      }
      this.isDialogueAdvancePending = true;
      this.network.advanceDialogue(sessionId);
      return;
    }

    if (this.isTrainerInteractionBlocking) {
      return;
    }
    if (this.chatBox.isTyping()) {
      return;
    }
    if (this.pokemonCenterHealingPresentation?.isBlockingGameplay) {
      return;
    }

    /* Otras UIs bloquean interacción overworld */
    if (
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isOpen ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay
    ) {
      return;
    }

    const healingStationId = this.pokemonCenterHealingInteraction.nearbyStationId;

    if (healingStationId) {
      this.trainerPanelController.close();
      this.pokemonCenterHealingInteraction.requestHealing();
      return;
    }

    const storageTerminalId = this.pokemonStorageTerminalInteraction.nearbyTerminalId;

    if (storageTerminalId) {
      this.trainerPanelController.close();
      this.pokemonStorageController.requestOpen(storageTerminalId);
      return;
    }

    /* NPC sigue funcionando como antes */
    if (!this.nearbyNpc) {
      return;
    }

    const interactionPrompt = this.getNpcInteractionPromptText(
      this.nearbyNpc,
    );

    if (!interactionPrompt) {
      return;
    }

    this.interactWithNpc(this.nearbyNpc);
  }

  private updateWorldInteractionControls(): void {
    if (this.networkDisconnected) {
      this.worldInteractionControls.hide();
      return;
    }

    /*
     * Dialogue tiene prioridad sobre the remaining overworld locks.
     * TrainerPreBattleController maintains isBlockingGameplay=true during
     * dialogue, but A/E must remain available while the socket is healthy.
     */
    if (this.dialogueBox.isOpen()) {
      this.worldInteractionControls.showDialogueContinue();
      return;
    }

    if (
      this.isMapTransitioning ||
      this.blackoutRecoveryPending ||
      this.isTrainerInteractionBlocking ||
      this.chatBox.isTyping() ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay
    ) {
      this.worldInteractionControls.hide();
      return;
    }

    /* Otras superficies bloquean interacción overworld */
    if (
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isOpen ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
      this.pokemonShopController?.isBlockingGameplay ||
      this.pokemonCenterHealingInteraction?.isPending
    ) {
      this.worldInteractionControls.hide();
      return;
    }

    /* Healing tiene prioridad */
    if (this.pokemonCenterHealingInteraction.hasNearbyStation) {
      this.worldInteractionControls.showAction({
        actionLabel: "Curar Pokémon",
        variant: "healing",
      });

      return;
    }

    /* Storage */ if (this.pokemonStorageTerminalInteraction.hasNearbyTerminal) {
      this.worldInteractionControls.showAction({
        actionLabel: "Usar PC",
        variant: "storage",
      });

      return;
    }

    /* NPC */
    const npc = this.nearbyNpc;

    if (!npc) {
      this.worldInteractionControls.hide();
      return;
    }

    const actionLabel = this.getNpcInteractionPromptText(npc);

    if (!actionLabel) {
      this.worldInteractionControls.hide();
      return;
    }

    this.worldInteractionControls.showAction({
      actionLabel,
      variant: "default",
    });
  }

  private getNpcInteractionPromptText(
    npc: NpcInstance,
  ): string | undefined {
    switch (npc.definition.interactionType) {
      case "dialogue":
        return "Hablar";

      case "trainer-battle":
        return this.isTrainerNpcDefeated(npc) ? "Hablar" : undefined;

      case "shop":
        return "Abrir tienda";

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
    if (this.networkDisconnected) {
      return;
    }
    if (this.pokemonCenterHealingPresentation?.isBlockingGameplay) {
      return;
    }
    if (this.pokemonStorageController?.isBlockingGameplay) {
      return;
    }
    if (this.pokemonShopController?.isBlockingGameplay) {
      return;
    }
    if (this.isMapTransitioning) {
      return;
    }
    if (this.isTrainerInteractionBlocking) {
      return;
    }
    if (this.starterSelectionPanel.isVisible()) {
      return;
    }
    if (this.trainerPanelController.isOpen) {
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
    if (
      this.networkDisconnected ||
      this.mapTransitionRequestPromise ||
      this.isMapTransitioning ||
      this.blackoutRecoveryPending ||
      this.isTrainerInteractionBlocking ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isPartyVisible ||
      this.battleController.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
      this.pokemonShopController?.isBlockingGameplay ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay ||
      this.pokemonCenterHealingInteraction?.isPending
    ) {
      return;
    }

    const sourceMapId = this.currentMapId;

    this.mapTransitionRequestPromise = this.prepareAndRequestMapTransition(
      sourceMapId,
      transitionId
    )
      .catch((error: unknown) => {
        console.error("[MapTransition] Could not prepare destination", {
          sourceMapId,
          transitionId,
          error,
        });
      })
      .finally(() => {
        this.mapTransitionRequestPromise = undefined;
      });
  }

  private prefetchMapTransitionDestination(transitionId: string): void {
    const transition = this.getMapTransitionDefinition(this.currentMapId, transitionId);

    if (!transition) {
      return;
    }
    if (transition.targetMapId === this.currentMapId) {
      return;
    }

    this.mapAssetLoader.prefetchMap(transition.targetMapId);
  }

  private getMapTransitionDefinition(
    mapId: MapId,
    transitionId: string
  ): MapTransitionDefinition | undefined {
    const transitions = MAP_DATA_REGISTRY[mapId].transitions;

    return Reflect.get(transitions, transitionId.trim()) as
      MapTransitionDefinition | undefined;
  }

  private async prepareAndRequestMapTransition(
    sourceMapId: MapId,
    transitionId: string
  ): Promise<void> {
    const transition = this.getMapTransitionDefinition(sourceMapId, transitionId);

    if (!transition) {
      console.warn("[MapTransition] Unknown transition", {
        sourceMapId,
        transitionId,
      });
      return;
    }

    await this.mapAssetLoader.ensureMapLoaded(transition.targetMapId);

    if (
      this.networkDisconnected ||
      !this.network.connected ||
      this.currentMapId !== sourceMapId ||
      this.isMapTransitioning
    ) {
      return;
    }

    const payload: MapTransitionInput = {
      transitionId,
    };

    this.network.requestMapTransition(payload);
  }

  private syncGameTopBar(): void {
    const selectedTrainer = selectedTrainerStore.getSelected();
    setAccountShellTrainerContext(selectedTrainer);
    if (!selectedTrainer) {
      initializeGameTopBar().clearWorldContext();
      return;
    }
    initializeGameTopBar().setMap(this.currentMapId);
  }

  private async handleCurrentPlayers(players: Record<string, Player>): Promise<void> {
    const playerStates = Object.values(players);

    const localPlayer = playerStates.find((player) => player.id === this.network.id);

    if (!localPlayer) {
      console.warn("[PlayerWorld] Local player missing from currentPlayers", {
        networkId: this.network.id,

        playerIds: Object.keys(players),
      });

      return;
    }

    try {
      await this.applyInitialAuthoritativePlayerState(localPlayer);

      if (this.networkDisconnected) {
        this.networkDisconnected = false;
        this.movementInputController?.resetLastInputToNeutral();
        this.virtualJoystick?.reset();
      }
    } catch (error: unknown) {
      console.error("[PlayerWorld] Could not load authoritative map", error);
      this.scene.start("TrainerSelectionScene", {
        errorMessage: "No se pudo cargar el mapa del Trainer. Inténtalo nuevamente.",
      });
      return;
    }

    for (const player of playerStates) {
      if (player.id === this.network.id) {
        continue;
      }
      if (player.mapId !== this.currentMapId) {
        continue;
      }

      this.remotePlayerManager.add(player);
      this.remotePokemonFollowerManager.sync(player);
    }
  }

  private destroyCurrentMap(): void {
    this.nearbyNpc = undefined;
    this.pokemonCenterHealingPresentation?.cancel();
    this.pokemonCenterHealingInteraction?.clear();
    this.pokemonStorageTerminalInteraction?.clear();
    this.pokemonShopController?.dismiss();
    this.pokemonCenterHealingWorldFx?.cancel();
    this.pokemonCenterHealingAudio?.cancel();
    this.trainerSightController?.clear();
    this.trainerPreBattleController?.clear();
    this.npcManager.destroy();
    this.mapTransitionController.clearZones();
    this.mapManager.destroy();
  }

  private changeCurrentMap(mapId: MapId): void {
    if (mapId === this.currentMapId) {
      return;
    }

    this.destroyCurrentMap();
    this.remotePokemonFollowerManager.clear();
    this.remotePlayerManager.clear();
    this.currentMapId = mapId;
    this.mapManager.create(this.currentMapId);
    initializeGameTopBar().setMap(this.currentMapId);
    this.mapTransitionController.loadZones(this.mapManager.map);
    this.npcManager.create(this.mapManager.map);
  }

  private get isMapTransitioning(): boolean {
    return this.mapTransitionController.isTransitioning;
  }

  private get isTrainerInteractionBlocking(): boolean {
    return Boolean(
      this.trainerSightController?.isBlockingGameplay ||
      this.trainerPreBattleController?.isBlockingGameplay
    );
  }

  private isMovementInputBlocked(): boolean {
    return (
      !this.hasAppliedInitialWorldState ||
      this.networkDisconnected ||
      Boolean(this.mapTransitionRequestPromise) ||
      this.isMapTransitioning ||
      this.blackoutRecoveryPending ||
      this.isTrainerInteractionBlocking ||
      this.pokemonStorageController?.isBlockingGameplay ||
      this.pokemonShopController?.isBlockingGameplay ||
      this.pokemonCenterHealingInteraction?.isPending ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isOpen ||
      this.battleController?.isBlockingGameplay
    );
  }

  private handleWildEncounterStarted(payload: PokemonWildEncounterStartedPayload): void {
    console.log("[WildEncounter] received", {
      encounterId: payload.encounterId,
      zoneId: payload.zoneId,
      speciesId: payload.pokemon.speciesId,
      level: payload.pokemon.level,
    });
  }

  private updatePokemonCenterHealingStation(): void {
    const blocked =
      this.networkDisconnected ||
      this.isMapTransitioning ||
      this.blackoutRecoveryPending ||
      this.isTrainerInteractionBlocking ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isOpen ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
      this.pokemonShopController?.isBlockingGameplay ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay;

    this.pokemonCenterHealingInteraction.update(
      this.currentMapId,
      this.player.x,
      this.player.y,
      blocked
    );
  }

  private updatePokemonStorageTerminal(): void {
    const blocked =
      this.networkDisconnected ||
      this.isMapTransitioning ||
      this.blackoutRecoveryPending ||
      this.isTrainerInteractionBlocking ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isPartyVisible ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
      this.pokemonShopController?.isBlockingGameplay ||
      this.pokemonCenterHealingInteraction.hasNearbyStation ||
      this.pokemonCenterHealingInteraction.isPending ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay;

    this.pokemonStorageTerminalInteraction.update(
      this.currentMapId,
      this.player.x,
      this.player.y,
      blocked
    );
  }

  private installAudioUnlock(): void {
    const unlockAudio = (): void => {
      if (this.sound.locked) {
        this.sound.unlock();
        console.log("[Audio] Phaser sound manager unlock requested");
      }

      const webAudioSoundManager = this.sound as typeof this.sound & {
        context?: AudioContext;
      };

      const context = webAudioSoundManager.context;

      if (context && context.state === "suspended") {
        void context
          .resume()
          .then(() => {
            console.log("[Audio] AudioContext resumed");
          })
          .catch((error: unknown) => {
            console.warn("[Audio] AudioContext resume failed", error);
          });
      }
    };

    document.addEventListener("pointerdown", unlockAudio, {
      capture: true,
    });

    /* Useful fallback for Safari touch behavior. */
    document.addEventListener("touchend", unlockAudio, {
      capture: true,
    });

    document.addEventListener("keydown", unlockAudio, {
      capture: true,
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("pointerdown", unlockAudio, true);
      document.removeEventListener("touchend", unlockAudio, true);
      document.removeEventListener("keydown", unlockAudio, true);
    });
  }
}
