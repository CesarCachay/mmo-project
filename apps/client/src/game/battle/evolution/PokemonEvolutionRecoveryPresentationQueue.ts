import type { PokemonEvolutionRequiredPayload } from "@cesar-mmo/shared";

export interface PokemonEvolutionRecoveryPresentationQueueOptions {
  readonly presentRequiredEvolution: (
    payload: PokemonEvolutionRequiredPayload,
  ) => Promise<void>;

  readonly onError?: (
    error: unknown,
    payload: PokemonEvolutionRequiredPayload,
  ) => void;
}

export class PokemonEvolutionRecoveryPresentationQueue {
  private readonly presentRequiredEvolution: PokemonEvolutionRecoveryPresentationQueueOptions["presentRequiredEvolution"];
  private readonly onError: PokemonEvolutionRecoveryPresentationQueueOptions["onError"];
  private readonly queue: PokemonEvolutionRequiredPayload[] = [];
  private readonly knownKeys = new Set<string>();

  private isProcessing = false;
  private isBlocked = false;

  constructor(options: PokemonEvolutionRecoveryPresentationQueueOptions) {
    this.presentRequiredEvolution = options.presentRequiredEvolution;
    this.onError = options.onError;
  }

  public enqueue(payload: PokemonEvolutionRequiredPayload): void {
    const key = this.getKey(payload);

    /* Reconnect/network duplication must not show the exact same pending prompt twice */
    if (this.knownKeys.has(key)) {
      return;
    }

    this.knownKeys.add(key);
    this.queue.push(payload);

    void this.processNext();
  }

  public clear(): void {
    this.queue.length = 0;
    this.knownKeys.clear();

    /* Do not attempt to cancel a presentation already awaiting a server response */
    this.isBlocked = false;
  }

  public get isBusy(): boolean {
    return this.isProcessing || this.queue.length > 0;
  }

  public get pendingCount(): number {
    return this.queue.length;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.isBlocked) {
      return;
    }

    const next = this.queue[0];

    if (!next) {
      return;
    }

    this.isProcessing = true;

    try {
      /* Do not remove the item until its complete presentation + server acknowledgement succeeds */
      await this.presentRequiredEvolution(next);

      this.queue.shift();

      this.knownKeys.delete(this.getKey(next));
    } catch (error) {
      this.isBlocked = true;

      this.onError?.(error, next);
    } finally {
      this.isProcessing = false;
    }

    if (!this.isBlocked) {
      await this.processNext();
    }
  }

  private getKey(payload: PokemonEvolutionRequiredPayload): string {
    return [payload.pokemonInstanceId, payload.revision].join(":");
  }
}
