import type Phaser from "phaser";

import type { NpcInstance } from "../npc/types";

const PRE_BATTLE_DIALOGUE_START_TIMEOUT_MS = 5_000;

type TrainerPreBattlePhase = "awaiting-dialogue" | "dialogue";

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
  private dialogueStartTimeout?: Phaser.Time.TimerEvent;

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

    this.dialogueStartTimeout = this.scene.time.delayedCall(
      PRE_BATTLE_DIALOGUE_START_TIMEOUT_MS,
      () => {
        if (this.phase !== "awaiting-dialogue") {
          return;
        }

        this.cancel("dialogue-start-timeout");
      },
    );

    const dialogueRequested = this.options.requestDialogue(npc);

    if (!dialogueRequested) {
      this.cancel("dialogue-request-rejected-locally");
      return false;
    }

    return true;
  }

  public isActiveFor(npcId: string): boolean {
    return this.activeNpc?.definition.id === npcId;
  }

  public markDialogueStarted(npcId: string): void {
    if (!this.isActiveFor(npcId)) {
      return;
    }

    this.dialogueStartTimeout?.remove(false);
    this.dialogueStartTimeout = undefined;
    this.phase = "dialogue";
  }

  public complete(npcId: string): void {
    if (!this.isActiveFor(npcId)) {
      return;
    }

    const npc = this.activeNpc;

    this.reset();

    if (npc) {
      this.options.onReady(npc);
    }
  }

  public clear(): void {
    this.reset();
  }

  public destroy(): void {
    this.reset();
  }

  private cancel(reason: string): void {
    const npc = this.activeNpc;

    this.reset();

    if (npc) {
      this.options.onCancelled(npc, reason);
    }
  }

  private reset(): void {
    this.dialogueStartTimeout?.remove(false);
    this.dialogueStartTimeout = undefined;
    this.activeNpc = undefined;
    this.phase = undefined;
  }
}
