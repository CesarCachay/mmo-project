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

// services
import { PokemonTrainerService } from 'src/pokemon/pokemon-trainer.service';
import { PokemonTrainerStateStore } from 'src/pokemon/pokemon-trainer-state.store';
import { DialogueSessionService } from 'src/dialogue/dialogue-session.service';
import { DialogueSessionStore } from 'src/dialogue/dialogue-session.store';
import { PokemonTrainerIdentityStore } from 'src/pokemon/pokemon-trainer-identity.store';
import { isPokemonTrainerSessionToken } from 'src/pokemon/pokemon-trainer-identity';
import { PokemonWildEncounterTriggerService } from 'src/pokemon/encounters/pokemon-wild-encounter-trigger.service';
import { PokemonWildEncounterSessionStore } from 'src/pokemon/encounters/pokemon-wild-encounter-session.store';
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

  private nextColorIndex = 0;
  private gameLoop?: ReturnType<typeof setInterval>;

  constructor(
    private readonly chatService: ChatService,
    private readonly pokemonTrainerRepository: PokemonTrainerRepository,
    private readonly pokemonPartyRepository: PokemonPartyRepository,
  ) {
    this.pokemonTrainerService = new PokemonTrainerService(
      this.pokemonTrainerStateStore,
      this.pokemonPartyRepository,
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
        const persistedParty = await this.pokemonPartyRepository.loadParty(
          trainerIdentity.trainerId,
        );

        trainerState = this.pokemonTrainerStateStore.create(
          trainerIdentity.trainerId,
          persistedParty,
        );
      }
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
}
