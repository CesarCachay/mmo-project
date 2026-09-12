import type {
  BattlePokemonState,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionResolvedPayload,
  PokemonTrainerState,
} from "@cesar-mmo/shared";

export interface PokemonBattleEvolutionHudSyncCoordinatorOptions {
  readonly presentRequiredEvolution: (
    payload: PokemonEvolutionRequiredPayload,
  ) => Promise<PokemonEvolutionResolvedPayload>;

  readonly getTrainerState: () =>
    Pick<PokemonTrainerState, "party"> | undefined;

  readonly syncTrainerPokemonAfterEvolution: (
    evolvedPokemon: BattlePokemonState,
    trainerParty: readonly BattlePokemonState[],
  ) => void;

  readonly finishEvolutionCinematic: () => void;
}

export class PokemonBattleEvolutionHudSyncCoordinator {
  private readonly options: PokemonBattleEvolutionHudSyncCoordinatorOptions;

  constructor(options: PokemonBattleEvolutionHudSyncCoordinatorOptions) {
    this.options = options;
  }

  public async presentRequiredEvolution(
    payload: PokemonEvolutionRequiredPayload,
  ): Promise<PokemonEvolutionResolvedPayload> {
    try {
      const response = await this.options.presentRequiredEvolution(payload);

      if (response.decision.type === "accept" && response.evolution !== null) {
        this.syncAuthoritativeState(payload.pokemonInstanceId);
      }

      return response;
    } finally {
      /*
       * This MUST happen after the
       * authoritative HUD synchronization.
       *
       * Until here, BattleOverlay keeps
       * normal HUDs hidden.
       */
      this.options.finishEvolutionCinematic();
    }
  }

  private syncAuthoritativeState(pokemonInstanceId: string): void {
    const trainerState = this.options.getTrainerState();

    if (!trainerState) {
      console.warn(
        "[EvolutionHudSync] TrainerState unavailable after Evolution",
        {
          pokemonInstanceId,
        },
      );

      return;
    }

    /*
     * TrainerState is the only authority.
     *
     * EVOLUTION_RESOLVED species/form values
     * are deliberately NOT used here.
     */
    const trainerParty: BattlePokemonState[] = trainerState.party.pokemon.map(
      (pokemon) => ({
        pokemon,
        currentHp: pokemon.currentHp,
      }),
    );

    const evolvedPokemon = trainerParty.find(
      (state) => state.pokemon.instanceId === pokemonInstanceId,
    );

    if (!evolvedPokemon) {
      console.warn(
        "[EvolutionHudSync] evolved Pokémon missing from authoritative TrainerState",
        {
          pokemonInstanceId,
        },
      );

      return;
    }

    this.options.syncTrainerPokemonAfterEvolution(evolvedPokemon, trainerParty);
  }
}
