import type { Socket } from 'socket.io';

import { POKEMON_EVENTS, isPokemonPartyWiped } from '@cesar-mmo/shared';

import type { PokemonBattleStartedPayload } from '@cesar-mmo/shared';

import type { PokemonWildEncounterSession } from '../encounters/pokemon-wild-encounter-session';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import { PokemonWildEncounterSessionStore } from '../encounters/pokemon-wild-encounter-session.store';

import { PokemonStorageAccessSessionStore } from '../storage/pokemon-storage-access-session.store';
import { PokemonShopAccessSessionStore } from '../economy/shop/pokemon-shop-access-session.store';

import { PokemonBattleSessionStore } from './pokemon-battle-session.store';

import { PokemonBattleTurnStore } from './pokemon-battle-turn.store';

import { createWildBattleInstance } from './pokemon-wild-battle.factory';

export interface PokemonWildBattleStarterOptions {
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly battleTurnStore: PokemonBattleTurnStore;
  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  readonly resolvePlayerSocket: (playerId: string) => Socket | undefined;
}

export class PokemonWildBattleStarter {
  private readonly trainerStateStore: PokemonTrainerStateStore;
  private readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly battleTurnStore: PokemonBattleTurnStore;
  private readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  private readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  private readonly resolvePlayerSocket: PokemonWildBattleStarterOptions['resolvePlayerSocket'];

  constructor(options: PokemonWildBattleStarterOptions) {
    this.trainerStateStore = options.trainerStateStore;
    this.wildEncounterSessionStore = options.wildEncounterSessionStore;
    this.battleSessionStore = options.battleSessionStore;
    this.battleTurnStore = options.battleTurnStore;
    this.storageAccessSessionStore = options.storageAccessSessionStore;
    this.shopAccessSessionStore = options.shopAccessSessionStore;
    this.resolvePlayerSocket = options.resolvePlayerSocket;
  }

  public start(encounterSession: PokemonWildEncounterSession): void {
    /* No crear dos Battles activos para el mismo Trainer */
    if (this.battleSessionStore.hasTrainerBattle(encounterSession.trainerId)) {
      return;
    }

    if (this.shopAccessSessionStore.has(encounterSession.playerId)) {
      this.wildEncounterSessionStore.remove(encounterSession.playerId);
      console.warn('[WildBattle] start rejected because Poké Shop is active', {
        playerId: encounterSession.playerId,
        trainerId: encounterSession.trainerId,
      });
      return;
    }

    const trainerState = this.trainerStateStore.get(encounterSession.trainerId);

    if (!trainerState) {
      throw new Error(
        `Trainer state not found for trainer "${encounterSession.trainerId}"`,
      );
    }

    if (trainerState.party.pokemon.length === 0) {
      this.wildEncounterSessionStore.remove(encounterSession.playerId);
      console.warn(
        '[WildBattle] start rejected because Trainer has no Pokémon',
        {
          playerId: encounterSession.playerId,
          trainerId: encounterSession.trainerId,
          encounterId: encounterSession.encounterId,
        },
      );
      return;
    }

    if (isPokemonPartyWiped(trainerState.party)) {
      this.wildEncounterSessionStore.remove(encounterSession.playerId);
      console.warn(
        '[WildBattle] start rejected because Trainer Party is wiped',
        {
          playerId: encounterSession.playerId,
          trainerId: encounterSession.trainerId,
          encounterId: encounterSession.encounterId,
        },
      );
      return;
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

    const battleSession = this.battleSessionStore.create({
      battle,
      trainerBindings: [
        {
          participantId: trainerParticipant.id,
          trainerId: encounterSession.trainerId,
          playerId: encounterSession.playerId,
        },
      ],
    });

    /* Session + Turn inicial deben quedar consistentes */
    try {
      this.battleTurnStore.create(battleSession.battle);
    } catch (error: unknown) {
      this.battleSessionStore.remove(battleSession.battle.battleId);
      throw error;
    }

    /* El encounter ya se convirtió en Battle */
    this.wildEncounterSessionStore.remove(encounterSession.playerId);

    /* Battle invalida Storage */
    this.storageAccessSessionStore.remove(encounterSession.playerId);

    const ownerSocket = this.resolvePlayerSocket(encounterSession.playerId);

    if (!ownerSocket) {
      return;
    }

    ownerSocket.emit(POKEMON_EVENTS.BATTLE_STARTED, {
      battle: battleSession.battle,
      localParticipantId: trainerParticipant.id,
      presentation: { kind: 'wild' },
    } satisfies PokemonBattleStartedPayload);
  }
}
