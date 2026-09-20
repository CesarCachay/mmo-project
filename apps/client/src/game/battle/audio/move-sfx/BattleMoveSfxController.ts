import Phaser from "phaser";

import type { BattleInstance } from "@cesar-mmo/shared";

import {
  getBattleMoveSfxAsset,
  type BattleMoveSfxAssetId,
} from "./move-sfx.assets";
import { getBattleMoveSfxProfile } from "./move-sfx.registry";
import { getBattleVfxPerformanceProfile } from "../../vfx/performance/battle-vfx-performance";

export class BattleMoveSfxController {
  private readonly scene: Phaser.Scene;
  private readonly activeSounds = new Set<Phaser.Sound.BaseSound>();
  private readonly recentAssetPlays = new Map<BattleMoveSfxAssetId, number>();
  private loadQueue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public preloadBattle(battle: BattleInstance): Promise<void> {
    const assetIds = new Set<BattleMoveSfxAssetId>();

    for (const participant of battle.participants) {
      const activePokemon = participant.pokemon[participant.activePokemonIndex];
      if (!activePokemon) {
        continue;
      }

      for (const instanceMove of activePokemon.pokemon.moves) {
        const profile = getBattleMoveSfxProfile(instanceMove.moveId);
        if (!profile) {
          continue;
        }

        for (const id of [...profile.useAssets, ...profile.impactAssets, ...profile.missAssets]) {
          assetIds.add(id);
        }
      }
    }

    return this.ensureAssets([...assetIds]);
  }

  public async playMoveUse(moveId: number, hitCount?: number): Promise<void> {
    const profile = getBattleMoveSfxProfile(moveId, hitCount);
    if (!profile) {
      return;
    }

    await this.playAssets(profile.useAssets);
  }

  public async playMoveImpact(moveId: number, hitCount?: number): Promise<void> {
    const profile = getBattleMoveSfxProfile(moveId, hitCount);
    if (!profile) {
      return;
    }

    await this.playAssets(profile.impactAssets);
  }

  public async playMoveMiss(moveId: number): Promise<void> {
    const profile = getBattleMoveSfxProfile(moveId);
    if (!profile) {
      return;
    }

    await this.playAssets(profile.missAssets);
  }

  public stopAll(): void {
    for (const sound of this.activeSounds) {
      sound.stop();
      sound.destroy();
    }

    this.activeSounds.clear();
    this.recentAssetPlays.clear();
  }

  public destroy(): void {
    this.disposed = true;
    this.stopAll();
  }

  private async playAssets(ids: readonly BattleMoveSfxAssetId[]): Promise<void> {
    if (this.disposed || ids.length === 0) {
      return;
    }

    await this.ensureAssets(ids);

    if (this.disposed) {
      return;
    }

    const performanceProfile = getBattleVfxPerformanceProfile();

    for (const id of ids) {
      const now = performance.now();
      const lastPlayedAt = this.recentAssetPlays.get(id);

      if (
        lastPlayedAt !== undefined &&
        now - lastPlayedAt < performanceProfile.sameAssetCooldownMs
      ) {
        continue;
      }

      const asset = getBattleMoveSfxAsset(id);
      if (!this.scene.cache.audio.exists(asset.key)) {
        continue;
      }

      this.enforceVoiceBudget(performanceProfile.maxConcurrentMoveSounds);

      const sound = this.scene.sound.add(asset.key, {
        volume: asset.volume,
      });

      const cleanup = (): void => {
        this.activeSounds.delete(sound);
        sound.destroy();
      };

      sound.once(Phaser.Sound.Events.COMPLETE, cleanup);

      this.recentAssetPlays.set(id, now);
      this.activeSounds.add(sound);
      sound.play();
    }
  }

  private enforceVoiceBudget(maxConcurrentSounds: number): void {
    while (this.activeSounds.size >= maxConcurrentSounds) {
      const oldest = this.activeSounds.values().next().value as
        | Phaser.Sound.BaseSound
        | undefined;

      if (!oldest) {
        return;
      }

      this.activeSounds.delete(oldest);
      oldest.stop();
      oldest.destroy();
    }
  }

  private ensureAssets(ids: readonly BattleMoveSfxAssetId[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];

    const task = this.loadQueue.then(async () => {
      if (this.disposed) {
        return;
      }

      await this.waitForActiveLoader();

      const missing = uniqueIds
        .map((id) => getBattleMoveSfxAsset(id))
        .filter((asset) => !this.scene.cache.audio.exists(asset.key));

      if (missing.length === 0) {
        return;
      }

      for (const asset of missing) {
        this.scene.load.audio(asset.key, asset.path);
      }

      await new Promise<void>((resolve) => {
        this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
          const failed = missing.filter(
            (asset) => !this.scene.cache.audio.exists(asset.key),
          );

          if (failed.length > 0) {
            console.warn("[BattleMoveSfx] some assets failed to load", {
              assets: failed.map((asset) => asset.path),
            });
          }

          resolve();
        });

        this.scene.load.start();
      });
    });

    this.loadQueue = task.catch((error) => {
      console.warn("[BattleMoveSfx] lazy audio load failed", error);
    });

    return this.loadQueue;
  }

  private async waitForActiveLoader(): Promise<void> {
    if (!this.scene.load.isLoading()) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    });
  }
}
