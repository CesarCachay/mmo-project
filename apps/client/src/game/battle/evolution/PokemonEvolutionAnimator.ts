import { getPokemonSpecies } from "@cesar-mmo/shared";

import { getPokemonBattleSpriteAsset } from "../../pokemon/pokemon-battle-sprite.registry";
import { getPokemonSpriteAsset } from "../../pokemon/pokemon-sprite.registry";

import { ModernBattleEvolutionLayer } from "../ui/modern/ModernBattleEvolutionLayer";

import { POKEMON_EVOLUTION_ANIMATION_TIMING as TIMING } from "./pokemon-evolution-animation-timing";

export interface PokemonEvolutionAnimationInput {
  readonly sourceSpeciesId: number;
  readonly sourceFormId: number;

  readonly targetSpeciesId: number;
  readonly targetFormId: number;
}

export interface PokemonEvolutionAnimatorOptions {
  readonly layer: ModernBattleEvolutionLayer;

  readonly presentMessage: (
    message: string,
    durationMs?: number,
  ) => Promise<void>;
}

export class PokemonEvolutionAnimator {
  private readonly layer: ModernBattleEvolutionLayer;

  private readonly presentMessage: PokemonEvolutionAnimatorOptions["presentMessage"];

  constructor(options: PokemonEvolutionAnimatorOptions) {
    this.layer = options.layer;

    this.presentMessage = options.presentMessage;
  }

  public async play(input: PokemonEvolutionAnimationInput): Promise<void> {
    const sourceName = this.getSpeciesDisplayName(input.sourceSpeciesId);

    const targetName = this.getSpeciesDisplayName(input.targetSpeciesId);

    const [sourceSpritePath, targetSpritePath] = await Promise.all([
      this.resolveSpritePath(input.sourceSpeciesId, input.sourceFormId),

      this.resolveSpritePath(input.targetSpeciesId, input.targetFormId),
    ]);

    await this.presentMessage(
      `${sourceName} is evolving...`,
      TIMING.introMessageMs,
    );

    this.layer.showSprite(sourceSpritePath, sourceName);

    await this.delay(TIMING.initialSourceHoldMs);

    let showTarget = false;

    for (const durationMs of TIMING.swapTimingsMs) {
      showTarget = !showTarget;

      await this.layer.swapSprite(
        showTarget ? targetSpritePath : sourceSpritePath,

        showTarget ? targetName : sourceName,

        durationMs,
      );
    }

    await this.layer.revealTarget(targetSpritePath, targetName);

    await this.delay(TIMING.postRevealHoldMs);

    await this.presentMessage(
      `Congratulations! ${sourceName} evolved into ${targetName}!`,
      TIMING.congratulationsMessageMs,
    );

    await this.delay(TIMING.finalHoldMs);

    this.layer.clear();
  }

  private async resolveSpritePath(
    speciesId: number,
    formId: number,
  ): Promise<string> {
    /*
     * Evolution cinematic deliberately uses
     * FRONT sprites rather than the trainer's
     * normal BACK battle sprite.
     */
    const battleAsset = getPokemonBattleSpriteAsset(speciesId, formId, "front");

    const fallbackAsset = getPokemonSpriteAsset(speciesId, formId);

    const battleAvailable = await this.canLoadImage(battleAsset.path);

    return battleAvailable ? battleAsset.path : fallbackAsset.path;
  }

  private canLoadImage(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      const image = new Image();

      image.onload = () => resolve(true);

      image.onerror = () => resolve(false);

      image.src = src;
    });
  }

  private getSpeciesDisplayName(speciesId: number): string {
    const species = getPokemonSpecies(speciesId);

    if (!species) {
      return `Pokémon ${speciesId}`;
    }

    return species.name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }
}
