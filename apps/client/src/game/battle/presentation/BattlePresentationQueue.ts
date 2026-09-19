import type {
  BattlePresentationEvent,
  PokemonBattleTurnResolvedPayload,
} from "@cesar-mmo/shared";

type BattleExperienceGainedPresentationEvent = Extract<
  BattlePresentationEvent,
  { readonly type: "experience-gained" }
>;

function isAuthoritativeDecisionEvent(event: BattlePresentationEvent): boolean {
  return (
    event.type === "move-learning-required" ||
    event.type === "evolution-required"
  );
}

export interface BattlePresentationEventContext {
  readonly battleId: string;
  readonly turnNumber: number;

  readonly eventIndex: number;
  readonly eventCount: number;
  readonly previousEvent?: BattlePresentationEvent;
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
  private blocked = false;
  private generation = 0;

  constructor(options: BattlePresentationQueueOptions) {
    this.options = options;
  }

  public get isBusy(): boolean {
    return this.blocked || this.processing || this.pendingTurns.length > 0;
  }

  public get isBlocked(): boolean {
    return this.blocked;
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

    /* Battle lifecycle reset explicitly releases a previously blocked presentation queue */
    this.blocked = false;

    this.generation += 1;
  }

  private async drain(): Promise<void> {
    if (this.processing || this.blocked) {
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
    } catch {
      if (generation === this.generation) {
        this.blocked = true;
      }
    } finally {
      this.processing = false;
    }

    /*
     * Critical workflow failure:
     *
     * absolutely no:
     * - later events,
     * - onTurnCompleted,
     * - onIdle.
     */
    if (this.blocked) {
      return;
    }

    /* A newer generation may have been enqueued while the previous one was finishing */
    if (this.pendingTurns.length > 0) {
      void this.drain();

      return;
    }

    /* Never report idle for stale Battle work */
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
       * Consecutive EXP events from the same authoritative Turn may be presented simultaneously.
       * EXP presentation itself is visual-only.
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
            /* EXP animation/presentation failure is cosmetic. Server state already exists */
            console.error(
              "[BattlePresentationQueue] EXP batch presentation failed",
              {
                ...batchContext,
                events: experienceEvents,
                error,
              },
            );
          }

          /* Skip every EXP event consumed by the batch */
          eventIndex = batchEndIndex;
          continue;
        }
      }

      /*
       * ------------------------------------------------------
       * NORMAL SEQUENTIAL EVENT
       * ------------------------------------------------------
       */
      const previousEvent =
        eventIndex > 0 ? payload.events[eventIndex - 1] : undefined;

      const context: BattlePresentationEventContext = {
        battleId: payload.battleId,
        turnNumber: payload.turnNumber,
        eventIndex,
        eventCount,
        ...(previousEvent ? { previousEvent } : {}),
      };

      try {
        await this.options.presentEvent(event, context);
      } catch (error) {
        if (isAuthoritativeDecisionEvent(event)) {
          /*
           * Move Learning / Evolution are not
           * cosmetic presentations.
           *
           * If their server-authoritative
           * acknowledgement failed, later events
           * and Victory must not continue.
           */
          console.error(
            "[BattlePresentationQueue] authoritative decision presentation failed",
            {
              ...context,
              event,
              error,
            },
          );

          throw error;
        }

        /* Ordinary visual failures remain non-fatal */
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
