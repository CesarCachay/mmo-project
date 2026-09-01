import Phaser from "phaser";

import type {
  BattleInstance,
  PokemonBattleStartedPayload,
  PokemonBattleReplacementResolvedPayload,
  PokemonBattleCompletedPayload,
  PokemonBattleStateUpdatedPayload,
  PokemonBattleCommandInput,
  PokemonBattleReplacementInput,
} from "@cesar-mmo/shared";

import { PokemonSpriteLoader } from "../pokemon/PokemonSpriteLoader";

import { BattleOverlay } from "./ui/BattleOverlay";

import type { BattleClientInteractionState } from "./battle-client.types";

export class BattleController {
  private activeBattlePayload?: PokemonBattleStartedPayload;
  private readonly overlay: BattleOverlay;
  private readonly pokemonSpriteLoader: PokemonSpriteLoader;

  private interactionState: BattleClientInteractionState = "completed";

  private readonly sendBattleCommand: (input: PokemonBattleCommandInput) => void;

  private readonly sendBattleReplacement: (input: PokemonBattleReplacementInput) => void;

  private replacementPokemonIndexes: readonly number[] = [];

  constructor(
    scene: Phaser.Scene,
    pokemonSpriteLoader: PokemonSpriteLoader,
    sendBattleCommand: (input: PokemonBattleCommandInput) => void,
    sendBattleReplacement: (input: PokemonBattleReplacementInput) => void
  ) {
    this.pokemonSpriteLoader = pokemonSpriteLoader;
    this.sendBattleCommand = sendBattleCommand;
    this.sendBattleReplacement = sendBattleReplacement;
    this.overlay = new BattleOverlay(
      scene,
      (moveId) => {
        this.handleMoveSelected(moveId);
      },
      (pokemonIndex) => {
        this.handleReplacementSelected(pokemonIndex);
      },
      () => {
        this.handleCompletionAcknowledged();
      }
    );
  }

  public get isActive(): boolean {
    return this.activeBattlePayload !== undefined;
  }

  public get activeBattle(): PokemonBattleStartedPayload | undefined {
    return this.activeBattlePayload;
  }

  public async start(payload: PokemonBattleStartedPayload): Promise<void> {
    const currentBattleId = this.activeBattlePayload?.battle.battleId;
    const nextBattleId = payload.battle.battleId;

    if (currentBattleId && currentBattleId !== nextBattleId) {
      console.warn("[BattleController] replacing active battle", {
        currentBattleId,
        nextBattleId,
      });
    }

    this.activeBattlePayload = payload;
    this.replacementPokemonIndexes = [];
    this.setInteractionState("waiting-for-server");

    this.overlay.show();

    try {
      await this.ensureBattleSpritesLoaded(payload.battle);

      if (this.activeBattlePayload?.battle.battleId !== nextBattleId) {
        return;
      }

      this.overlay.renderBattle(payload.battle);
      this.setInteractionState("selecting-action");
    } catch (error) {
      console.error("[BattleController] failed to prepare battle presentation", error);
    }
  }

  public async applyReplacement(
    payload: PokemonBattleReplacementResolvedPayload
  ): Promise<void> {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      console.warn("[BattleController] replacement received without active battle");

      return;
    }

    if (currentBattle.battle.battleId !== payload.battle.battleId) {
      console.warn("[BattleController] replacement battle mismatch", {
        activeBattleId: currentBattle.battle.battleId,
        receivedBattleId: payload.battle.battleId,
      });

      return;
    }

    this.activeBattlePayload = {
      battle: payload.battle,
    };

    this.replacementPokemonIndexes = [];

    this.setInteractionState("waiting-for-server");

    try {
      await this.ensureBattleSpritesLoaded(payload.battle);

      if (this.activeBattlePayload?.battle.battleId !== payload.battle.battleId) {
        return;
      }

      this.overlay.renderBattle(payload.battle);
      this.setInteractionState("selecting-action");

      console.log("[BattleController] replacement presentation applied", {
        battleId: payload.battle.battleId,
        nextTurnNumber: payload.nextTurnNumber,
      });
    } catch (error) {
      console.error(
        "[BattleController] failed to prepare replacement presentation",
        error
      );
    }
  }

  public complete(payload: PokemonBattleCompletedPayload): void {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      return;
    }

    if (currentBattle.battle.battleId !== payload.battleId) {
      console.warn("[BattleController] completed battle mismatch", {
        activeBattleId: currentBattle.battle.battleId,
        completedBattleId: payload.battleId,
      });
      return;
    }

    this.setInteractionState("completed");
    this.replacementPokemonIndexes = [];
    this.overlay.showCompletion(payload.outcome);
  }

  public destroy(): void {
    this.interactionState = "completed";
    this.replacementPokemonIndexes = [];
    this.activeBattlePayload = undefined;
    this.overlay.destroy();
  }

  private async ensureBattleSpritesLoaded(battle: BattleInstance): Promise<void> {
    const trainerParticipant = battle.participants.find(
      (participant) => participant.type === "trainer"
    );

    const wildParticipant = battle.participants.find(
      (participant) => participant.type === "wild"
    );

    if (!trainerParticipant || !wildParticipant) {
      return;
    }

    const trainerPokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];

    const wildPokemon = wildParticipant.pokemon[wildParticipant.activePokemonIndex];

    if (!trainerPokemon || !wildPokemon) {
      return;
    }

    await this.pokemonSpriteLoader.ensurePartyLoaded([
      trainerPokemon.pokemon,
      wildPokemon.pokemon,
    ]);
  }

  public async applyStateUpdate(
    payload: PokemonBattleStateUpdatedPayload
  ): Promise<void> {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      console.warn("[BattleController] state update received without active battle");
      return;
    }

    if (currentBattle.battle.battleId !== payload.battle.battleId) {
      console.warn("[BattleController] state update battle mismatch", {
        activeBattleId: currentBattle.battle.battleId,
        receivedBattleId: payload.battle.battleId,
      });

      return;
    }

    this.activeBattlePayload = {
      battle: payload.battle,
    };

    this.replacementPokemonIndexes =
      payload.interactionState === "replacement-required"
        ? [...payload.replacementPokemonIndexes]
        : [];

    this.setInteractionState("waiting-for-server");

    try {
      await this.ensureBattleSpritesLoaded(payload.battle);

      if (this.activeBattlePayload?.battle.battleId !== payload.battle.battleId) {
        return;
      }

      this.overlay.renderBattle(payload.battle);

      if (payload.interactionState === "replacement-required") {
        this.overlay.setReplacementOptions(
          payload.battle,
          this.replacementPokemonIndexes
        );
      }

      this.setInteractionState(payload.interactionState);

      console.log("[BattleController] state updated", {
        battleId: payload.battle.battleId,
        resolvedTurnNumber: payload.resolvedTurnNumber,
        interactionState: payload.interactionState,
        nextTurnNumber: payload.nextTurnNumber,
      });
    } catch (error) {
      console.error("[BattleController] failed to refresh battle presentation", error);
    }
  }

  private setInteractionState(state: BattleClientInteractionState): void {
    this.interactionState = state;
    this.overlay.setInteractionState(state);
  }

  private handleMoveSelected(moveId: number): void {
    if (this.interactionState !== "selecting-action") {
      return;
    }

    const payload = this.activeBattlePayload;

    if (!payload) {
      return;
    }

    const trainerParticipant = payload.battle.participants.find(
      (participant) => participant.type === "trainer"
    );

    if (!trainerParticipant) {
      return;
    }

    const activePokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];

    if (!activePokemon) {
      return;
    }

    const instanceMove = activePokemon.pokemon.moves.find(
      (move) => move.moveId === moveId
    );

    if (!instanceMove || instanceMove.currentPp <= 0) {
      return;
    }

    /*
     * Bloqueamos ANTES del emit.
     * Evita:
     * - double click
     * - command spam
     * - duplicate turn submission
     */
    this.setInteractionState("waiting-for-server");

    try {
      this.sendBattleCommand({
        battleId: payload.battle.battleId,

        action: {
          type: "use-move",
          moveId,
        },
      });

      console.log("[BattleController] move submitted", {
        battleId: payload.battle.battleId,
        moveId,
      });
    } catch (error) {
      this.setInteractionState("selecting-action");
      console.error("[BattleController] failed to submit move", error);
    }
  }

  private handleReplacementSelected(pokemonIndex: number): void {
    if (this.interactionState !== "replacement-required") {
      return;
    }

    const payload = this.activeBattlePayload;

    if (!payload) {
      return;
    }

    if (!this.replacementPokemonIndexes.includes(pokemonIndex)) {
      console.warn("[BattleController] invalid replacement selection", {
        pokemonIndex,
        replacementPokemonIndexes: this.replacementPokemonIndexes,
      });

      return;
    }

    const trainer = payload.battle.participants.find(
      (participant) => participant.type === "trainer"
    );

    if (!trainer) {
      return;
    }

    const pokemonState = trainer.pokemon[pokemonIndex];

    if (
      !pokemonState ||
      pokemonIndex === trainer.activePokemonIndex ||
      pokemonState.currentHp <= 0
    ) {
      return;
    }

    /* Bloqueamos ANTES del emit. */
    this.setInteractionState("waiting-for-server");

    try {
      this.sendBattleReplacement({
        battleId: payload.battle.battleId,
        replacementPokemonIndex: pokemonIndex,
      });

      console.log("[BattleController] replacement submitted", {
        battleId: payload.battle.battleId,
        replacementPokemonIndex: pokemonIndex,
      });
    } catch (error) {
      this.setInteractionState("replacement-required");
      console.error("[BattleController] failed to submit replacement", error);
    }
  }

  private handleCompletionAcknowledged(): void {
    if (this.interactionState !== "completed") {
      return;
    }
    if (!this.activeBattlePayload) {
      return;
    }

    //  Aqui si liberamos Battle.
    this.replacementPokemonIndexes = [];
    this.activeBattlePayload = undefined;
    this.overlay.hide();
  }
}
