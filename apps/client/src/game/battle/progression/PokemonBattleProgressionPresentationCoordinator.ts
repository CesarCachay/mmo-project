import { getPokemonMove } from "@cesar-mmo/shared";

import type {
  BattleMoveLearningRequiredEvent,
  PokemonEvolutionRequiredPayload,
  PokemonInstanceMove,
  PokemonMoveLearningDecisionInput,
  PokemonMoveLearningResolvedPayload,
  PokemonPendingMoveLearningNetworkState,
} from "@cesar-mmo/shared";

export interface PokemonMoveLearningDecisionPrompt {
  readonly pokemonName: string;
  readonly candidateMoveId: number;
  readonly currentMoves: readonly PokemonInstanceMove[];
}

export interface PokemonBattleProgressionPresentationCoordinatorOptions {
  readonly presentMessage: (
    message: string,
    durationMs?: number,
  ) => Promise<void>;

  readonly requestMoveLearningDecision: (
    input: PokemonMoveLearningDecisionPrompt,
  ) => Promise<PokemonMoveLearningDecisionInput["decision"]>;

  readonly hideMoveLearning: () => void;

  readonly sendMoveLearningDecision: (
    input: PokemonMoveLearningDecisionInput,
  ) => void;

  readonly waitForMoveLearningResponse: (
    pokemonInstanceId: string,
    revision: number,
  ) => Promise<PokemonMoveLearningResolvedPayload>;

  readonly presentRequiredEvolution: (
    payload: PokemonEvolutionRequiredPayload,
  ) => Promise<void>;
}

export interface PresentPokemonMoveLearningWorkflowInput {
  readonly pokemonName: string;
  readonly event: BattleMoveLearningRequiredEvent;
}

export class PokemonBattleProgressionPresentationCoordinator {
  private readonly options: PokemonBattleProgressionPresentationCoordinatorOptions;

  constructor(options: PokemonBattleProgressionPresentationCoordinatorOptions) {
    this.options = options;
  }

  public async presentMoveLearningWorkflow(
    input: PresentPokemonMoveLearningWorkflowInput,
  ): Promise<void> {
    const { pokemonName, event } = input;

    let pending: PokemonPendingMoveLearningNetworkState | null = {
      pokemonInstanceId: event.pokemonInstanceId,
      candidateMoveId: event.candidateMoveId,
      candidateLearnedAtLevel: event.candidateLearnedAtLevel,
      revision: event.revision,
      currentMoves: event.currentMoves,
    };

    let pendingEvolution: PokemonEvolutionRequiredPayload | null = null;

    while (pending) {
      const candidate = getPokemonMove(pending.candidateMoveId);

      const candidateName = candidate
        ? this.formatMoveName(candidate.name)
        : `Move ${pending.candidateMoveId}`;

      await this.options.presentMessage(
        `${pokemonName} wants to learn ${candidateName}!`,
        900,
      );

      const decision = await this.options.requestMoveLearningDecision({
        pokemonName,
        candidateMoveId: pending.candidateMoveId,
        currentMoves: pending.currentMoves,
      });

      const responsePromise = this.options.waitForMoveLearningResponse(
        pending.pokemonInstanceId,
        pending.revision,
      );

      this.options.sendMoveLearningDecision({
        pokemonInstanceId: pending.pokemonInstanceId,
        candidateMoveId: pending.candidateMoveId,
        revision: pending.revision,
        decision,
      });

      const response = await responsePromise;

      pendingEvolution = response.pendingEvolution;

      this.options.hideMoveLearning();

      if (decision.type === "forget") {
        const forgotten = getPokemonMove(decision.moveId);

        const forgottenName = forgotten
          ? this.formatMoveName(forgotten.name)
          : `Move ${decision.moveId}`;

        await this.options.presentMessage(
          `${pokemonName} forgot ${forgottenName} and learned ${candidateName}!`,
          950,
        );
      } else {
        await this.options.presentMessage(
          `${pokemonName} did not learn ${candidateName}.`,
          850,
        );
      }

      pending = response.nextPending;
    }

    this.options.hideMoveLearning();

    /*
     * Critical serialization point:
     *
     * this Promise does NOT resolve until
     * Evolution has completely finished.
     */
    if (pendingEvolution) {
      await this.options.presentRequiredEvolution(pendingEvolution);
    }
  }

  private formatMoveName(name: string): string {
    return name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
