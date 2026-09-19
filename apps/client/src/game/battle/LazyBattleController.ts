import type Phaser from "phaser";

import type {
  PokemonBattleCommandInput,
  PokemonBattleCompletedPayload,
  PokemonBattleReplacementInput,
  PokemonBattleReplacementResolvedPayload,
  PokemonBattleStartedPayload,
  PokemonBattleStateUpdatedPayload,
  PokemonBattleTurnResolvedPayload,
  PokemonEvolutionDecisionInput,
  PokemonEvolutionErrorPayload,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionResolvedPayload,
  PokemonMoveLearningDecisionInput,
  PokemonMoveLearningErrorPayload,
  PokemonMoveLearningResolvedPayload,
  PokemonTrainerState,
} from "@cesar-mmo/shared";

import type { PokemonSpriteLoader } from "../pokemon/PokemonSpriteLoader";
import type { BattleController } from "./BattleController";

type BattleFeatureModule = typeof import("./battle-feature");

let battleFeatureModulePromise: Promise<BattleFeatureModule> | undefined;

async function loadBattleFeatureModule(): Promise<BattleFeatureModule> {
  battleFeatureModulePromise ??= import("./battle-feature");

  try {
    return await battleFeatureModulePromise;
  } catch (error: unknown) {
    battleFeatureModulePromise = undefined;
    throw error;
  }
}

export class LazyBattleController {
  private readonly scene: Phaser.Scene;
  private readonly pokemonSpriteLoader: PokemonSpriteLoader;
  private readonly sendBattleCommand: (input: PokemonBattleCommandInput) => void;
  private readonly sendBattleReplacement: (input: PokemonBattleReplacementInput) => void;
  private readonly sendMoveLearningDecision: (
    input: PokemonMoveLearningDecisionInput
  ) => void;
  private readonly sendEvolutionDecision: (input: PokemonEvolutionDecisionInput) => void;

  private controller?: BattleController;
  private controllerPromise?: Promise<BattleController>;
  private operationChain: Promise<void> = Promise.resolve();

  private latestTrainerState?: PokemonTrainerState;
  private bootstrapBlocking = false;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    pokemonSpriteLoader: PokemonSpriteLoader,
    sendBattleCommand: (input: PokemonBattleCommandInput) => void,
    sendBattleReplacement: (input: PokemonBattleReplacementInput) => void,
    sendMoveLearningDecision: (input: PokemonMoveLearningDecisionInput) => void,
    sendEvolutionDecision: (input: PokemonEvolutionDecisionInput) => void
  ) {
    this.scene = scene;
    this.pokemonSpriteLoader = pokemonSpriteLoader;
    this.sendBattleCommand = sendBattleCommand;
    this.sendBattleReplacement = sendBattleReplacement;
    this.sendMoveLearningDecision = sendMoveLearningDecision;
    this.sendEvolutionDecision = sendEvolutionDecision;
  }

  public get isBlockingGameplay(): boolean {
    return this.bootstrapBlocking || Boolean(this.controller?.isBlockingGameplay);
  }

  public setTrainerState(trainerState: PokemonTrainerState): void {
    this.latestTrainerState = trainerState;
    this.controller?.setTrainerState(trainerState);
  }

  public start(payload: PokemonBattleStartedPayload): Promise<void> {
    return this.enqueueOperation((controller) => controller.start(payload));
  }

  public enqueueTurnPresentation(payload: PokemonBattleTurnResolvedPayload): void {
    void this.enqueueOperation((controller) => {
      controller.enqueueTurnPresentation(payload);
    });
  }

  public applyStateUpdate(payload: PokemonBattleStateUpdatedPayload): Promise<void> {
    return this.enqueueOperation((controller) => controller.applyStateUpdate(payload));
  }

  public applyReplacement(payload: PokemonBattleReplacementResolvedPayload): Promise<void> {
    return this.enqueueOperation((controller) => controller.applyReplacement(payload));
  }

  public applyMoveLearningResolved(payload: PokemonMoveLearningResolvedPayload): void {
    void this.enqueueOperation((controller) => {
      controller.applyMoveLearningResolved(payload);
    });
  }

  public applyMoveLearningError(payload: PokemonMoveLearningErrorPayload): void {
    void this.enqueueOperation((controller) => {
      controller.applyMoveLearningError(payload);
    });
  }

  public applyEvolutionRequired(payload: PokemonEvolutionRequiredPayload): void {
    void this.enqueueOperation((controller) => {
      controller.applyEvolutionRequired(payload);
    });
  }

  public applyEvolutionResolved(payload: PokemonEvolutionResolvedPayload): void {
    void this.enqueueOperation((controller) => {
      controller.applyEvolutionResolved(payload);
    });
  }

  public applyEvolutionError(payload: PokemonEvolutionErrorPayload): void {
    void this.enqueueOperation((controller) => {
      controller.applyEvolutionError(payload);
    });
  }

  public complete(payload: PokemonBattleCompletedPayload): void {
    void this.enqueueOperation((controller) => {
      controller.complete(payload);
    });
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.bootstrapBlocking = false;
    this.latestTrainerState = undefined;

    this.controller?.destroy();
    this.controller = undefined;
    this.controllerPromise = undefined;
  }

  private enqueueOperation(
    operation: (controller: BattleController) => void | Promise<void>
  ): Promise<void> {
    if (this.destroyed) {
      return Promise.resolve();
    }

    this.bootstrapBlocking = true;

    const controllerPromise = this.ensureController();

    const task = this.operationChain.then(async () => {
      const controller = await controllerPromise;

      if (this.destroyed) {
        return;
      }

      await operation(controller);
    });

    const guardedTask = task
      .catch((error: unknown) => {
        if (!this.destroyed) {
          console.error("[LazyBattleController] battle operation failed", error);
        }
      })
      .finally(() => {
        if (!this.destroyed && this.controller) {
          this.bootstrapBlocking = false;
        }
      });

    this.operationChain = guardedTask;
    return guardedTask;
  }

  private ensureController(): Promise<BattleController> {
    if (this.controller) {
      return Promise.resolve(this.controller);
    }

    if (this.controllerPromise) {
      return this.controllerPromise;
    }

    const controllerPromise = this.createController();
    this.controllerPromise = controllerPromise;

    void controllerPromise.catch(() => {
      if (this.controllerPromise === controllerPromise) {
        this.controllerPromise = undefined;
      }

      this.bootstrapBlocking = false;
    });

    return controllerPromise;
  }

  private async createController(): Promise<BattleController> {
    const { BattleController, ensureBattleAudioLoaded } = await loadBattleFeatureModule();

    if (this.destroyed) {
      throw new Error("Battle feature was disposed while loading");
    }

    await ensureBattleAudioLoaded(this.scene);

    if (this.destroyed) {
      throw new Error("Battle feature was disposed while loading assets");
    }

    const controller = new BattleController(
      this.scene,
      this.pokemonSpriteLoader,
      this.sendBattleCommand,
      this.sendBattleReplacement,
      this.sendMoveLearningDecision,
      this.sendEvolutionDecision
    );

    if (this.latestTrainerState) {
      controller.setTrainerState(this.latestTrainerState);
    }

    this.controller = controller;
    return controller;
  }
}
