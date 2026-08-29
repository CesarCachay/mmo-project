import Phaser from "phaser";
import type { PokemonInstance } from "@cesar-mmo/shared";
import {
  POKEMON_OVERWORLD_DIRECTIONS,
  getPokemonOverworldSpriteAsset,
} from "./pokemon-overworld-sprite.registry";

export class PokemonOverworldSpriteLoader {
  private readonly scene: Phaser.Scene;
  private loadChain: Promise<void> = Promise.resolve();
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public ensurePokemonLoaded(
    pokemon: Pick<PokemonInstance, "speciesId" | "formId">
  ): Promise<void> {
    const task = this.loadChain.then(() => this.loadPokemon(pokemon));
    this.loadChain = task.catch(() => undefined);
    return task;
  }

  private loadPokemon(
    pokemon: Pick<PokemonInstance, "speciesId" | "formId">
  ): Promise<void> {
    const assets = POKEMON_OVERWORLD_DIRECTIONS.flatMap((direction) => [
      getPokemonOverworldSpriteAsset(pokemon.speciesId, pokemon.formId, direction, 1),
      getPokemonOverworldSpriteAsset(pokemon.speciesId, pokemon.formId, direction, 2),
    ]);

    const missingAssets = assets.filter(
      (asset) => !this.scene.textures.exists(asset.textureKey)
    );

    if (missingAssets.length === 0) {
      return Promise.resolve();
    }

    for (const asset of missingAssets) {
      this.scene.load.image(asset.textureKey, asset.path);
    }

    return new Promise<void>((resolve, reject) => {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        const failedAssets = missingAssets.filter(
          (asset) => !this.scene.textures.exists(asset.textureKey)
        );
        if (failedAssets.length > 0) {
          reject(
            new Error(
              [
                "Failed to load Pokémon overworld assets:",
                ...failedAssets.map((asset) => `${asset.textureKey} -> ${asset.path}`),
              ].join("\n")
            )
          );
          return;
        }
        resolve();
      });
      this.scene.load.start();
    });
  }
}
