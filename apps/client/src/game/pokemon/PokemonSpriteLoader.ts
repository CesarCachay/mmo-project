import Phaser from "phaser";

import type { PokemonInstance } from "@cesar-mmo/shared";

import {
  getPokemonSpriteAsset,
  type PokemonSpriteAsset,
} from "./pokemon-sprite.registry";

type PokemonSpriteSource = Pick<PokemonInstance, "speciesId" | "formId">;

export class PokemonSpriteLoader {
  private readonly scene: Phaser.Scene;

  /**
   * Serializes dynamic Phaser loader operations.
   * This prevents two trainer-state updates from trying
   * to start independent loader batches at the same time.
   */
  private loadChain: Promise<void> = Promise.resolve();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public async ensurePokemonLoaded(
    pokemon: PokemonSpriteSource
  ): Promise<PokemonSpriteAsset> {
    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);
    await this.enqueueAssets([asset]);
    return asset;
  }

  public async ensurePartyLoaded(
    pokemon: readonly PokemonSpriteSource[]
  ): Promise<PokemonSpriteAsset[]> {
    const assets = pokemon.map((instance) =>
      getPokemonSpriteAsset(instance.speciesId, instance.formId)
    );
    await this.enqueueAssets(assets);
    return assets;
  }

  private enqueueAssets(assets: readonly PokemonSpriteAsset[]): Promise<void> {
    const loadTask = this.loadChain.then(() => this.loadMissingAssets(assets));

    /**
     * Keep the chain usable even if one asset fails.
     * The caller still receives the original rejection.
     */
    this.loadChain = loadTask.catch(() => undefined);
    return loadTask;
  }

  private loadMissingAssets(assets: readonly PokemonSpriteAsset[]): Promise<void> {
    const uniqueAssets = new Map<string, PokemonSpriteAsset>();

    for (const asset of assets) {
      uniqueAssets.set(asset.textureKey, asset);
    }

    const missingAssets = [...uniqueAssets.values()].filter(
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
                "Failed to load Pokémon sprite assets:",
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
