import {
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';

import { OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import {
  PLAYER_SIZE,
  SERVER_TICK_RATE,
  applyPlayerMovement,
  resolveMapCollision,
  isPlayerMoving,
  getDirectionFromInput,
  isPlayerAvatarId,
  CHAT_EVENTS,
  isChatMessageInput,
  isMapTransitionInput,
  MAP_EVENTS,
  MAP_DATA_REGISTRY,
  POKEMON_EVENTS,
  DIALOGUE_EVENTS,
  isDialogueStartInput,
  isDialogueAdvanceInput,
  createWildPokemonEncounter,
  POKEMON_OVERWORLD_ITEM_EVENTS,
  POKEMON_PARTY_REORDER_EVENTS,
  POKEMON_CENTER_HEALING_EVENTS,
} from '@cesar-mmo/shared';
import {
  getServerMapSpawn,
  getServerMapTransition,
  isPlayerInsideMapTransition,
  getServerMapNpc,
  isPlayerNearMapNpc,
  getServerEncounterZoneAtPosition,
} from './maps/serverMapRegistry';
import { ChatService } from '#app/chat/chat.service';

import type { PlayerWorldLocation } from './world/player-world.types';
import type {
  Player,
  PlayerInput,
  MapTransitionResolved,
  MapId,
  PokemonTrainerStatePayload,
  PokemonStarterSelectionStatus,
  SharedMapNpc,
  PokemonTrainerState,
  PokemonWildEncounterStartedPayload,
  PlayerAvatarId,
} from '@cesar-mmo/shared';
import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';
import type { PokemonWildEncounterSession } from '#app/pokemon/encounters/pokemon-wild-encounter-session';

// db and repositories
import { PokemonPartyRepository } from '#app/pokemon/pokemon-party.repository';
import { PokemonInventoryRepository } from '#app/pokemon/inventory/pokemon-inventory.repository';
import { PokemonCaptureRepository } from '#app/pokemon/battles/capture/pokemon-capture.repository';
import { PokemonStorageRepository } from '#app/pokemon/storage/pokemon-storage.repository';
import { PokemonOverworldItemRepository } from '#app/pokemon/items/pokemon-overworld-item.repository';

// services
import { PokemonTrainerService } from '#app/pokemon/pokemon-trainer.service';
import { DialogueSessionService } from '#app/dialogue/dialogue-session.service';
import { PokemonWildEncounterTriggerService } from '#app/pokemon/encounters/pokemon-wild-encounter-trigger.service';
import { PokemonWildEncounterSessionStore } from '#app/pokemon/encounters/pokemon-wild-encounter-session.store';
import { PokemonBattleSessionStore } from '../pokemon/battles/pokemon-battle-session.store';
import { PokemonWildBattleProgressionService } from '#app/pokemon/battles/pokemon-wild-battle-progression.service';

import { PokemonCaptureService } from '#app/pokemon/battles/capture/pokemon-capture.service';
import { PlayerWorldStateService } from './world/player-world-state.service';
import { PokemonStorageService } from '#app/pokemon/storage/pokemon-storage.service';
import { PokemonOverworldItemService } from '#app/pokemon/items/pokemon-overworld-item.service';

// controller
import { PokemonPartyNetworkController } from '#app/pokemon/party/pokemon-party-network.controller';
import { PokemonTrainerStateNetworkPresenter } from '#app/pokemon/network/PokemonTrainerStateNetworkPresenter';
import { PokemonBattleTurnExecutor } from '#app/pokemon/battles/pokemon-battle-turn.executor';
import { PokemonBattleNetworkController } from '#app/pokemon/battles/pokemon-battle-network.controller';
import { PokemonWildBattleStarter } from '#app/pokemon/battles/pokemon-wild-battle.starter';
import { PokemonProgressionNetworkController } from '#app/pokemon/progression/pokemon-progression-network.controller';
import {
  PokemonEvolutionNetworkController,
  emitPokemonEvolutionRequired,
} from '#app/pokemon/evolution/pokemon-evolution-network.controller';
import { PokemonPendingEvolutionRecoveryService } from '#app/pokemon/evolution/pokemon-pending-evolution-recovery.service';
import type { PokemonPendingEvolutionState } from '#app/pokemon/evolution/pokemon-pending-evolution.types';
import { PokemonCenterHealingService } from '#app/pokemon/healing/pokemon-center-healing.service';
import { PokemonCenterHealingNetworkController } from '#app/pokemon/healing/pokemon-center-healing-network.controller';

// stores
import { PlayerWorldRuntimeStore } from './world/player-world-runtime.store';
import { PokemonStorageNetworkController } from '#app/pokemon/storage/pokemon-storage-network.controller';
import { PokemonStorageAccessSessionStore } from '#app/pokemon/storage/pokemon-storage-access-session.store';
import { PokemonOverworldItemNetworkController } from '#app/pokemon/items/pokemon-overworld-item-network.controller';
import { PokemonBattleTurnStore } from '#app/pokemon/battles/pokemon-battle-turn.store';
import { PokemonTrainerStateStore } from '#app/pokemon/pokemon-trainer-state.store';
import { DialogueSessionStore } from '#app/dialogue/dialogue-session.store';
import {
  AccountSocketAuthenticationError,
  AccountSocketAuthenticationService,
} from '#app/account/account-socket-authentication.service';
import {
  TrainerAlreadyConnectedError,
  TrainerConnectionStore,
} from './player/trainer-connection.store';

// manager
import { PokemonProgressionManager } from '#app/pokemon/progression/pokemon-progression.manager';

// deploy
import { resolveClientOrigin } from '#app/config/runtime-environment';

@WebSocketGateway({
  cors: {
    origin: resolveClientOrigin(),
    credentials: true,
  },
})
export class GameGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly playerEncounterZoneIds = new Map<string, string>();

  private readonly pokemonTrainerService: PokemonTrainerService;

  private readonly dialogueSessionStore = new DialogueSessionStore();
  private readonly dialogueSessionService = new DialogueSessionService(
    this.dialogueSessionStore,
  );

  private readonly pokemonWildEncounterTriggerService =
    new PokemonWildEncounterTriggerService();
  private readonly pokemonWildEncounterSessionStore =
    new PokemonWildEncounterSessionStore();
  private readonly pokemonBattleSessionStore = new PokemonBattleSessionStore();
  private readonly pokemonBattleTurnStore = new PokemonBattleTurnStore();

  private readonly pokemonCaptureService: PokemonCaptureService;
  private readonly pokemonStorageService: PokemonStorageService;
  private readonly pokemonOverworldItemService: PokemonOverworldItemService;
  private readonly pokemonStorageAccessSessionStore =
    new PokemonStorageAccessSessionStore();

  private readonly pokemonPartyNetworkController: PokemonPartyNetworkController;
  private readonly pokemonStorageNetworkController: PokemonStorageNetworkController;
  private readonly pokemonOverworldItemNetworkController: PokemonOverworldItemNetworkController;
  private readonly pokemonTrainerStateNetworkPresenter: PokemonTrainerStateNetworkPresenter;

  private readonly pokemonBattleTurnExecutor: PokemonBattleTurnExecutor;
  private readonly pokemonBattleNetworkController: PokemonBattleNetworkController;

  private readonly pokemonWildBattleStarter: PokemonWildBattleStarter;

  private readonly pokemonProgressionNetworkController: PokemonProgressionNetworkController;
  private readonly pokemonEvolutionNetworkController: PokemonEvolutionNetworkController;

  private readonly pokemonCenterHealingNetworkController: PokemonCenterHealingNetworkController;

  private gameLoop?: ReturnType<typeof setInterval>;

  constructor(
    private readonly chatService: ChatService,
    private readonly pokemonTrainerStateStore: PokemonTrainerStateStore,
    private readonly pokemonPartyRepository: PokemonPartyRepository,
    private readonly pokemonInventoryRepository: PokemonInventoryRepository,
    private readonly pokemonCaptureRepository: PokemonCaptureRepository,
    private readonly pokemonStorageRepository: PokemonStorageRepository,
    private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore,
    private readonly playerWorldStateService: PlayerWorldStateService,
    private readonly pokemonOverworldItemRepository: PokemonOverworldItemRepository,
    private readonly wildBattleProgressionService: PokemonWildBattleProgressionService,
    private readonly pokemonCenterHealingService: PokemonCenterHealingService,
    private readonly pokemonProgressionManager: PokemonProgressionManager,
    private readonly pokemonPendingEvolutionRecoveryService: PokemonPendingEvolutionRecoveryService,
    private readonly accountSocketAuthenticationService: AccountSocketAuthenticationService,
    private readonly trainerConnectionStore: TrainerConnectionStore,
  ) {
    this.pokemonTrainerService = new PokemonTrainerService(
      this.pokemonTrainerStateStore,
      this.pokemonPartyRepository,
      this.pokemonInventoryRepository,
    );
    this.pokemonStorageService = new PokemonStorageService(
      this.pokemonTrainerStateStore,
      this.pokemonPartyRepository,
      this.pokemonStorageRepository,
    );
    this.pokemonOverworldItemService = new PokemonOverworldItemService(
      this.pokemonTrainerStateStore,
      this.pokemonOverworldItemRepository,
    );
    this.pokemonCaptureService = new PokemonCaptureService(
      this.pokemonTrainerStateStore,
      this.pokemonCaptureRepository,
    );
    this.pokemonTrainerStateNetworkPresenter =
      new PokemonTrainerStateNetworkPresenter(this.playerWorldRuntimeStore);

    this.pokemonCenterHealingNetworkController =
      new PokemonCenterHealingNetworkController({
        healingService: this.pokemonCenterHealingService,
        trainerStatePresenter: this.pokemonTrainerStateNetworkPresenter,
        playerWorldRuntimeStore: this.playerWorldRuntimeStore,
        dialogueSessionStore: this.dialogueSessionStore,
        storageAccessSessionStore: this.pokemonStorageAccessSessionStore,
        wildEncounterSessionStore: this.pokemonWildEncounterSessionStore,
        battleSessionStore: this.pokemonBattleSessionStore,
        resolveTrainerId: (playerId) => this.getTrainerId(playerId),
      });

    this.pokemonProgressionNetworkController =
      new PokemonProgressionNetworkController({
        progressionManager: this.pokemonProgressionManager,
        trainerStatePresenter: this.pokemonTrainerStateNetworkPresenter,
        resolveTrainerId: (playerId) => this.getTrainerId(playerId),
      });
    this.pokemonEvolutionNetworkController =
      new PokemonEvolutionNetworkController({
        progressionManager: this.pokemonProgressionManager,
        trainerStatePresenter: this.pokemonTrainerStateNetworkPresenter,
        resolveTrainerId: (playerId) => this.getTrainerId(playerId),
      });

    this.pokemonBattleTurnExecutor = new PokemonBattleTurnExecutor({
      trainerStateStore: this.pokemonTrainerStateStore,
      trainerService: this.pokemonTrainerService,
      captureService: this.pokemonCaptureService,
    });
    this.pokemonBattleNetworkController = new PokemonBattleNetworkController({
      trainerStateStore: this.pokemonTrainerStateStore,
      trainerService: this.pokemonTrainerService,
      battleSessionStore: this.pokemonBattleSessionStore,
      battleTurnStore: this.pokemonBattleTurnStore,
      turnExecutor: this.pokemonBattleTurnExecutor,
      wildBattleProgressionService: this.wildBattleProgressionService,
      trainerStatePresenter: this.pokemonTrainerStateNetworkPresenter,
    });

    this.pokemonWildBattleStarter = new PokemonWildBattleStarter({
      trainerStateStore: this.pokemonTrainerStateStore,
      wildEncounterSessionStore: this.pokemonWildEncounterSessionStore,
      battleSessionStore: this.pokemonBattleSessionStore,
      battleTurnStore: this.pokemonBattleTurnStore,
      storageAccessSessionStore: this.pokemonStorageAccessSessionStore,
      resolvePlayerSocket: (playerId) =>
        this.server.sockets.sockets.get(playerId),
    });

    this.pokemonOverworldItemNetworkController =
      new PokemonOverworldItemNetworkController({
        overworldItemService: this.pokemonOverworldItemService,
        trainerStatePresenter: this.pokemonTrainerStateNetworkPresenter,
        dialogueSessionStore: this.dialogueSessionStore,
        storageAccessSessionStore: this.pokemonStorageAccessSessionStore,
        wildEncounterSessionStore: this.pokemonWildEncounterSessionStore,
        battleSessionStore: this.pokemonBattleSessionStore,
        resolveTrainerId: (playerId) => this.getTrainerId(playerId),
      });
    this.pokemonPartyNetworkController = new PokemonPartyNetworkController({
      trainerService: this.pokemonTrainerService,
      trainerStateStore: this.pokemonTrainerStateStore,
      playerWorldRuntimeStore: this.playerWorldRuntimeStore,
      dialogueSessionStore: this.dialogueSessionStore,
      storageAccessSessionStore: this.pokemonStorageAccessSessionStore,
      wildEncounterSessionStore: this.pokemonWildEncounterSessionStore,
      battleSessionStore: this.pokemonBattleSessionStore,
      trainerStatePresenter: this.pokemonTrainerStateNetworkPresenter,
      resolveTrainerId: (playerId) => this.getTrainerId(playerId),
    });
    this.pokemonStorageNetworkController = new PokemonStorageNetworkController({
      storageService: this.pokemonStorageService,
      storageAccessSessionStore: this.pokemonStorageAccessSessionStore,
      trainerStatePresenter: this.pokemonTrainerStateNetworkPresenter,
      playerWorldRuntimeStore: this.playerWorldRuntimeStore,
      dialogueSessionStore: this.dialogueSessionStore,
      battleSessionStore: this.pokemonBattleSessionStore,
      resolveTrainerId: (playerId) => this.getTrainerId(playerId),
    });
  }

  afterInit() {
    this.startGameLoop();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = undefined;
    }

    const worldSnapshots: Array<{
      trainerId: PokemonTrainerId;
      player: Player;
    }> = [];

    for (const [, player] of this.playerWorldRuntimeStore.entries()) {
      const trainerId = this.getTrainerId(player.id);
      console.log('trainerId', trainerId);

      if (!trainerId) {
        console.warn(
          '[PlayerWorld] Skipping shutdown flush: trainer identity missing',
          {
            playerId: player.id,
          },
        );
        continue;
      }

      worldSnapshots.push({
        trainerId,
        player,
      });
    }

    await this.playerWorldStateService.flushPlayers(worldSnapshots);
  }

  async handleConnection(client: Socket): Promise<void> {
    let displayName: string;
    let avatarId: PlayerAvatarId;
    let trainerId: PokemonTrainerId;

    const selectedTrainerId: unknown = client.handshake.auth.selectedTrainerId;

    try {
      const connection =
        await this.accountSocketAuthenticationService.requireAuthenticatedTrainer(
          {
            cookieHeader: client.handshake.headers.cookie,
            selectedTrainerId,
          },
        );

      const trainerDisplayName = connection.trainer.displayName.trim();
      const trainerAvatarId = connection.trainer.avatarId;

      if (
        !trainerDisplayName ||
        trainerDisplayName.length < 3 ||
        trainerDisplayName.length > 16 ||
        !isPlayerAvatarId(trainerAvatarId)
      ) {
        client.emit('connectionRejected', {
          code: 'TRAINER_PROFILE_INVALID',
          message: 'The selected Trainer profile is incomplete.',
        });

        client.disconnect(true);
        return;
      }

      trainerId = connection.trainer.trainerId;
      displayName = trainerDisplayName;
      avatarId = trainerAvatarId;

      this.trainerConnectionStore.bind(client.id, trainerId);
    } catch (error: unknown) {
      if (error instanceof AccountSocketAuthenticationError) {
        client.emit('connectionRejected', {
          code: error.code,
          message: error.message,
        });
        client.disconnect(true);
        return;
      }

      if (error instanceof TrainerAlreadyConnectedError) {
        client.emit('connectionRejected', {
          code: 'TRAINER_ALREADY_CONNECTED',
          message: 'That Trainer is already connected.',
        });
        client.disconnect(true);
        return;
      }

      console.error('[AccountTrainerConnection] resolution failed', error);

      client.emit('connectionRejected', {
        code: 'TRAINER_CONNECTION_ERROR',
        message: 'Could not authenticate the selected Trainer.',
      });

      client.disconnect(true);
      return;
    }

    if (this.isDisplayNameInUse(displayName)) {
      this.unbindTrainerConnection(client.id);

      client.emit('connectionRejected', {
        code: 'NAME_ALREADY_IN_USE',
        message: 'That player name is already in use.',
      });
      client.disconnect(true);
      return;
    }

    let trainerState: PokemonTrainerState;
    let initialWorldLocation: PlayerWorldLocation;
    let pendingEvolutions: readonly PokemonPendingEvolutionState[] = [];

    try {
      const existingTrainerState = this.pokemonTrainerStateStore.get(trainerId);

      if (existingTrainerState) {
        trainerState = existingTrainerState;
      } else {
        const [persistedParty, persistedInventory] = await Promise.all([
          this.pokemonPartyRepository.loadParty(trainerId),

          this.pokemonInventoryRepository.loadInventory(trainerId),
        ]);

        trainerState = this.pokemonTrainerStateStore.create(
          trainerId,
          persistedParty,
          persistedInventory,
        );
      }

      initialWorldLocation =
        await this.playerWorldStateService.loadInitialLocation(trainerId);

      // TO REMOVE - TEST
      // trainerState =
      //   await this.pokemonTrainerService
      //     .ensureDevelopmentBattleTestParty(
      //       trainerId,
      //     );

      pendingEvolutions =
        await this.pokemonPendingEvolutionRecoveryService.restoreTrainerPendings(
          {
            trainerId,

            partyPokemonInstanceIds: trainerState.party.pokemon.map(
              (pokemon) => pokemon.instanceId,
            ),
          },
        );
    } catch (error: unknown) {
      console.error('[TrainerConnection] state hydration failed', error);
      this.unbindTrainerConnection(client.id);
      client.emit('connectionRejected', {
        code: 'TRAINER_STATE_LOAD_ERROR',
        message: 'Could not load the selected Trainer state.',
      });
      client.disconnect(true);
      return;
    }

    const newPlayer: Player = {
      id: client.id,
      mapId: initialWorldLocation.mapId,
      displayName,
      avatarId,
      x: initialWorldLocation.x,
      y: initialWorldLocation.y,
      direction: initialWorldLocation.direction,
      isMoving: false,
      lastProcessedInputSequence: 0,
    };

    this.playerWorldRuntimeStore.addPlayer(newPlayer);

    this.pokemonTrainerStateNetworkPresenter.syncPlayerFollower(
      client.id,
      trainerState,
    );

    this.playerWorldRuntimeStore.setInput(client.id, {
      sequence: 0,
      up: false,
      down: false,
      left: false,
      right: false,
    });

    const trainerStatePayload: PokemonTrainerStatePayload = {
      trainerState,
    };

    client.emit(POKEMON_EVENTS.TRAINER_STATE, trainerStatePayload);

    for (const pendingEvolution of pendingEvolutions) {
      emitPokemonEvolutionRequired(client, pendingEvolution);
    }

    const mapRoom = this.getMapRoom(newPlayer.mapId);

    await client.join(mapRoom);

    client.emit(
      'currentPlayers',
      this.playerWorldRuntimeStore.getPlayersInMap(newPlayer.mapId),
    );

    client.to(mapRoom).emit('playerJoined', newPlayer);
  }

  handleDisconnect(client: Socket) {
    const player = this.playerWorldRuntimeStore.getPlayer(client.id);
    const trainerId = this.getTrainerId(client.id);

    if (player && trainerId) {
      this.playerWorldStateService.checkpointPlayer(trainerId, player);
    }
    if (trainerId) {
      this.pokemonTrainerStateStore.lockStarterSelection(trainerId);
    }

    this.unbindTrainerConnection(client.id);
    this.dialogueSessionStore.remove(client.id);
    this.pokemonStorageAccessSessionStore.remove(client.id);

    if (!player) {
      return;
    }

    console.log(`Player disconnected: ${client.id}`);

    const mapRoom = this.getMapRoom(player.mapId);
    this.playerWorldRuntimeStore.removePlayer(client.id);
    this.playerEncounterZoneIds.delete(client.id);
    this.pokemonWildEncounterTriggerService.reset(client.id);
    this.pokemonWildEncounterSessionStore.remove(client.id);
    this.server.to(mapRoom).emit('playerDisconnected', client.id);
  }

  @SubscribeMessage('playerInput')
  handlePlayerInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() input: PlayerInput,
  ) {
    const player = this.playerWorldRuntimeStore.getPlayer(client.id);

    if (!player) {
      return;
    }
    if (input.sequence <= player.lastProcessedInputSequence) {
      return;
    }

    this.playerWorldRuntimeStore.setInput(client.id, input);
    player.lastProcessedInputSequence = input.sequence;
  }

  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    if (!isChatMessageInput(payload)) {
      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);
    if (!player) {
      return;
    }

    const message = this.chatService.createMessage(player, payload);
    this.server.emit(CHAT_EVENTS.MESSAGE_RECEIVED, message);
  }

  @SubscribeMessage(DIALOGUE_EVENTS.START)
  handleDialogueStart(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): void {
    if (!isDialogueStartInput(payload)) {
      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);
    if (!player) {
      return;
    }

    if (
      this.pokemonStorageAccessSessionStore.has(client.id) ||
      this.pokemonBattleSessionStore.getByPlayerId(client.id)
    ) {
      return;
    }

    const npc = getServerMapNpc(player.mapId, payload.npcId);
    if (!npc) {
      return;
    }
    if (!npc.dialogueId) {
      return;
    }
    if (!isPlayerNearMapNpc(player.x, player.y, npc)) {
      return;
    }

    try {
      const state = this.dialogueSessionService.start(
        client.id,
        payload.npcId,
        npc.dialogueId,
      );

      client.emit(DIALOGUE_EVENTS.STATE, state);
    } catch (error: unknown) {
      console.warn(`[Dialogue] Start rejected for player ${client.id}`, error);
    }
  }

  @SubscribeMessage(DIALOGUE_EVENTS.ADVANCE)
  handleDialogueAdvance(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: unknown,
  ): void {
    if (!isDialogueAdvanceInput(payload)) {
      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);
    if (!player) {
      return;
    }

    const session = this.dialogueSessionStore.get(client.id);
    if (!session) {
      return;
    }

    const sessionId = payload.sessionId.trim();
    if (session.sessionId !== sessionId) {
      return;
    }

    const npc = getServerMapNpc(player.mapId, session.npcId);

    if (!npc) {
      this.dialogueSessionStore.remove(client.id);
      return;
    }
    if (npc.dialogueId !== session.dialogueId) {
      this.dialogueSessionStore.remove(client.id);
      return;
    }
    if (!isPlayerNearMapNpc(player.x, player.y, npc)) {
      this.dialogueSessionStore.remove(client.id);
      return;
    }

    try {
      const state = this.dialogueSessionService.advance(client.id, sessionId);
      client.emit(DIALOGUE_EVENTS.STATE, state);
      if (state.completed) {
        this.handleDialoguePostAction(client, npc);
      }
    } catch (error: unknown) {
      console.warn(
        `[Dialogue] Advance rejected for player ${client.id}`,
        error,
      );
    }
  }

  @SubscribeMessage(POKEMON_EVENTS.MOVE_LEARNING_DECISION)
  handlePokemonMoveLearningDecision(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonProgressionNetworkController.handleMoveLearningDecision(
      client,
      payload,
    );
  }

  @SubscribeMessage(POKEMON_EVENTS.EVOLUTION_DECISION)
  handlePokemonEvolutionDecision(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonEvolutionNetworkController.handleEvolutionDecision(
      client,
      payload,
    );
  }

  @SubscribeMessage(POKEMON_EVENTS.CHOOSE_STARTER)
  handleChooseStarter(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonPartyNetworkController.handleChooseStarter(
      client,
      payload,
    );
  }

  @SubscribeMessage(POKEMON_PARTY_REORDER_EVENTS.REORDER)
  handlePokemonPartyReorder(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonPartyNetworkController.handleReorder(client, payload);
  }

  @SubscribeMessage(POKEMON_OVERWORLD_ITEM_EVENTS.USE)
  handlePokemonOverworldItemUse(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonOverworldItemNetworkController.handleUse(
      client,
      payload,
    );
  }

  @SubscribeMessage(POKEMON_CENTER_HEALING_EVENTS.HEAL)
  handlePokemonCenterHealing(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonCenterHealingNetworkController.handleHeal(
      client,
      payload,
    );
  }

  @SubscribeMessage(POKEMON_EVENTS.BATTLE_COMMAND)
  handleBattleCommand(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonBattleNetworkController.handleCommand(client, payload);
  }

  @SubscribeMessage(POKEMON_EVENTS.BATTLE_REPLACEMENT)
  handlePokemonBattleReplacement(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): void {
    this.pokemonBattleNetworkController.handleReplacement(client, payload);
  }

  @SubscribeMessage(MAP_EVENTS.REQUEST_TRANSITION)
  async handleMapTransitionRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    if (!isMapTransitionInput(payload)) {
      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);
    if (!player) {
      return;
    }

    if (
      this.dialogueSessionStore.has(client.id) ||
      this.pokemonStorageAccessSessionStore.has(client.id) ||
      this.pokemonBattleSessionStore.getByPlayerId(client.id)
    ) {
      return;
    }

    const transition = getServerMapTransition(
      player.mapId,
      payload.transitionId,
    );
    if (!transition) {
      return;
    }

    const isInsideTransition = isPlayerInsideMapTransition(
      player.x,
      player.y,
      transition,
    );

    if (!isInsideTransition) {
      console.warn('[MapTransition] rejected: player outside trigger', {
        playerId: player.id,
        mapId: player.mapId,
        transitionId: payload.transitionId.trim(),
        x: player.x,
        y: player.y,
      });
      return;
    }

    const targetSpawn = getServerMapSpawn(
      transition.targetMapId,
      transition.targetSpawn,
    );
    if (!targetSpawn) {
      return;
    }

    const fromMapId = player.mapId;

    const resolvedTransition: MapTransitionResolved = {
      transitionId: payload.transitionId.trim(),
      fromMapId,
      targetMapId: transition.targetMapId,
      targetSpawn: transition.targetSpawn,
      x: targetSpawn.x,
      y: targetSpawn.y,
    };

    const trainerId = this.getTrainerId(client.id);
    console.log('trainerId', trainerId);

    if (!trainerId) {
      console.warn('[MapTransition] trainer identity missing', {
        playerId: client.id,
      });
      return;
    }

    try {
      await this.playerWorldStateService.saveLocation(trainerId, {
        mapId: transition.targetMapId,
        x: targetSpawn.x,
        y: targetSpawn.y,
        direction: player.direction,
      });
    } catch (error: unknown) {
      console.warn('[MapTransition] World persistence failed', {
        trainerId,
        error,
      });
      return;
    }

    const fromRoom = this.getMapRoom(fromMapId);
    const targetRoom = this.getMapRoom(transition.targetMapId);

    /* Informamos inmediatamente a los demás jugadores del mapa anterior */
    client.to(fromRoom).emit(MAP_EVENTS.PLAYER_LEFT, player.id);
    await client.leave(fromRoom);

    this.playerWorldRuntimeStore.movePlayerToMap(
      client.id,
      transition.targetMapId,
    );
    player.x = targetSpawn.x;
    player.y = targetSpawn.y;
    player.isMoving = false;

    this.playerWorldRuntimeStore.setInput(client.id, {
      sequence: player.lastProcessedInputSequence,
      up: false,
      down: false,
      left: false,
      right: false,
    });

    /* Entramos al nuevo room */
    await client.join(targetRoom);

    /* Los jugadores que ya estaban en el destino deben saber que llegamos */
    client.to(targetRoom).emit('playerJoined', player);

    client.emit(MAP_EVENTS.TRANSITION_RESOLVED, resolvedTransition);
  }

  @SubscribeMessage(POKEMON_EVENTS.STORAGE_OPEN)
  handlePokemonStorageOpen(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonStorageNetworkController.handleOpen(client, payload);
  }

  @SubscribeMessage(POKEMON_EVENTS.STORAGE_CLOSE)
  handlePokemonStorageClose(
    @ConnectedSocket()
    client: Socket,
  ): void {
    this.pokemonStorageNetworkController.handleClose(client);
  }

  @SubscribeMessage(POKEMON_EVENTS.STORAGE_COMMAND)
  handlePokemonStorageCommand(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    return this.pokemonStorageNetworkController.handleCommand(client, payload);
  }

  private handleDialoguePostAction(client: Socket, npc: SharedMapNpc): void {
    const action = npc.postDialogueAction;

    if (!action) {
      return;
    }

    switch (action) {
      case 'chooseStarter': {
        const trainerId = this.getTrainerId(client.id);
        if (!trainerId) {
          return;
        }

        const trainerState = this.pokemonTrainerStateStore.get(trainerId);
        if (!trainerState) {
          return;
        }
        if (trainerState.party.pokemon.length > 0) {
          return;
        }

        this.pokemonTrainerStateStore.unlockStarterSelection(trainerId);

        client.emit(POKEMON_EVENTS.STARTER_SELECTION_STATUS, {
          unlocked: true,
        } satisfies PokemonStarterSelectionStatus);
        return;
      }
    }
  }

  private startGameLoop() {
    const tickInterval = 1000 / SERVER_TICK_RATE;

    this.gameLoop = setInterval(() => {
      this.updatePlayers(tickInterval);
    }, tickInterval);
  }

  private updatePlayers(deltaMs: number) {
    const deltaSeconds = deltaMs / 1000;

    for (const [playerId, player] of this.playerWorldRuntimeStore.entries()) {
      const input = this.playerWorldRuntimeStore.getInput(playerId);
      if (!input) {
        continue;
      }
      this.updatePlayer(player, input, deltaSeconds);
    }

    this.emitPlayersStateByMap();
  }

  private updatePlayer(
    player: Player,
    input: PlayerInput,
    deltaSeconds: number,
  ) {
    const wasMoving = player.isMoving;
    const isInDialogue = this.dialogueSessionStore.has(player.id);
    const isUsingStorage = this.pokemonStorageAccessSessionStore.has(player.id);
    const isInBattle =
      this.pokemonBattleSessionStore.getByPlayerId(player.id) !== undefined;

    if (isInDialogue || isUsingStorage || isInBattle) {
      player.isMoving = false;
      if (wasMoving) {
        this.checkpointPlayerWorldLocation(player);
      }
      return;
    }

    player.direction = getDirectionFromInput(input, player.direction);
    player.isMoving = isPlayerMoving(input);

    const mapData = MAP_DATA_REGISTRY[player.mapId];

    const previousX = player.x;
    const previousY = player.y;

    const updatedPlayer = applyPlayerMovement(player, input, deltaSeconds);
    const resolvedPosition = resolveMapCollision(
      {
        x: player.x,
        y: player.y,
      },
      {
        x: updatedPlayer.x,
        y: updatedPlayer.y,
      },
      PLAYER_SIZE,
      mapData,
    );

    player.x = resolvedPosition.x;
    player.y = resolvedPosition.y;

    if (wasMoving && !player.isMoving) {
      this.checkpointPlayerWorldLocation(player);
    }

    const movedDistance = Math.hypot(
      player.x - previousX,
      player.y - previousY,
    );
    this.updatePlayerEncounterZone(player);

    const encounterZone = getServerEncounterZoneAtPosition(
      player.mapId,
      player.x,
      player.y,
    );

    if (this.pokemonWildEncounterSessionStore.has(player.id)) {
      return;
    }

    const encounterTrigger = this.pokemonWildEncounterTriggerService.update(
      player.id,
      encounterZone,
      movedDistance,
    );

    if (!encounterTrigger) {
      return;
    }

    const trainerId = this.getTrainerId(player.id);

    if (!trainerId) {
      console.warn('[WildEncounter] trainer identity missing', {
        playerId: player.id,
      });
      return;
    }

    const wildEncounter = createWildPokemonEncounter(
      encounterTrigger.zoneId,
      encounterTrigger.encounterTableId,
    );

    const encounterSession = this.pokemonWildEncounterSessionStore.create({
      playerId: player.id,
      trainerId,
      mapId: player.mapId,
      zoneId: wildEncounter.zoneId,
      encounterTableId: encounterTrigger.encounterTableId,
      pokemon: wildEncounter.pokemon,
    });

    this.emitWildEncounterStarted(encounterSession);
    this.pokemonWildBattleStarter.start(encounterSession);
  }

  private isDisplayNameInUse(displayName: string): boolean {
    return this.playerWorldRuntimeStore.isDisplayNameInUse(displayName);
  }

  private getMapRoom(mapId: MapId): string {
    return `map:${mapId}`;
  }

  private emitPlayersStateByMap(): void {
    for (const mapId of this.playerWorldRuntimeStore.getActiveMapIds()) {
      const room = this.getMapRoom(mapId);
      const players = this.playerWorldRuntimeStore.getPlayersInMap(mapId);
      this.server.to(room).emit('playersState', players);
    }
  }

  private getTrainerId(playerId: string): PokemonTrainerId | undefined {
    return this.trainerConnectionStore.getTrainerId(playerId);
  }

  private updatePlayerEncounterZone(player: Player): void {
    const zone = getServerEncounterZoneAtPosition(
      player.mapId,
      player.x,
      player.y,
    );

    const previousZoneId = this.playerEncounterZoneIds.get(player.id);
    const currentZoneId = zone?.id;
    if (previousZoneId === currentZoneId) {
      return;
    }

    if (currentZoneId === undefined) {
      this.playerEncounterZoneIds.delete(player.id);
    } else {
      this.playerEncounterZoneIds.set(player.id, currentZoneId);
    }

    if (previousZoneId === undefined && currentZoneId !== undefined) {
      console.log('[EncounterZone] entered', {
        playerId: player.id,
        mapId: player.mapId,
        zoneId: currentZoneId,
        encounterTableId: zone?.encounterTableId,
        x: player.x,
        y: player.y,
      });
      return;
    }

    if (previousZoneId !== undefined && currentZoneId === undefined) {
      console.log('[EncounterZone] left', {
        playerId: player.id,
        mapId: player.mapId,
        zoneId: previousZoneId,
        x: player.x,
        y: player.y,
      });
      return;
    }
  }

  private emitWildEncounterStarted(
    encounterSession: PokemonWildEncounterSession,
  ): void {
    const ownerSocket = this.server.sockets.sockets.get(
      encounterSession.playerId,
    );

    if (!ownerSocket) {
      console.warn('[WildEncounter] owner socket not found', {
        playerId: encounterSession.playerId,
        encounterId: encounterSession.encounterId,
      });

      return;
    }

    const payload: PokemonWildEncounterStartedPayload = {
      encounterId: encounterSession.encounterId,
      zoneId: encounterSession.zoneId,
      encounterTableId: encounterSession.encounterTableId,
      pokemon: encounterSession.pokemon,
    };

    ownerSocket.emit(POKEMON_EVENTS.WILD_ENCOUNTER_STARTED, payload);
  }

  private checkpointPlayerWorldLocation(player: Player): void {
    const trainerId = this.getTrainerId(player.id);
    if (!trainerId) {
      return;
    }
    this.playerWorldStateService.checkpointPlayer(trainerId, player);
  }

  private unbindTrainerConnection(playerId: string): void {
    this.trainerConnectionStore.unbind(playerId);
  }
}
