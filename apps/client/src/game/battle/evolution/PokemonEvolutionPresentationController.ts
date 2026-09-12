import type {
  PokemonEvolutionDecision,
  PokemonEvolutionDecisionInput,
  PokemonEvolutionErrorPayload,
  PokemonEvolutionResolvedPayload,
} from "@cesar-mmo/shared";

import type { PokemonEvolutionAnimationInput } from "./PokemonEvolutionAnimator";

export interface PokemonEvolutionDecisionRequest {
  readonly pokemonInstanceId: string;

  readonly sourceSpeciesId: number;
  readonly sourceFormId: number;

  readonly targetSpeciesId: number;
  readonly targetFormId: number;
}

export interface PokemonEvolutionPresentationControllerOptions {
  readonly sendDecision: (input: PokemonEvolutionDecisionInput) => void;
  readonly requestDecision: (
    input: PokemonEvolutionDecisionRequest,
  ) => Promise<PokemonEvolutionDecision>;
  readonly hideDecision: () => void;
  readonly onIdle?: () => void;
  readonly animateEvolution: (
    input: PokemonEvolutionAnimationInput,
  ) => Promise<void>;
}

interface PendingEvolutionResponse {
  readonly pokemonInstanceId: string;
  readonly revision: number;
  readonly resolve: (payload: PokemonEvolutionResolvedPayload) => void;
  readonly reject: (error: Error) => void;
}

export interface PokemonEvolutionPresentationRequest extends PokemonEvolutionDecisionRequest {
  readonly revision: number;
}

export class PokemonEvolutionPresentationController {
  private readonly sendDecision: PokemonEvolutionPresentationControllerOptions["sendDecision"];
  private readonly requestDecision: PokemonEvolutionPresentationControllerOptions["requestDecision"];
  private pendingResponse?: PendingEvolutionResponse;

  private readonly hideDecision: PokemonEvolutionPresentationControllerOptions["hideDecision"];
  private readonly onIdle: PokemonEvolutionPresentationControllerOptions["onIdle"];
  private isPresenting = false;
  private readonly animateEvolution: PokemonEvolutionPresentationControllerOptions["animateEvolution"];

  constructor(options: PokemonEvolutionPresentationControllerOptions) {
    this.sendDecision = options.sendDecision;
    this.requestDecision = options.requestDecision;
    this.hideDecision = options.hideDecision;
    this.onIdle = options.onIdle;
    this.animateEvolution = options.animateEvolution;
  }

  public async presentRequiredEvolution(
    event: PokemonEvolutionPresentationRequest,
  ): Promise<PokemonEvolutionResolvedPayload> {
    if (this.isPresenting) {
      throw new Error("Another Evolution presentation is already active");
    }

    this.isPresenting = true;

    try {
      const decision = await this.requestDecision({
        pokemonInstanceId: event.pokemonInstanceId,

        sourceSpeciesId: event.sourceSpeciesId,

        sourceFormId: event.sourceFormId,

        targetSpeciesId: event.targetSpeciesId,

        targetFormId: event.targetFormId,
      });

      const responsePromise = this.waitForResponse(
        event.pokemonInstanceId,
        event.revision,
      );

      try {
        this.sendDecision({
          pokemonInstanceId: event.pokemonInstanceId,

          revision: event.revision,

          decision,
        });
      } catch (error) {
        this.pendingResponse = undefined;

        throw error;
      }

      /*
       * Server-authoritative boundary.
       *
       * Nothing visual that implies a successful
       * evolution happens before this Promise */
      const response = await responsePromise;

      /* Remove EVOLVE / CANCEL before either continuing Battle or starting cinematic */
      this.hideDecision();

      if (response.decision.type === "accept" && response.evolution !== null) {
        try {
          await this.animateEvolution({
            sourceSpeciesId: response.evolution.previousSpeciesId,
            sourceFormId: response.evolution.previousFormId,
            targetSpeciesId: response.evolution.currentSpeciesId,
            targetFormId: response.evolution.currentFormId,
          });
        } catch (error) {
          console.error("[Evolution] animation failed", error);
        }
      }

      return response;
    } finally {
      this.hideDecision();
      this.isPresenting = false;
      this.onIdle?.();
    }
  }

  public applyResolved(payload: PokemonEvolutionResolvedPayload): void {
    const pending = this.pendingResponse;

    if (!pending) {
      return;
    }

    if (
      pending.pokemonInstanceId !== payload.pokemonInstanceId ||
      pending.revision !== payload.resolvedRevision
    ) {
      return;
    }

    this.pendingResponse = undefined;

    pending.resolve(payload);
  }

  public applyError(payload: PokemonEvolutionErrorPayload): void {
    const pending = this.pendingResponse;

    if (!pending) {
      return;
    }

    if (
      payload.pokemonInstanceId !== null &&
      payload.pokemonInstanceId !== pending.pokemonInstanceId
    ) {
      return;
    }

    if (payload.revision !== null && payload.revision !== pending.revision) {
      return;
    }

    this.pendingResponse = undefined;

    pending.reject(new Error(payload.message));
  }

  public destroy(): void {
    const pending = this.pendingResponse;

    this.pendingResponse = undefined;

    this.isPresenting = false;

    this.hideDecision();

    if (pending) {
      pending.reject(new Error("Evolution presentation was destroyed"));
    }
  }

  public get isBusy(): boolean {
    return this.isPresenting;
  }

  private waitForResponse(
    pokemonInstanceId: string,
    revision: number,
  ): Promise<PokemonEvolutionResolvedPayload> {
    if (this.pendingResponse) {
      throw new Error("Another Evolution network request is already pending");
    }

    return new Promise((resolve, reject) => {
      this.pendingResponse = {
        pokemonInstanceId,
        revision,
        resolve,
        reject,
      };
    });
  }
}
