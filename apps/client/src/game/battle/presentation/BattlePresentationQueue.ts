import type {
  BattlePresentationEvent,
  PokemonBattleTurnResolvedPayload,
} from "@cesar-mmo/shared";

export interface BattlePresentationEventContext {
  readonly battleId: string;
  readonly turnNumber: number;

  readonly eventIndex: number;
  readonly eventCount: number;
}

export interface BattlePresentationQueueOptions {
  readonly presentEvent: (
    event: BattlePresentationEvent,
    context: BattlePresentationEventContext
  ) => void | Promise<void>;

  readonly onTurnCompleted?: (
    payload: PokemonBattleTurnResolvedPayload
  ) => void | Promise<void>;

  readonly onIdle?: () => void | Promise<void>;
}

export class BattlePresentationQueue {
  private readonly pendingTurns: PokemonBattleTurnResolvedPayload[] = [];

  private readonly options: BattlePresentationQueueOptions;

  private processing = false;

  private generation = 0;

  constructor(options: BattlePresentationQueueOptions) {
    this.options = options;
  }

  public get isBusy(): boolean {
    return this.processing || this.pendingTurns.length > 0;
  }

  public enqueue(payload: PokemonBattleTurnResolvedPayload): void {
    /*
     * Copy the events array.
     *
     * Shared contracts are readonly, but this also
     * prevents accidental external array mutation.
     */
    this.pendingTurns.push({
      battleId: payload.battleId,
      turnNumber: payload.turnNumber,
      events: [...payload.events],
    });

    void this.drain();
  }

  public clear(): void {
    this.pendingTurns.length = 0;

    /*
     * An event that is already awaiting cannot be
     * forcibly cancelled yet, but once it finishes
     * this generation check prevents the remaining
     * stale events from being presented.
     */
    this.generation += 1;
  }

  private async drain(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    const generation = this.generation;

    try {
      while (this.pendingTurns.length > 0) {
        if (generation !== this.generation) {
          break;
        }

        const payload = this.pendingTurns.shift();

        if (!payload) {
          continue;
        }

        await this.presentTurn(payload, generation);

        if (generation !== this.generation) {
          break;
        }

        if (this.options.onTurnCompleted) {
          try {
            await this.options.onTurnCompleted(payload);
          } catch (error) {
            console.error("[BattlePresentationQueue] turn completion callback failed", {
              battleId: payload.battleId,
              turnNumber: payload.turnNumber,
              error,
            });
          }
        }
      }
    } finally {
      this.processing = false;
    }

    /*
     * A new generation could have been enqueued
     * while the previous one was being cancelled.
     */
    if (this.pendingTurns.length > 0) {
      void this.drain();
      return;
    }

    /*
     * Never report idle for a stale generation.
     */
    if (generation !== this.generation) {
      return;
    }

    if (this.options.onIdle) {
      try {
        await this.options.onIdle();
      } catch (error) {
        console.error("[BattlePresentationQueue] idle callback failed", error);
      }
    }
  }

  private async presentTurn(
    payload: PokemonBattleTurnResolvedPayload,
    generation: number
  ): Promise<void> {
    const eventCount = payload.events.length;

    for (let eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
      if (generation !== this.generation) {
        return;
      }

      const event = payload.events[eventIndex];

      if (!event) {
        continue;
      }

      const context: BattlePresentationEventContext = {
        battleId: payload.battleId,
        turnNumber: payload.turnNumber,
        eventIndex,
        eventCount,
      };

      try {
        await this.options.presentEvent(event, context);
      } catch (error) {
        /*
         * Presentation failures must not deadlock the Battle.
         * Gameplay has already been resolved authoritatively by the server.
         */
        console.error("[BattlePresentationQueue] event presentation failed", {
          ...context,
          event,
          error,
        });
      }
    }
  }
}
