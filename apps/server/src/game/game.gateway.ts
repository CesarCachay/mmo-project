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
  PLAYER_COLORS,
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
  isPokemonStarterChoiceInput,
  DIALOGUE_EVENTS,
  isDialogueStartInput,
  isDialogueAdvanceInput,
  createWildPokemonEncounter,
  createBattleCommand,
  isPokemonBattleCommandInput,
  isBattleTurnReady,
  createBattleTurnResolutionOrder,
  createBattleMoveExecutionContext,
  resolveBattleMoveAccuracy,
  consumeBattleMovePp,
  applyBattleMoveDamage,
  calculateBattleMoveDamage,
  evaluateBattleMoveExecutionEligibility,
  resolveWildBattleContinuationOutcome,
  isPokemonBattleReplacementInput,
  planBattleHealingItemUse,
  isPokemonStorageOpenInput,
  isPokemonStorageCommand,
} from '@cesar-mmo/shared';
import {
  getServerMapSpawn,
  getServerMapTransition,
  isPlayerInsideMapTransition,
  getServerMapNpc,
  isPlayerNearMapNpc,
  getServerEncounterZoneAtPosition,
  getServerMapStorageTerminal,
  isPlayerNearMapStorageTerminal,
} from './maps/serverMapRegistry';
import { ChatService } from 'src/chat/chat.service';

import type { PlayerWorldLocation } from './world/player-world.types';
import type {
  Player,
  PlayerInput,
  MapTransitionResolved,
  MapId,
  PokemonTrainerStatePayload,
  PokemonStarterSelectionStatus,
  SharedMapNpc,
  PokemonTrainerSessionPayload,
  PokemonTrainerState,
  PokemonFollowerPublicState,
  PokemonWildEncounterStartedPayload,
  PokemonBattleStartedPayload,
  BattleTurnResolutionEntry,
  PokemonBattleStateUpdatedPayload,
  BattlePresentationEvent,
  PokemonBattleTurnResolvedPayload,
  PokemonBattleCompletedPayload,
  PokemonStorageStatePayload,
  PokemonStorageErrorPayload,
  PokemonStorageErrorCode,
} from '@cesar-mmo/shared';
import type {
  PokemonTrainerId,
  PokemonTrainerSessionToken,
  PokemonTrainerIdentity,
} from 'src/pokemon/pokemon-trainer-identity';
import type { PokemonWildEncounterSession } from 'src/pokemon/encounters/pokemon-wild-encounter-session';

// db and repositories
import { PokemonTrainerRepository } from 'src/pokemon/pokemon-trainer.repository';
import { PokemonPartyRepository } from 'src/pokemon/pokemon-party.repository';
import { PokemonInventoryRepository } from 'src/pokemon/inventory/pokemon-inventory.repository';
import { PokemonCaptureRepository } from 'src/pokemon/battles/capture/pokemon-capture.repository';
import {
  PokemonStorageRepository,
  PokemonStoragePersistenceError,
} from 'src/pokemon/storage/pokemon-storage.repository';

// services
import { PokemonTrainerService } from 'src/pokemon/pokemon-trainer.service';
import { PokemonTrainerStateStore } from 'src/pokemon/pokemon-trainer-state.store';
import { DialogueSessionService } from 'src/dialogue/dialogue-session.service';
import { DialogueSessionStore } from 'src/dialogue/dialogue-session.store';
import { PokemonTrainerIdentityStore } from 'src/pokemon/pokemon-trainer-identity.store';
import { isPokemonTrainerSessionToken } from 'src/pokemon/pokemon-trainer-identity';
import { PokemonWildEncounterTriggerService } from 'src/pokemon/encounters/pokemon-wild-encounter-trigger.service';
import { PokemonWildEncounterSessionStore } from 'src/pokemon/encounters/pokemon-wild-encounter-session.store';
import { PokemonBattleSessionStore } from '../pokemon/battles/pokemon-battle-session.store';
import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory';
import { PokemonBattleTurnStore } from 'src/pokemon/battles/pokemon-battle-turn.store';
import { createWildBattleCommand } from '../pokemon/battles/pokemon-wild-battle-command.factory';

import { applyPokemonTrainerBattleReplacement } from '../pokemon/battles/pokemon-trainer-battle-replacement.runtime';
import type { PokemonBattleSession } from 'src/pokemon/battles/pokemon-battle-session';
import { assertPokemonTrainerBattleSwitchAllowed } from '../pokemon/battles/pokemon-trainer-battle-switch.validator';
import { applyPokemonTrainerBattleSwitch } from 'src/pokemon/battles/pokemon-trainer-battle-switch.runtime';
import { resolvePokemonWildBattleRun } from '../pokemon/battles/run/pokemon-wild-battle-run.runtime';
import { applyPokemonTrainerBattleHealingItem } from 'src/pokemon/items/pokemon-trainer-battle-healing-item.runtime';
import { PokemonCaptureService } from 'src/pokemon/battles/capture/pokemon-capture.service';
import {
  planPokemonWildBattleCapture,
  executePokemonWildBattleCapture,
} from 'src/pokemon/battles/capture/pokemon-wild-battle-capture.runtime';
import {
  applyPokemonWildBattleOutcome,
  applyPokemonWildBattleEscapeOutcome,
  applyPokemonWildBattleCaptureOutcome,
} from '../pokemon/battles/pokemon-wild-battle-outcome.runtime';
import { PlayerWorldStateService } from './world/player-world-state.service';
import { PokemonStorageService } from 'src/pokemon/storage/pokemon-storage.service';

// stores
import { PlayerWorldRuntimeStore } from './world/player-world-runtime.store';
import { PokemonStorageAccessSessionStore } from 'src/pokemon/storage/pokemon-storage-access-session.store';

type BattleTurnTerminalOutcome = 'trainer-escaped' | 'wild-captured';

interface BattleTurnEntryExecutionResult {
  readonly events: readonly BattlePresentationEvent[];
  readonly terminalOutcome: BattleTurnTerminalOutcome | null;
  readonly trainerStateUpdate?: PokemonTrainerState;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
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

  private readonly pokemonTrainerIdentityStore =
    new PokemonTrainerIdentityStore();
  private readonly pokemonTrainerStateStore = new PokemonTrainerStateStore();
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
  private readonly pokemonStorageAccessSessionStore =
    new PokemonStorageAccessSessionStore();

  private nextColorIndex = 0;
  private gameLoop?: ReturnType<typeof setInterval>;

  constructor(
    private readonly chatService: ChatService,
    private readonly pokemonTrainerRepository: PokemonTrainerRepository,
    private readonly pokemonPartyRepository: PokemonPartyRepository,
    private readonly pokemonInventoryRepository: PokemonInventoryRepository,
    private readonly pokemonCaptureRepository: PokemonCaptureRepository,
    private readonly pokemonStorageRepository: PokemonStorageRepository,
    private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore,
    private readonly playerWorldStateService: PlayerWorldStateService,
  ) {
    this.pokemonTrainerService = new PokemonTrainerService(
      this.pokemonTrainerStateStore,
      this.pokemonPartyRepository,
      this.pokemonInventoryRepository,
    );
    this.pokemonCaptureService = new PokemonCaptureService(
      this.pokemonTrainerStateStore,
      this.pokemonCaptureRepository,
    );
    this.pokemonStorageService = new PokemonStorageService(
      this.pokemonTrainerStateStore,
      this.pokemonPartyRepository,
      this.pokemonStorageRepository,
    );
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
    const displayName = this.getRequestedDisplayName(client);
    const avatarId: unknown = client.handshake.auth.avatarId;

    if (!isPlayerAvatarId(avatarId)) {
      client.emit('connectionRejected', {
        code: 'INVALID_AVATAR',
        message: 'Invalid character selected.',
      });
      client.disconnect();
      return;
    }

    if (!displayName) {
      client.emit('connectionRejected', {
        code: 'INVALID_DISPLAY_NAME',
        message: 'Player name must contain between 3 and 16 characters.',
      });
      client.disconnect(true);
      return;
    }

    if (this.isDisplayNameInUse(displayName)) {
      client.emit('connectionRejected', {
        code: 'NAME_ALREADY_IN_USE',
        message: 'That player name is already in use.',
      });
      client.disconnect(true);
      return;
    }

    const color = PLAYER_COLORS[this.nextColorIndex % PLAYER_COLORS.length];

    this.nextColorIndex++;

    const requestedTrainerSessionToken =
      this.getRequestedTrainerSessionToken(client);

    let trainerIdentity: PokemonTrainerIdentity;
    let trainerState: PokemonTrainerState;
    let initialWorldLocation: PlayerWorldLocation;

    try {
      const resolution = await this.resolvePokemonTrainerIdentity(
        client.id,
        requestedTrainerSessionToken,
      );
      trainerIdentity = resolution.identity;
      const existingTrainerState = this.pokemonTrainerStateStore.get(
        trainerIdentity.trainerId,
      );

      if (existingTrainerState) {
        trainerState = existingTrainerState;
      } else {
        const [persistedParty, persistedInventory] = await Promise.all([
          this.pokemonPartyRepository.loadParty(trainerIdentity.trainerId),
          this.pokemonInventoryRepository.loadInventory(
            trainerIdentity.trainerId,
          ),
        ]);

        trainerState = this.pokemonTrainerStateStore.create(
          trainerIdentity.trainerId,
          persistedParty,
          persistedInventory,
        );
      }

      initialWorldLocation =
        await this.playerWorldStateService.loadInitialLocation(
          trainerIdentity.trainerId,
        );

      // TO REMOVE - TEST
      // trainerState =
      //   await this.pokemonTrainerService.ensureDevelopmentBattleTestParty(
      //     trainerIdentity.trainerId,
      //   );
    } catch (error: unknown) {
      console.error('[PokemonTrainerIdentity] resolution failed', error);
      this.pokemonTrainerIdentityStore.unbind(client.id);
      client.emit('connectionRejected', {
        code: 'TRAINER_SESSION_ERROR',
        message: 'Could not restore the trainer session.',
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
      color,
      direction: initialWorldLocation.direction,
      isMoving: false,
      lastProcessedInputSequence: 0,
    };

    this.playerWorldRuntimeStore.addPlayer(newPlayer);
    this.syncPlayerPokemonFollower(client.id, trainerState);
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

    client.emit(POKEMON_EVENTS.TRAINER_SESSION, {
      sessionToken: trainerIdentity.sessionToken,
    } satisfies PokemonTrainerSessionPayload);

    client.emit(POKEMON_EVENTS.TRAINER_STATE, trainerStatePayload);

    const mapRoom = this.getMapRoom(newPlayer.mapId);
    await client.join(mapRoom);

    console.log(`Player connected: ${client.id}`);
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

    this.pokemonTrainerIdentityStore.unbind(client.id);
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

  @SubscribeMessage(POKEMON_EVENTS.CHOOSE_STARTER)
  async handleChooseStarter(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    if (!isPokemonStarterChoiceInput(payload)) {
      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);
    if (!player) {
      return;
    }

    const trainerId = this.getTrainerId(client.id);
    if (!trainerId) {
      return;
    }

    const starterNpc = getServerMapNpc(player.mapId, 'professorOak');
    if (!starterNpc || !isPlayerNearMapNpc(player.x, player.y, starterNpc)) {
      this.pokemonTrainerStateStore.lockStarterSelection(trainerId);
      return;
    }

    try {
      const trainerState = await this.pokemonTrainerService.chooseStarter(
        trainerId,
        payload.starterId,
      );

      this.syncPlayerPokemonFollower(client.id, trainerState);

      client.emit(POKEMON_EVENTS.TRAINER_STATE, {
        trainerState,
      });
    } catch (error: unknown) {
      console.warn(
        `[Pokemon] Starter selection rejected for player ${client.id}`,
        error,
      );
      const trainerState = this.pokemonTrainerStateStore.get(trainerId);
      if (!trainerState) {
        return;
      }
      client.emit(POKEMON_EVENTS.TRAINER_STATE, {
        trainerState,
      });
    }
  }

  @SubscribeMessage(POKEMON_EVENTS.BATTLE_COMMAND)
  async handleBattleCommand(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    if (!isPokemonBattleCommandInput(payload)) {
      return;
    }

    const session = this.pokemonBattleSessionStore.getByPlayerId(client.id);

    if (!session) {
      return;
    }
    if (session.battle.battleId !== payload.battleId) {
      return;
    }

    const trainerBinding = session.trainerBindings.find(
      (binding) => binding.playerId === client.id,
    );

    if (!trainerBinding) {
      return;
    }

    try {
      if (payload.action.type === 'use-item') {
        if (payload.action.target.type === 'wild-active') {
          planPokemonWildBattleCapture({
            session,
            playerId: client.id,
            action: payload.action,
            trainerStateStore: this.pokemonTrainerStateStore,
          });
        } else {
          const trainerState = this.pokemonTrainerStateStore.get(
            trainerBinding.trainerId,
          );

          if (!trainerState) {
            throw new Error(
              `Pokémon Trainer state not found for trainer "${trainerBinding.trainerId}"`,
            );
          }

          planBattleHealingItemUse(
            session.battle,
            trainerBinding.participantId,
            payload.action,
            trainerState.inventory,
          );
        }
      }

      if (payload.action.type === 'switch-pokemon') {
        assertPokemonTrainerBattleSwitchAllowed({
          session,
          playerId: client.id,
          pokemonIndex: payload.action.pokemonIndex,
        });
      }

      const trainerCommand = createBattleCommand(session.battle, {
        participantId: trainerBinding.participantId,
        action: payload.action,
      });

      let turn = this.pokemonBattleTurnStore.submitCommand(
        session.battle,
        trainerCommand,
      );

      const wildCommand = createWildBattleCommand(session.battle);

      turn = this.pokemonBattleTurnStore.submitCommand(
        session.battle,
        wildCommand,
      );

      if (!isBattleTurnReady(session.battle, turn)) {
        throw new Error(
          `Battle turn ${turn.number} for battle "${session.battle.battleId}" should be ready after Wild command submission`,
        );
      }

      const resolutionOrder = createBattleTurnResolutionOrder(
        session.battle,
        turn,
        Math.random,
      );

      const presentationEvents: BattlePresentationEvent[] = [];

      let terminalOutcome: BattleTurnTerminalOutcome | null = null;

      let trainerStateUpdate: PokemonTrainerState | null = null;

      for (const entry of resolutionOrder.entries) {
        const executionResult = await this.executeBattleTurnEntry(
          session,
          entry,
          client.id,
        );

        presentationEvents.push(...executionResult.events);

        if (executionResult.trainerStateUpdate) {
          trainerStateUpdate = executionResult.trainerStateUpdate;
        }

        if (executionResult.terminalOutcome) {
          terminalOutcome = executionResult.terminalOutcome;
          break;
        }
      }

      const turnResolvedPayload = {
        battleId: session.battle.battleId,
        turnNumber: turn.number,
        events: presentationEvents,
      } satisfies PokemonBattleTurnResolvedPayload;

      client.emit(POKEMON_EVENTS.BATTLE_TURN_RESOLVED, turnResolvedPayload);

      if (terminalOutcome === 'trainer-escaped') {
        const updatedTrainerState = await this.syncBattleResultToTrainer(
          session,
          trainerBinding.trainerId,
          trainerBinding.participantId,
        );

        const escapeOutcome = applyPokemonWildBattleEscapeOutcome({
          battleId: session.battle.battleId,
          battleSessionStore: this.pokemonBattleSessionStore,
          battleTurnStore: this.pokemonBattleTurnStore,
        });

        client.emit(POKEMON_EVENTS.TRAINER_STATE, {
          trainerState: updatedTrainerState,
        } satisfies PokemonTrainerStatePayload);

        client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
          battleId: session.battle.battleId,
          outcome: escapeOutcome.type,
        } satisfies PokemonBattleCompletedPayload);

        return;
      }

      if (terminalOutcome === 'wild-captured') {
        if (!trainerStateUpdate) {
          throw new Error(
            `Trainer state missing after successful capture in battle "${session.battle.battleId}"`,
          );
        }

        const captureOutcome = applyPokemonWildBattleCaptureOutcome({
          battleId: session.battle.battleId,
          battleSessionStore: this.pokemonBattleSessionStore,
          battleTurnStore: this.pokemonBattleTurnStore,
        });

        client.emit(POKEMON_EVENTS.TRAINER_STATE, {
          trainerState: trainerStateUpdate,
        } satisfies PokemonTrainerStatePayload);

        client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
          battleId: session.battle.battleId,
          outcome: captureOutcome.type,
        } satisfies PokemonBattleCompletedPayload);

        return;
      }

      const continuationOutcome = resolveWildBattleContinuationOutcome(
        session.battle,
      );

      if (
        trainerStateUpdate &&
        (continuationOutcome.type === 'continue' ||
          continuationOutcome.type === 'trainer-replacement-required')
      ) {
        client.emit(POKEMON_EVENTS.TRAINER_STATE, {
          trainerState: trainerStateUpdate,
        } satisfies PokemonTrainerStatePayload);
      }

      const battleIsTerminal =
        continuationOutcome.type === 'trainer-defeated' ||
        continuationOutcome.type === 'wild-defeated';

      const updatedTrainerState = battleIsTerminal
        ? await this.syncBattleResultToTrainer(
            session,
            trainerBinding.trainerId,
            trainerBinding.participantId,
          )
        : null;

      const outcomeRuntime = applyPokemonWildBattleOutcome({
        battleId: session.battle.battleId,
        outcome: continuationOutcome,
        battleSessionStore: this.pokemonBattleSessionStore,
        battleTurnStore: this.pokemonBattleTurnStore,
      });

      if (outcomeRuntime.type === 'continue') {
        const nextTurn = this.pokemonBattleTurnStore.advance(session.battle);

        client.emit(POKEMON_EVENTS.BATTLE_STATE_UPDATED, {
          battle: session.battle,
          resolvedTurnNumber: turn.number,
          interactionState: 'selecting-action',
          nextTurnNumber: nextTurn.number,
          replacementPokemonIndexes: [],
        } satisfies PokemonBattleStateUpdatedPayload);

        return;
      }

      if (outcomeRuntime.type === 'trainer-replacement-required') {
        client.emit(POKEMON_EVENTS.BATTLE_STATE_UPDATED, {
          battle: session.battle,
          resolvedTurnNumber: turn.number,
          interactionState: 'replacement-required',
          nextTurnNumber: null,
          replacementPokemonIndexes: outcomeRuntime.replacementPokemonIndexes,
        } satisfies PokemonBattleStateUpdatedPayload);

        return;
      }

      if (!updatedTrainerState) {
        throw new Error(
          `Trainer state was not synchronized before completing battle "${session.battle.battleId}"`,
        );
      }

      // First refresh persistent owner state.
      client.emit(POKEMON_EVENTS.TRAINER_STATE, {
        trainerState: updatedTrainerState,
      } satisfies PokemonTrainerStatePayload);

      client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
        battleId: session.battle.battleId,
        outcome: outcomeRuntime.type,
      });
    } catch (error: unknown) {
      console.warn(`[BattleCommand] rejected for player ${client.id}`, error);
    }
  }

  @SubscribeMessage(POKEMON_EVENTS.BATTLE_REPLACEMENT)
  handlePokemonBattleReplacement(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    payload: unknown,
  ): void {
    if (!isPokemonBattleReplacementInput(payload)) {
      return;
    }

    const session = this.pokemonBattleSessionStore.getByPlayerId(client.id);

    if (!session) {
      return;
    }

    if (session.battle.battleId !== payload.battleId) {
      console.warn('[BattleReplacement] rejected battle mismatch', {
        playerId: client.id,
        requestedBattleId: payload.battleId,
        activeBattleId: session.battle.battleId,
      });

      return;
    }

    try {
      const result = applyPokemonTrainerBattleReplacement({
        session,
        playerId: client.id,
        replacementPokemonIndex: payload.replacementPokemonIndex,
        battleTurnStore: this.pokemonBattleTurnStore,
      });

      console.log('[BattleReplacement] resolved', {
        battleId: result.battleId,
        participantId: result.participantId,
        previousActivePokemonIndex: result.previousActivePokemonIndex,
        currentActivePokemonIndex: result.currentActivePokemonIndex,
        activePokemonInstanceId: result.activePokemonInstanceId,
        nextTurnNumber: result.nextTurnNumber,
      });

      // Owner-only acknowledgement.
      client.emit(POKEMON_EVENTS.BATTLE_REPLACEMENT_RESOLVED, {
        battle: session.battle,
        nextTurnNumber: result.nextTurnNumber,
      });
    } catch (error: unknown) {
      console.warn(
        `[BattleReplacement] rejected for player ${client.id}`,
        error,
      );
    }
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
  async handlePokemonStorageOpen(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    if (!isPokemonStorageOpenInput(payload)) {
      this.emitPokemonStorageError(
        client,
        'INVALID_COMMAND',
        'Invalid Pokémon Storage request.',
      );

      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);

    const trainerId = this.getTrainerId(client.id);

    if (!player || !trainerId) {
      this.emitPokemonStorageError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage is not available.',
      );

      return;
    }

    if (
      this.dialogueSessionStore.has(client.id) ||
      this.pokemonBattleSessionStore.getByPlayerId(client.id)
    ) {
      this.emitPokemonStorageError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage cannot be used right now.',
      );

      return;
    }

    const terminal = getServerMapStorageTerminal(
      player.mapId,
      payload.terminalId,
    );

    if (
      !terminal ||
      !isPlayerNearMapStorageTerminal(player.x, player.y, terminal)
    ) {
      this.emitPokemonStorageError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'You are not close enough to this Pokémon Storage terminal.',
      );

      return;
    }

    this.pokemonStorageAccessSessionStore.start(
      client.id,
      player.mapId,
      payload.terminalId,
    );

    try {
      const state = await this.pokemonStorageService.getState(trainerId);

      this.syncPlayerPokemonFollower(client.id, state.trainerState);

      client.emit(POKEMON_EVENTS.TRAINER_STATE, {
        trainerState: state.trainerState,
      } satisfies PokemonTrainerStatePayload);

      client.emit(POKEMON_EVENTS.STORAGE_STATE, {
        party: state.trainerState.party,
        storage: state.storage,
      } satisfies PokemonStorageStatePayload);
    } catch (error: unknown) {
      this.pokemonStorageAccessSessionStore.remove(client.id);
      console.warn(
        `[PokemonStorage] Open rejected for player ${client.id}`,
        error,
      );
      this.emitPokemonStorageError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage could not be opened.',
      );
    }
  }

  @SubscribeMessage(POKEMON_EVENTS.STORAGE_CLOSE)
  handlePokemonStorageClose(
    @ConnectedSocket()
    client: Socket,
  ): void {
    this.pokemonStorageAccessSessionStore.remove(client.id);
  }

  @SubscribeMessage(POKEMON_EVENTS.STORAGE_COMMAND)
  async handlePokemonStorageCommand(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: unknown,
  ): Promise<void> {
    if (!isPokemonStorageCommand(payload)) {
      this.emitPokemonStorageError(
        client,
        'INVALID_COMMAND',
        'Invalid Pokémon Storage command.',
      );

      return;
    }

    const access = this.resolvePokemonStorageAccess(client.id);

    if (!access) {
      this.emitPokemonStorageError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage access is no longer available.',
      );

      return;
    }

    try {
      let state;

      switch (payload.type) {
        case 'withdraw':
          state = await this.pokemonStorageService.withdraw(
            access.trainerId,
            payload.pokemonInstanceId,
          );
          break;

        case 'deposit':
          state = await this.pokemonStorageService.deposit(
            access.trainerId,
            payload.pokemonInstanceId,
          );
          break;

        case 'swap':
          state = await this.pokemonStorageService.swap(
            access.trainerId,
            payload.storedPokemonInstanceId,
            payload.partyPokemonInstanceId,
          );
          break;
      }

      this.syncPlayerPokemonFollower(client.id, state.trainerState);

      /* Global TrainerState owner-only */
      client.emit(POKEMON_EVENTS.TRAINER_STATE, {
        trainerState: state.trainerState,
      } satisfies PokemonTrainerStatePayload);

      /* PC snapshot owner-only */
      client.emit(POKEMON_EVENTS.STORAGE_STATE, {
        party: state.trainerState.party,
        storage: state.storage,
      } satisfies PokemonStorageStatePayload);
    } catch (error: unknown) {
      if (error instanceof PokemonStoragePersistenceError) {
        this.emitPokemonStorageError(client, error.code, error.message);
        return;
      }
      console.warn(
        `[PokemonStorage] Command rejected for player ${client.id}`,
        error,
      );
      this.emitPokemonStorageError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage command failed.',
      );
    }
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
    this.startWildBattle(encounterSession);

    console.log('[WildEncounter] started', {
      encounterId: encounterSession.encounterId,
      playerId: encounterSession.playerId,
      speciesId: encounterSession.pokemon.speciesId,
      level: encounterSession.pokemon.level,
    });
  }

  private getRequestedDisplayName(client: Socket): string | null {
    const auth: unknown = client.handshake.auth;

    if (typeof auth !== 'object' || auth === null) {
      return null;
    }

    const { displayName } = auth as Record<string, unknown>;

    if (typeof displayName !== 'string') {
      return null;
    }

    const normalizedDisplayName = displayName.trim();

    if (normalizedDisplayName.length < 3 || normalizedDisplayName.length > 16) {
      return null;
    }

    return normalizedDisplayName;
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
    return this.pokemonTrainerIdentityStore.get(playerId)?.trainerId;
  }

  private getRequestedTrainerSessionToken(
    client: Socket,
  ): PokemonTrainerSessionToken | undefined {
    const value: unknown = client.handshake.auth.trainerSessionToken;

    if (!isPokemonTrainerSessionToken(value)) {
      return undefined;
    }

    return value;
  }

  private async resolvePokemonTrainerIdentity(
    playerId: string,
    sessionToken?: PokemonTrainerSessionToken,
  ): Promise<{
    identity: PokemonTrainerIdentity;
    restored: boolean;
  }> {
    if (sessionToken) {
      const persistedTrainer =
        await this.pokemonTrainerRepository.findBySessionToken(sessionToken);

      if (persistedTrainer) {
        const identity: PokemonTrainerIdentity = {
          trainerId: persistedTrainer.trainerId,
          sessionToken,
        };

        this.pokemonTrainerIdentityStore.bindRecovered(playerId, identity);

        return {
          identity,
          restored: true,
        };
      }
    }

    const { identity } = this.pokemonTrainerIdentityStore.resolve(playerId);

    await this.pokemonTrainerRepository.create(identity);

    return {
      identity,
      restored: false,
    };
  }

  private getPokemonFollowerPublicState(
    trainerState: PokemonTrainerState,
  ): PokemonFollowerPublicState | undefined {
    const pokemon = trainerState.party.pokemon[0];

    if (!pokemon) {
      return undefined;
    }

    return {
      speciesId: pokemon.speciesId,
      formId: pokemon.formId,
    };
  }

  private syncPlayerPokemonFollower(
    playerId: string,
    trainerState: PokemonTrainerState,
  ): void {
    const player = this.playerWorldRuntimeStore.getPlayer(playerId);

    if (!player) {
      return;
    }

    player.pokemonFollower = this.getPokemonFollowerPublicState(trainerState);
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

  private startWildBattle(encounterSession: PokemonWildEncounterSession): void {
    if (
      this.pokemonBattleSessionStore.hasTrainerBattle(
        encounterSession.trainerId,
      )
    ) {
      return;
    }

    const trainerState = this.pokemonTrainerStateStore.get(
      encounterSession.trainerId,
    );

    if (!trainerState) {
      throw new Error(
        `Trainer state not found for trainer "${encounterSession.trainerId}"`,
      );
    }

    if (trainerState.party.pokemon.length === 0) {
      throw new Error(
        `Trainer "${encounterSession.trainerId}" cannot start battle without Pokémon`,
      );
    }

    const battle = createWildBattleInstance({
      encounterSession,
      trainerPokemon: trainerState.party.pokemon,
    });

    const trainerParticipant = battle.participants.find(
      (participant) => participant.type === 'trainer',
    );

    if (!trainerParticipant) {
      throw new Error(
        `Trainer participant not found in battle "${battle.battleId}"`,
      );
    }

    const battleSession = this.pokemonBattleSessionStore.create({
      battle,
      trainerBindings: [
        {
          participantId: trainerParticipant.id,
          trainerId: encounterSession.trainerId,
          playerId: encounterSession.playerId,
        },
      ],
    });

    try {
      this.pokemonBattleTurnStore.create(battleSession.battle);
    } catch (error) {
      this.pokemonBattleSessionStore.remove(battleSession.battle.battleId);
      throw error;
    }

    this.pokemonWildEncounterSessionStore.remove(encounterSession.playerId);
    this.pokemonStorageAccessSessionStore.remove(encounterSession.playerId);

    const ownerSocket = this.server.sockets.sockets.get(
      encounterSession.playerId,
    );
    if (!ownerSocket) {
      return;
    }

    const payload: PokemonBattleStartedPayload = {
      battle: battleSession.battle,
    };

    ownerSocket.emit(POKEMON_EVENTS.BATTLE_STARTED, payload);
  }

  private async executeBattleTurnEntry(
    session: PokemonBattleSession,
    entry: BattleTurnResolutionEntry,
    playerId: string,
  ): Promise<BattleTurnEntryExecutionResult> {
    switch (entry.command.action.type) {
      case 'switch-pokemon': {
        const result = applyPokemonTrainerBattleSwitch({
          session,
          entry,
        });

        return {
          events: [
            {
              type: 'pokemon-switched',
              participantId: result.participantId,
              previousActivePokemonIndex: result.previousActivePokemonIndex,
              currentActivePokemonIndex: result.currentActivePokemonIndex,
              previousPokemonInstanceId: result.previousPokemonInstanceId,
              currentPokemonInstanceId: result.activePokemonInstanceId,
            },
          ],
          terminalOutcome: null,
        };
      }

      case 'run': {
        const result = resolvePokemonWildBattleRun({
          session,
          entry,
          random: Math.random,
        });

        if (result.type === 'run-succeeded') {
          return {
            events: [
              {
                type: 'run-succeeded',
                participantId: entry.command.participantId,
              },
            ],
            terminalOutcome: result.terminalOutcome,
          };
        }

        return {
          events: [
            {
              type: 'run-failed',
              participantId: entry.command.participantId,
            },
          ],
          terminalOutcome: null,
        };
      }

      case 'use-item': {
        if (entry.command.action.target.type === 'wild-active') {
          const result = await executePokemonWildBattleCapture({
            session,
            entry,
            playerId,
            trainerStateStore: this.pokemonTrainerStateStore,
            trainerService: this.pokemonTrainerService,
            captureService: this.pokemonCaptureService,
            random: Math.random,
            // random: () => 0.999999,
          });

          const wildParticipant = session.battle.participants.find(
            (participant) => participant.type === 'wild',
          );

          if (!wildParticipant) {
            throw new Error(
              `Wild participant not found in battle "${session.battle.battleId}"`,
            );
          }

          const wildPokemonState =
            wildParticipant.pokemon[wildParticipant.activePokemonIndex];

          if (!wildPokemonState) {
            throw new Error(
              `Wild active Pokémon not found in battle "${session.battle.battleId}"`,
            );
          }

          /* Primer evento: Trainer usó una Poké Ball */
          const itemUsedEvent: BattlePresentationEvent = {
            type: 'item-used',
            participantId: entry.command.participantId,
            itemId: entry.command.action.itemId,
            targetPokemonInstanceId: wildPokemonState.pokemon.instanceId,
          };

          /* CAPTURE FAILURE */
          if (result.type === 'capture-failed') {
            return {
              events: [
                itemUsedEvent,
                {
                  type: 'capture-failed',
                  participantId: entry.command.participantId,
                  wildParticipantId: wildParticipant.id,
                  pokemonInstanceId: wildPokemonState.pokemon.instanceId,
                  itemId: entry.command.action.itemId,
                  shakeCount: result.shakeCount,
                },
              ],
              terminalOutcome: null,
              trainerStateUpdate: result.trainerState,
            };
          }

          /* CAPTURE SUCCESS */
          return {
            events: [
              itemUsedEvent,
              {
                type: 'capture-succeeded',
                participantId: entry.command.participantId,
                wildParticipantId: wildParticipant.id,
                pokemonInstanceId: wildPokemonState.pokemon.instanceId,
                itemId: entry.command.action.itemId,
                shakeCount: result.shakeCount,
              },
            ],
            terminalOutcome: result.terminalOutcome,
            trainerStateUpdate: result.trainerState,
          };
        }

        const result = await applyPokemonTrainerBattleHealingItem({
          session,
          entry,
          playerId,
          trainerStateStore: this.pokemonTrainerStateStore,
          trainerService: this.pokemonTrainerService,
        });

        return {
          events: [],
          terminalOutcome: null,
          trainerStateUpdate: result.trainerState,
        };
      }

      case 'use-move': {
        break;
      }
    }

    const eligibility = evaluateBattleMoveExecutionEligibility(
      session.battle,
      entry,
    );

    if (!eligibility.canExecute) {
      return {
        events: [],
        terminalOutcome: null,
      };
    }

    const executionContext = createBattleMoveExecutionContext(
      session.battle,
      entry,
    );

    consumeBattleMovePp(executionContext);

    const moveUsedEvent: BattlePresentationEvent = {
      type: 'move-used',
      participantId: executionContext.actorParticipantId,
      pokemonInstanceId: executionContext.actorPokemon.pokemon.instanceId,
      moveId: executionContext.move.id,
    };

    const accuracyResult = resolveBattleMoveAccuracy(
      executionContext,
      Math.random,
    );

    if (!accuracyResult.hit) {
      return {
        events: [
          moveUsedEvent,
          {
            type: 'move-missed',
            participantId: executionContext.actorParticipantId,
            pokemonInstanceId: executionContext.actorPokemon.pokemon.instanceId,
            moveId: executionContext.move.id,
          },
        ],
        terminalOutcome: null,
      };
    }

    const targetPreviousHp = executionContext.targetPokemon.currentHp;

    const damageResult = calculateBattleMoveDamage(executionContext);

    const damageApplication = applyBattleMoveDamage(
      executionContext,
      damageResult,
    );

    const events: BattlePresentationEvent[] = [moveUsedEvent];

    const resolvesDirectDamage =
      damageResult.damageClass !== 'status' && damageResult.power !== null;

    if (!resolvesDirectDamage) {
      return {
        events,
        terminalOutcome: null,
      };
    }

    const targetPokemonInstanceId =
      executionContext.targetPokemon.pokemon.instanceId;

    const targetParticipant = session.battle.participants.find((participant) =>
      participant.pokemon.some(
        (pokemonState) =>
          pokemonState.pokemon.instanceId === targetPokemonInstanceId,
      ),
    );

    if (!targetParticipant) {
      throw new Error(
        `Battle participant for target Pokémon "${targetPokemonInstanceId}" not found in battle "${session.battle.battleId}"`,
      );
    }

    events.push({
      type: 'damage-applied',
      participantId: targetParticipant.id,
      pokemonInstanceId: targetPokemonInstanceId,
      previousHp: targetPreviousHp,
      currentHp: damageApplication.currentHp,
      appliedDamage: damageApplication.appliedDamage,
      typeEffectiveness: damageResult.typeEffectiveness,
    });

    if (targetPreviousHp > 0 && damageApplication.currentHp === 0) {
      events.push({
        type: 'pokemon-fainted',
        participantId: targetParticipant.id,
        pokemonInstanceId: targetPokemonInstanceId,
      });
    }

    return {
      events,
      terminalOutcome: null,
    };
  }

  private async syncBattleResultToTrainer(
    session: PokemonBattleSession,
    trainerId: PokemonTrainerId,
    trainerParticipantId: string,
  ): Promise<PokemonTrainerState> {
    const trainerParticipant = session.battle.participants.find(
      (participant) => participant.id === trainerParticipantId,
    );

    if (!trainerParticipant) {
      throw new Error(
        `Trainer participant "${trainerParticipantId}" not found while finalizing battle "${session.battle.battleId}"`,
      );
    }

    if (trainerParticipant.type !== 'trainer') {
      throw new Error(
        `Battle participant "${trainerParticipant.id}" is not a Trainer`,
      );
    }

    return this.pokemonTrainerService.syncBattleParticipantResult(
      trainerId,
      trainerParticipant,
    );
  }

  private resolvePokemonStorageAccess(playerId: string):
    | {
        trainerId: PokemonTrainerId;
      }
    | undefined {
    const player = this.playerWorldRuntimeStore.getPlayer(playerId);

    if (!player) {
      return undefined;
    }

    const trainerId = this.getTrainerId(playerId);

    if (!trainerId) {
      return undefined;
    }

    if (this.pokemonBattleSessionStore.getByPlayerId(playerId)) {
      this.pokemonStorageAccessSessionStore.remove(playerId);
      return undefined;
    }

    if (this.dialogueSessionStore.has(playerId)) {
      this.pokemonStorageAccessSessionStore.remove(playerId);
      return undefined;
    }

    const session = this.pokemonStorageAccessSessionStore.get(playerId);

    if (!session) {
      return undefined;
    }

    /* El mapa actual debe seguir siendo exactamente aquel donde se abrió la PC */
    if (session.mapId !== player.mapId) {
      this.pokemonStorageAccessSessionStore.remove(playerId);
      return undefined;
    }

    const terminal = getServerMapStorageTerminal(
      player.mapId,
      session.terminalId,
    );

    if (!terminal) {
      this.pokemonStorageAccessSessionStore.remove(playerId);
      return undefined;
    }

    /* Revalidamos proximity EN CADA COMMAND. Abrir la PC una vez no concede acceso eterno */
    if (!isPlayerNearMapStorageTerminal(player.x, player.y, terminal)) {
      this.pokemonStorageAccessSessionStore.remove(playerId);
      return undefined;
    }

    return {
      trainerId,
    };
  }

  private emitPokemonStorageError(
    client: Socket,
    code: PokemonStorageErrorCode,
    message: string,
  ): void {
    client.emit(POKEMON_EVENTS.STORAGE_ERROR, {
      code,
      message,
    } satisfies PokemonStorageErrorPayload);
  }

  private checkpointPlayerWorldLocation(player: Player): void {
    const trainerId = this.getTrainerId(player.id);
    if (!trainerId) {
      return;
    }
    this.playerWorldStateService.checkpointPlayer(trainerId, player);
  }
}
