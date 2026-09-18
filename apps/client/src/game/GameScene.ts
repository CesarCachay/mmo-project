import Phaser from "phaser";
import {
  isChatMessageInput,
  DEFAULT_MAP_ID,
  getDialogue,
  isPlayerMoving,
  POKEMON_ITEM_REGISTRY,
} from "@cesar-mmo/shared";

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
import {
  WILD_BATTLE_AUDIO_ASSETS,
  WILD_BATTLE_AUDIO_KEYS,
} from "./battle/audio/WildBattleAudioController";
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
import { MAP_REGISTRY } from "./maps/mapRegistry";

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
import type { NpcDirection, NpcInstance, NpcInteractionType } from "./npc/types";
import { RemotePokemonFollowerManager } from "./pokemon/RemotePokemonFollowerManager";
import { OverworldCameraController } from "./camera/OverworldCameraController";
import { TrainerPanelController } from "./ui/TrainerPanelController";
import { PokemonTrainerPresentationController } from "./pokemon/PokemonTrainerPresentationController";

// controllers
import { BattleController } from "./battle/BattleController";
import { PokemonStorageController } from "./storage/PokemonStorageController";
import { PokemonStorageTerminalInteractionController } from "./storage/PokemonStorageTerminalInteractionController";
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
} from "@cesar-mmo/shared";

export class GameScene extends Phaser.Scene {
  private currentMapId: MapId = DEFAULT_MAP_ID;
  private hasAppliedInitialWorldState = false;

  private mapManager!: MapManager;
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

  private battleController!: BattleController;

  private pokemonStorageController!: PokemonStorageController;
  private pokemonStorageTerminalInteraction!: PokemonStorageTerminalInteractionController;

  private pokemonCenterHealingInteraction!: PokemonCenterHealingInteractionController;
  private pokemonCenterHealingPresentation!: PokemonCenterHealingPresentationController;
  private pokemonCenterHealingWorldFx!: PokemonCenterHealingWorldFxController;
  private pokemonCenterHealingAudio!: PokemonCenterHealingAudioController;

  // managers
  private npcManager!: NpcManager;
  private remotePlayerManager!: RemotePlayerManager;
  private mapTransitionController!: MapTransitionController;
  private remotePokemonFollowerManager!: RemotePokemonFollowerManager;
  private pokemonTrainerPresentationController!: PokemonTrainerPresentationController;

  private avatarId: PlayerAvatarId = "male-01";

  constructor() {
    super("GameScene");
  }

  init(data: { displayName: string; avatarId: PlayerAvatarId }) {
    this.avatarId = data.avatarId;
    this.hasAppliedInitialWorldState = false;
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
      WILD_BATTLE_AUDIO_KEYS.CAPTURE_CONTAINED,
      WILD_BATTLE_AUDIO_ASSETS.CAPTURE_CONTAINED
    );
    this.load.audio(
      WILD_BATTLE_AUDIO_KEYS.CAPTURE_SUCCESS,
      WILD_BATTLE_AUDIO_ASSETS.CAPTURE_SUCCESS
    );
    this.load.audio(
      WILD_BATTLE_AUDIO_KEYS.CAPTURE_FAILED,
      WILD_BATTLE_AUDIO_ASSETS.CAPTURE_FAILED
    );
    this.load.audio(WILD_BATTLE_AUDIO_KEYS.VICTORY, WILD_BATTLE_AUDIO_ASSETS.VICTORY);
    this.load.audio(WILD_BATTLE_AUDIO_KEYS.DEFEAT, WILD_BATTLE_AUDIO_ASSETS.DEFEAT);
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

    this.localPlayerController.predictMovement(
      input,
      delta,
      this.currentMapId,
      this.isMapTransitioning
    );
    this.localPlayerController.reconcile(delta);
    this.overworldCameraController.update(
      delta,
      this.localPlayerController.direction,
      isPlayerMoving(input)
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
    this.battleController = new BattleController(
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
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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

  private startNpcDialogue(npc: NpcInstance): void {
    if (this.pendingDialogueNpc || this.activeDialogueNpc) {
      return;
    }

    this.pendingDialogueNpc = npc;
    this.network.startDialogue(npc.definition.id);
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
      this.dialogueBox.hide();
      this.activeDialogueSessionId = undefined;
      this.pendingDialogueNpc = undefined;
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
    npc.sprite.anims.stop();
    npc.sprite.setTexture(
      getNpcTextureKey(npc.definition.sprite, npc.definition.direction),
      0
    );
    this.activeDialogueNpc = undefined;
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
        Boolean(this.pokemonCenterHealingInteraction?.isPending) ||
        Boolean(this.pokemonCenterHealingPresentation?.isBlockingGameplay) ||
        Boolean(this.battleController?.isBlockingGameplay) ||
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

    this.network.onConnectionRejected((error) => {
      this.network.disconnect();

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
      console.log("Connected:", socketId);
    });

    this.network.onChatMessage((message) => {
      this.handleChatMessageReceived(message);
    });

    this.network.onDialogueState((state) => {
      this.handleDialogueState(state);
    });

    this.network.onPokemonTrainerState((payload) => {
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
      this.trainerPanelController.close();
      this.pokemonStorageController?.dismiss();
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

    this.network.onCurrentPlayers((players) => {
      const playerStates = Object.values(players);
      const localPlayer = playerStates.find((player) => player.id === this.network.id);
      if (!localPlayer) {
        console.warn("[PlayerWorld] Local player missing from currentPlayers", {
          networkId: this.network.id,
          playerIds: Object.keys(players),
        });
        return;
      }

      this.applyInitialAuthoritativePlayerState(localPlayer);

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

  private applyInitialAuthoritativePlayerState(player: Player): void {
    if (player.mapId !== this.currentMapId) {
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
    }
  }

  private handleMapTransitionResolved(transition: MapTransitionResolved): void {
    if (transition.fromMapId !== this.currentMapId) {
      return;
    }

    this.trainerPanelController.close();

    this.mapTransitionController.resetExitTracking();
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
    if (this.isMapTransitioning) {
      return;
    }
    if (this.chatBox.isTyping()) {
      return;
    }
    if (this.pokemonCenterHealingPresentation?.isBlockingGameplay) {
      return;
    }

    /* Dialogue activo tiene prioridad. */
    if (this.dialogueBox.isOpen()) {
      const sessionId = this.activeDialogueSessionId;
      if (!sessionId || this.isDialogueAdvancePending) {
        return;
      }
      this.isDialogueAdvancePending = true;
      this.network.advanceDialogue(sessionId);
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
      this.nearbyNpc.definition.interactionType
    );

    if (!interactionPrompt) {
      return;
    }

    this.interactWithNpc(this.nearbyNpc);
  }

  private updateWorldInteractionControls(): void {
    /* Blockers que también tienen prioridad sobre un diálogo */
    if (
      this.isMapTransitioning ||
      this.chatBox.isTyping() ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay
    ) {
      this.worldInteractionControls.hide();
      return;
    }

    /*
     * Dialogue:
     * desktop: DialogueBox continúa manejando su presentación.
     * mobile: mostramos A / Continuar.
     */
    if (this.dialogueBox.isOpen()) {
      this.worldInteractionControls.showDialogueContinue();

      return;
    }

    /* Otras superficies bloquean interacción overworld */
    if (
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isOpen ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
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

    const actionLabel = this.getNpcInteractionPromptText(npc.definition.interactionType);

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
    interactionType: NpcInteractionType
  ): string | undefined {
    switch (interactionType) {
      case "dialogue":
        return "Hablar";

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
    if (this.pokemonCenterHealingPresentation?.isBlockingGameplay) {
      return;
    }
    if (this.pokemonStorageController?.isBlockingGameplay) {
      return;
    }
    if (this.isMapTransitioning) {
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
      this.isMapTransitioning ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isPartyVisible ||
      this.battleController.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
      this.pokemonCenterHealingPresentation?.isBlockingGameplay ||
      this.pokemonCenterHealingInteraction?.isPending
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

  private destroyCurrentMap(): void {
    this.nearbyNpc = undefined;
    this.pokemonCenterHealingPresentation?.cancel();
    this.pokemonCenterHealingInteraction?.clear();
    this.pokemonStorageTerminalInteraction?.clear();
    this.pokemonCenterHealingWorldFx?.cancel();
    this.pokemonCenterHealingAudio?.cancel();
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

  private isMovementInputBlocked(): boolean {
    return (
      this.isMapTransitioning ||
      this.pokemonStorageController?.isBlockingGameplay ||
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
      this.isMapTransitioning ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isOpen ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
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
      this.isMapTransitioning ||
      this.dialogueBox.isOpen() ||
      this.chatBox.isTyping() ||
      this.starterSelectionPanel.isVisible() ||
      this.trainerPanelController.isPartyVisible ||
      this.battleController?.isBlockingGameplay ||
      this.pokemonStorageController?.isBlockingGameplay ||
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
