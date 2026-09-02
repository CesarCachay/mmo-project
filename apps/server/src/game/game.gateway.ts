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
  DEFAULT_MAP_ID,
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
} from '@cesar-mmo/shared';
import {
  getServerMapSpawn,
  getServerMapTransition,
  isPlayerInsideMapTransition,
  getServerMapNpc,
  isPlayerNearMapNpc,
  getServerEncounterZoneAtPosition,
} from './maps/serverMapRegistry';
import { ChatService } from 'src/chat/chat.service';

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
import {
  applyPokemonWildBattleOutcome,
  applyPokemonWildBattleEscapeOutcome,
} from '../pokemon/battles/pokemon-wild-battle-outcome.runtime';
import { applyPokemonTrainerBattleReplacement } from '../pokemon/battles/pokemon-trainer-battle-replacement.runtime';
import type { PokemonBattleSession } from 'src/pokemon/battles/pokemon-battle-session';
import { assertPokemonTrainerBattleSwitchAllowed } from '../pokemon/battles/pokemon-trainer-battle-switch.validator';
import { applyPokemonTrainerBattleSwitch } from 'src/pokemon/battles/pokemon-trainer-battle-switch.runtime';
import { resolvePokemonWildBattleRun } from '../pokemon/battles/run/pokemon-wild-battle-run.runtime';
import { applyPokemonTrainerBattleHealingItem } from 'src/pokemon/items/pokemon-trainer-battle-healing-item.runtime';

type BattleTurnTerminalOutcome = 'trainer-escaped';

interface BattleTurnEntryExecutionResult {
  readonly events: readonly BattlePresentationEvent[];
  readonly terminalOutcome: 'trainer-escaped' | null;
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

  private players: Record<string, Player> = {};
  private playerInputs: Record<string, PlayerInput> = {};

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

  private nextColorIndex = 0;
  private gameLoop?: ReturnType<typeof setInterval>;

  constructor(
    private readonly chatService: ChatService,
    private readonly pokemonTrainerRepository: PokemonTrainerRepository,
    private readonly pokemonPartyRepository: PokemonPartyRepository,
    private readonly pokemonInventoryRepository: PokemonInventoryRepository,
  ) {
    this.pokemonTrainerService = new PokemonTrainerService(
      this.pokemonTrainerStateStore,
      this.pokemonPartyRepository,
      this.pokemonInventoryRepository,
    );
  }

  afterInit() {
    this.startGameLoop();
  }

  onModuleDestroy() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
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

    const newPlayer: Player = {
      id: client.id,
      mapId: DEFAULT_MAP_ID,
      displayName,
      avatarId,
      x: MAP_DATA_REGISTRY[DEFAULT_MAP_ID].spawn.x,
      y: MAP_DATA_REGISTRY[DEFAULT_MAP_ID].spawn.y,
      color,
      direction: 'down',
      isMoving: false,
      lastProcessedInputSequence: 0,
    };

    const requestedTrainerSessionToken =
      this.getRequestedTrainerSessionToken(client);

    let trainerIdentity: PokemonTrainerIdentity;
    let restored: boolean;
    let trainerState: PokemonTrainerState;

    try {
      const resolution = await this.resolvePokemonTrainerIdentity(
        newPlayer.id,
        requestedTrainerSessionToken,
      );

      trainerIdentity = resolution.identity;

      restored = resolution.restored;

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

      // TO REMOVE - TEST
      trainerState =
        await this.pokemonTrainerService.ensureDevelopmentBattleTestParty(
          trainerIdentity.trainerId,
        );
    } catch (error: unknown) {
      console.error('[PokemonTrainerIdentity] resolution failed', error);

      this.pokemonTrainerIdentityStore.unbind(newPlayer.id);

      client.emit('connectionRejected', {
        code: 'TRAINER_SESSION_ERROR',
        message: 'Could not restore the trainer session.',
      });

      client.disconnect(true);

      return;
    }

    this.players[client.id] = newPlayer;

    this.syncPlayerPokemonFollower(client.id, trainerState);

    this.playerInputs[client.id] = {
      sequence: 0,
      up: false,
      down: false,
      left: false,
      right: false,
    };

    console.log('[PokemonTrainerIdentity]', {
      restored,
      source: restored ? 'postgresql' : 'created',
      playerId: newPlayer.id,
      trainerId: trainerIdentity.trainerId,
      partySize: trainerState.party.pokemon.length,
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
    client.emit('currentPlayers', this.getPlayersInMap(newPlayer.mapId));
    client.to(mapRoom).emit('playerJoined', newPlayer);
  }

  handleDisconnect(client: Socket) {
    const player = this.players[client.id];
    const trainerId = this.getTrainerId(client.id);

    if (trainerId) {
      this.pokemonTrainerStateStore.lockStarterSelection(trainerId);
    }

    this.pokemonTrainerIdentityStore.unbind(client.id);

    this.dialogueSessionStore.remove(client.id);

    if (!player) {
      return;
    }

    console.log(`Player disconnected: ${client.id}`);

    const mapRoom = this.getMapRoom(player.mapId);
    delete this.players[client.id];
    delete this.playerInputs[client.id];
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
    const player = this.players[client.id];

    if (!player) {
      return;
    }

    if (input.sequence <= player.lastProcessedInputSequence) {
      return;
    }

    this.playerInputs[client.id] = input;

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

    const player = this.players[client.id];

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

    const player = this.players[client.id];

    if (!player) {
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

    const player = this.players[client.id];
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

    const player = this.players[client.id];
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

    const player = this.players[client.id];
    if (!player) {
      return;
    }

    if (this.dialogueSessionStore.has(client.id)) {
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

    const fromRoom = this.getMapRoom(fromMapId);
    const targetRoom = this.getMapRoom(transition.targetMapId);

    /* Informamos inmediatamente a los demás jugadores del mapa anterior */
    client.to(fromRoom).emit(MAP_EVENTS.PLAYER_LEFT, player.id);
    await client.leave(fromRoom);

    player.mapId = transition.targetMapId;
    player.x = targetSpawn.x;
    player.y = targetSpawn.y;
    player.isMoving = false;

    this.playerInputs[client.id] = {
      sequence: player.lastProcessedInputSequence,
      up: false,
      down: false,
      left: false,
      right: false,
    };

    /* Entramos al nuevo room */
    await client.join(targetRoom);

    /* Los jugadores que ya estaban en el destino deben saber que llegamos */
    client.to(targetRoom).emit('playerJoined', player);

    client.emit(MAP_EVENTS.TRANSITION_RESOLVED, resolvedTransition);
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

    for (const [playerId, player] of Object.entries(this.players)) {
      const input = this.playerInputs[playerId];

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
    if (this.dialogueSessionStore.has(player.id)) {
      player.isMoving = false;
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
    const normalizedDisplayName = displayName.trim().toLowerCase();

    return Object.values(this.players).some(
      (player) =>
        player.displayName.trim().toLowerCase() === normalizedDisplayName,
    );
  }

  private getMapRoom(mapId: MapId): string {
    return `map:${mapId}`;
  }

  private getPlayersInMap(mapId: MapId): Record<string, Player> {
    const playersInMap: Record<string, Player> = {};

    for (const [playerId, player] of Object.entries(this.players)) {
      if (player.mapId !== mapId) {
        continue;
      }
      playersInMap[playerId] = player;
    }

    return playersInMap;
  }

  private emitPlayersStateByMap(): void {
    const activeMapIds = new Set<MapId>();

    for (const player of Object.values(this.players)) {
      activeMapIds.add(player.mapId);
    }

    for (const mapId of activeMapIds) {
      const room = this.getMapRoom(mapId);
      const players = this.getPlayersInMap(mapId);
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
    const player = this.players[playerId];

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
        const result = await applyPokemonTrainerBattleHealingItem({
          session,
          entry,
          playerId,
          trainerStateStore: this.pokemonTrainerStateStore,
          trainerService: this.pokemonTrainerService,
        });

        return {
          events: [
            {
              type: 'item-used',
              participantId: result.participantId,
              itemId: result.itemId,
              targetPokemonInstanceId: result.targetPokemonInstanceId,
            },
            {
              type: 'hp-restored',
              participantId: result.participantId,
              pokemonInstanceId: result.targetPokemonInstanceId,
              previousHp: result.previousHp,
              currentHp: result.currentHp,
              appliedHealing: result.appliedHealing,
            },
          ],
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

    /*
     * Example:
     * actor fainted earlier in the same Turn.
     *
     * No PP consumed.
     * No move actually used.
     * Therefore no presentation event.
     */
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
}
