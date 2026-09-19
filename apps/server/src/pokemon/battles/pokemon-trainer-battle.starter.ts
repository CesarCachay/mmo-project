import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  getBattleParticipantById,
  getOpposingBattleParticipant,
  isPokemonPartyWiped,
} from '@cesar-mmo/shared';

import type {
  PokemonBattleStartedPayload,
  PokemonTrainerBattleId,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';
import { PokemonWildEncounterSessionStore } from '../encounters/pokemon-wild-encounter-session.store';
import { PokemonStorageAccessSessionStore } from '../storage/pokemon-storage-access-session.store';

import { PokemonBattleSessionStore } from './pokemon-battle-session.store';
import { PokemonBattleTurnStore } from './pokemon-battle-turn.store';
import { createTrainerBattleInstance } from './pokemon-trainer-battle.factory';

export interface StartPokemonTrainerBattleInput {
  readonly playerId: string;
  readonly trainerId: PokemonTrainerId;
  readonly npcId: string;
  readonly trainerBattleId: PokemonTrainerBattleId;
}

export interface PokemonTrainerBattleStarterOptions {
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly battleTurnStore: PokemonBattleTurnStore;
  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  readonly resolvePlayerSocket: (playerId: string) => Socket | undefined;
}

export class PokemonTrainerBattleStarter {
  private readonly trainerStateStore: PokemonTrainerStateStore;
  private readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly battleTurnStore: PokemonBattleTurnStore;
  private readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  private readonly resolvePlayerSocket: PokemonTrainerBattleStarterOptions['resolvePlayerSocket'];

  constructor(options: PokemonTrainerBattleStarterOptions) {
    this.trainerStateStore = options.trainerStateStore;
    this.wildEncounterSessionStore = options.wildEncounterSessionStore;
    this.battleSessionStore = options.battleSessionStore;
    this.battleTurnStore = options.battleTurnStore;
    this.storageAccessSessionStore = options.storageAccessSessionStore;
    this.resolvePlayerSocket = options.resolvePlayerSocket;
  }

  public start(input: StartPokemonTrainerBattleInput): void {
    if (
      this.battleSessionStore.hasTrainerBattle(input.trainerId) ||
      this.battleSessionStore.hasPlayerBattle(input.playerId)
    ) {
      return;
    }

    if (this.wildEncounterSessionStore.has(input.playerId)) {
      console.warn(
        '[TrainerBattle] start rejected because a Wild Encounter is active',
        {
          playerId: input.playerId,
          trainerId: input.trainerId,
          trainerBattleId: input.trainerBattleId,
        },
      );
      return;
    }

    if (this.storageAccessSessionStore.has(input.playerId)) {
      console.warn(
        '[TrainerBattle] start rejected because Storage is active',
        {
          playerId: input.playerId,
          trainerId: input.trainerId,
          trainerBattleId: input.trainerBattleId,
        },
      );
      return;
    }

    const trainerState = this.trainerStateStore.get(input.trainerId);

    if (!trainerState) {
      throw new Error(
        `Trainer state not found for trainer "${input.trainerId}"`,
      );
    }

    if (
      (trainerState.defeatedTrainerBattleIds ?? []).includes(
        input.trainerBattleId,
      )
    ) {
      console.warn('[TrainerBattle] start rejected because NPC Trainer is already defeated', {
        playerId: input.playerId,
        trainerId: input.trainerId,
        trainerBattleId: input.trainerBattleId,
      });
      return;
    }

    if (trainerState.party.pokemon.length === 0) {
      console.warn('[TrainerBattle] start rejected because Trainer has no Pokémon', {
        playerId: input.playerId,
        trainerId: input.trainerId,
        trainerBattleId: input.trainerBattleId,
      });
      return;
    }

    if (isPokemonPartyWiped(trainerState.party)) {
      console.warn('[TrainerBattle] start rejected because Trainer Party is wiped', {
        playerId: input.playerId,
        trainerId: input.trainerId,
        trainerBattleId: input.trainerBattleId,
      });
      return;
    }

    const battle = createTrainerBattleInstance({
      trainerBattleId: input.trainerBattleId,
      trainerPokemon: trainerState.party.pokemon,
    });

    const playerParticipant = battle.participants.find(
      (participant) => participant.side === 'side-a',
    );

    if (!playerParticipant) {
      throw new Error(
        `Player participant not found in Trainer Battle "${battle.battleId}"`,
      );
    }

    const opponentParticipant = getOpposingBattleParticipant(
      battle,
      playerParticipant.id,
    );

    getBattleParticipantById(battle, opponentParticipant.id);

    const battleSession = this.battleSessionStore.create({
      battle,
      trainerBindings: [
        {
          participantId: playerParticipant.id,
          trainerId: input.trainerId,
          playerId: input.playerId,
        },
      ],
      trainerBattle: {
        npcId: input.npcId,
        trainerBattleId: input.trainerBattleId,
        opponentParticipantId: opponentParticipant.id,
      },
    });

    try {
      this.battleTurnStore.create(battleSession.battle);
    } catch (error: unknown) {
      this.battleSessionStore.remove(battleSession.battle.battleId);
      throw error;
    }

    const ownerSocket = this.resolvePlayerSocket(input.playerId);

    if (!ownerSocket) {
      this.battleTurnStore.remove(battleSession.battle.battleId);
      this.battleSessionStore.remove(battleSession.battle.battleId);
      return;
    }

    ownerSocket.emit(POKEMON_EVENTS.BATTLE_STARTED, {
      battle: battleSession.battle,
      localParticipantId: playerParticipant.id,
    } satisfies PokemonBattleStartedPayload);
  }
}
