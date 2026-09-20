import type Phaser from "phaser";

import type { NpcInstance } from "../npc/types";

const PRE_BATTLE_DIALOGUE_START_TIMEOUT_MS = 5_000;
const PRE_BATTLE_DIALOGUE_RETRY_INTERVAL_MS = 450;
const PRE_BATTLE_BATTLE_START_TIMEOUT_MS = 5_000;

type TrainerPreBattlePhase =
  | "awaiting-dialogue"
  | "dialogue"
  | "awaiting-battle";

type TrainerPreBattleControllerOptions = Readonly<{
  requestDialogue: (npc: NpcInstance) => boolean;
  onReady: (npc: NpcInstance) => void;
  onCancelled: (npc: NpcInstance, reason: string) => void;
}>;

export class TrainerPreBattleController {
  private readonly scene: Phaser.Scene;
  private readonly options: TrainerPreBattleControllerOptions;

  private activeNpc?: NpcInstance;
  private phase?: TrainerPreBattlePhase;
  private timeout?: Phaser.Time.TimerEvent;
  private dialogueRetryTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    options: TrainerPreBattleControllerOptions,
  ) {
    this.scene = scene;
    this.options = options;
  }

  public get isBlockingGameplay(): boolean {
    return this.activeNpc !== undefined;
  }

  public get currentNpc(): NpcInstance | undefined {
    return this.activeNpc;
  }

  public begin(npc: NpcInstance): boolean {
    if (this.activeNpc) {
      return false;
    }

    this.activeNpc = npc;
    this.phase = "awaiting-dialogue";
    this.scheduleTimeout(
      PRE_BATTLE_DIALOGUE_START_TIMEOUT_MS,
      "dialogue-start-timeout",
      "awaiting-dialogue",
    );

    const dialogueRequested = this.options.requestDialogue(npc);

    if (!dialogueRequested) {
      this.cancel("dialogue-request-rejected-locally");
      return false;
    }

    /*
     * Trainer aggro is detected from the latest authoritative player snapshot,
     * but the server may have advanced one or two movement ticks by the time
     * dialogue:start arrives. A rejected START has no response packet, so a
     * single request could otherwise leave the client waiting until timeout.
     *
     * Retry while we are still awaiting the first dialogue state. The server
     * handles duplicate START requests idempotently for the same NPC/session.
     */
    this.scheduleDialogueRetry();

    return true;
  }

  public isActiveFor(npcId: string): boolean {
    return this.activeNpc?.definition.id === npcId;
  }

  public markDialogueStarted(npcId: string): void {
    if (!this.isActiveFor(npcId)) {
      return;
    }

    this.clearTimeout();
    this.clearDialogueRetry();
    this.phase = "dialogue";
  }

  public complete(npcId: string): void {
    if (!this.isActiveFor(npcId) || this.phase !== "dialogue") {
      return;
    }

    const npc = this.activeNpc;
    if (!npc) {
      return;
    }

    this.phase = "awaiting-battle";
    this.scheduleTimeout(
      PRE_BATTLE_BATTLE_START_TIMEOUT_MS,
      "battle-start-timeout",
      "awaiting-battle",
    );

    this.options.onReady(npc);
  }

  public markBattleStarted(): NpcInstance | undefined {
    if (this.phase !== "awaiting-battle") {
      return undefined;
    }

    const npc = this.activeNpc;
    this.reset();
    return npc;
  }

  public clear(): void {
    this.reset();
  }

  public destroy(): void {
    this.reset();
  }

  private scheduleDialogueRetry(): void {
    this.clearDialogueRetry();

    this.dialogueRetryTimer = this.scene.time.delayedCall(
      PRE_BATTLE_DIALOGUE_RETRY_INTERVAL_MS,
      () => {
        this.dialogueRetryTimer = undefined;

        if (this.phase !== "awaiting-dialogue") {
          return;
        }

        const npc = this.activeNpc;
        if (!npc) {
          return;
        }

        this.options.requestDialogue(npc);
        this.scheduleDialogueRetry();
      },
    );
  }

  private scheduleTimeout(
    durationMs: number,
    reason: string,
    expectedPhase: TrainerPreBattlePhase,
  ): void {
    this.clearTimeout();

    this.timeout = this.scene.time.delayedCall(durationMs, () => {
      if (this.phase !== expectedPhase) {
        return;
      }

      this.cancel(reason);
    });
  }

  private cancel(reason: string): void {
    const npc = this.activeNpc;

    this.reset();

    if (npc) {
      this.options.onCancelled(npc, reason);
    }
  }

  private clearTimeout(): void {
    this.timeout?.remove(false);
    this.timeout = undefined;
  }

  private clearDialogueRetry(): void {
    this.dialogueRetryTimer?.remove(false);
    this.dialogueRetryTimer = undefined;
  }

  private reset(): void {
    this.clearTimeout();
    this.clearDialogueRetry();
    this.activeNpc = undefined;
    this.phase = undefined;
  }
}
