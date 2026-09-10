import type {
  BattlePresentationEvent,
  PokemonBattleTurnResolvedPayload,
} from "@cesar-mmo/shared";

type BattleExperienceGainedPresentationEvent = Extract<
  BattlePresentationEvent,
  { readonly type: "experience-gained" }
>;

export interface BattlePresentationEventContext {
  readonly battleId: string;
  readonly turnNumber: number;

  readonly eventIndex: number;
  readonly eventCount: number;
}

export interface BattlePresentationEventBatchContext {
  readonly battleId: string;
  readonly turnNumber: number;

  readonly startEventIndex: number;
  readonly endEventIndex: number;
  readonly eventCount: number;
}

export interface BattlePresentationQueueOptions {
  readonly presentEvent: (
    event: BattlePresentationEvent,
    context: BattlePresentationEventContext,
  ) => void | Promise<void>;

  readonly presentExperienceBatch?: (
    events: readonly BattleExperienceGainedPresentationEvent[],
    context: BattlePresentationEventBatchContext,
  ) => void | Promise<void>;

  readonly onTurnCompleted?: (
    payload: PokemonBattleTurnResolvedPayload,
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
    this.pendingTurns.push({
      battleId: payload.battleId,
      turnNumber: payload.turnNumber,
      events: [...payload.events],
    });

    void this.drain();
  }

  public clear(): void {
    this.pendingTurns.length = 0;
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
            console.error(
              "[BattlePresentationQueue] turn completion callback failed",
              {
                battleId: payload.battleId,
                turnNumber: payload.turnNumber,
                error,
              },
            );
          }
        }
      }
    } finally {
      this.processing = false;
    }

    /* A new generation could have been enqueued while the previous one was being cancelled */
    if (this.pendingTurns.length > 0) {
      void this.drain();
      return;
    }

    /* Never report idle for a stale generation */
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
    generation: number,
  ): Promise<void> {
    const eventCount = payload.events.length;

    let eventIndex = 0;

    while (eventIndex < eventCount) {
      if (generation !== this.generation) {
        return;
      }

      const event = payload.events[eventIndex];

      if (!event) {
        eventIndex += 1;
        continue;
      }

      /*
       * ------------------------------------------------------
       * EXP BATCH
       * ------------------------------------------------------
       *
       * Consecutive experience-gained events belong to the
       * same authoritative Turn and may be PRESENTED
       * concurrently.
       *
       * Gameplay is NOT being resolved here.
       */
      if (
        event.type === "experience-gained" &&
        this.options.presentExperienceBatch
      ) {
        const experienceEvents: BattleExperienceGainedPresentationEvent[] = [];

        let batchEndIndex = eventIndex;

        while (batchEndIndex < eventCount) {
          const candidate = payload.events[batchEndIndex];

          if (!candidate || candidate.type !== "experience-gained") {
            break;
          }

          experienceEvents.push(candidate);
          batchEndIndex += 1;
        }

        if (experienceEvents.length > 1) {
          const batchContext: BattlePresentationEventBatchContext = {
            battleId: payload.battleId,
            turnNumber: payload.turnNumber,
            startEventIndex: eventIndex,
            endEventIndex: batchEndIndex - 1,
            eventCount,
          };

          try {
            await this.options.presentExperienceBatch(
              experienceEvents,
              batchContext,
            );
          } catch (error) {
            /* Presentation failures must never deadlock authoritative Battle state */
            console.error(
              "[BattlePresentationQueue] EXP batch presentation failed",
              {
                ...batchContext,

                events: experienceEvents,

                error,
              },
            );
          }

          /* Skip every EXP event already consumed by the batch */
          eventIndex = batchEndIndex;

          continue;
        }
      }

      /*
       * ------------------------------------------------------
       * NORMAL SEQUENTIAL EVENT
       * ------------------------------------------------------
       */

      const context: BattlePresentationEventContext = {
        battleId: payload.battleId,
        turnNumber: payload.turnNumber,
        eventIndex,
        eventCount,
      };

      try {
        await this.options.presentEvent(event, context);
      } catch (error) {
        console.error("[BattlePresentationQueue] event presentation failed", {
          ...context,
          event,
          error,
        });
      }

      eventIndex += 1;
    }
  }
}
