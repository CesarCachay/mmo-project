import Phaser from "phaser";

import "./ui/modern/battle-ui.css";
import "./ui/modern/mobile-battle-ui.css";
import "./ui/modern/animations.css";
import "./ui/modern/move-vfx.css";
import "./ui/modern/items.css";
import "./ui/modern/progression.css";
import "./ui/modern/evolution.css";
import "./ui/modern/battle-shell-compat.css";

import { BattleController } from "./BattleController";
import {
  WILD_BATTLE_AUDIO_ASSETS,
  WILD_BATTLE_AUDIO_KEYS,
} from "./audio/WildBattleAudioController";

export { BattleController };

type BattleAudioAsset = Readonly<{
  key: string;
  path: string;
}>;

const BATTLE_AUDIO_ASSETS: readonly BattleAudioAsset[] = [
  {
    key: WILD_BATTLE_AUDIO_KEYS.CAPTURE_CONTAINED,
    path: WILD_BATTLE_AUDIO_ASSETS.CAPTURE_CONTAINED,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.CAPTURE_SUCCESS,
    path: WILD_BATTLE_AUDIO_ASSETS.CAPTURE_SUCCESS,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.CAPTURE_FAILED,
    path: WILD_BATTLE_AUDIO_ASSETS.CAPTURE_FAILED,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.VICTORY,
    path: WILD_BATTLE_AUDIO_ASSETS.VICTORY,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.DEFEAT,
    path: WILD_BATTLE_AUDIO_ASSETS.DEFEAT,
  },
];

function getMissingBattleAudioAssets(scene: Phaser.Scene): BattleAudioAsset[] {
  return BATTLE_AUDIO_ASSETS.filter((asset) => !scene.cache.audio.exists(asset.key));
}

async function waitForActiveLoader(scene: Phaser.Scene): Promise<void> {
  if (!scene.load.isLoading()) {
    return;
  }

  await new Promise<void>((resolve) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
  });
}

export async function ensureBattleAudioLoaded(scene: Phaser.Scene): Promise<void> {
  await waitForActiveLoader(scene);

  const missingAssets = getMissingBattleAudioAssets(scene);

  if (missingAssets.length === 0) {
    return;
  }

  for (const asset of missingAssets) {
    scene.load.audio(asset.key, asset.path);
  }

  await new Promise<void>((resolve, reject) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      const failedAssets = getMissingBattleAudioAssets(scene).filter((asset) =>
        missingAssets.some((missingAsset) => missingAsset.key === asset.key)
      );

      if (failedAssets.length > 0) {
        reject(
          new Error(
            [
              "Failed to load battle audio assets:",
              ...failedAssets.map((asset) => `${asset.key} -> ${asset.path}`),
            ].join("\n")
          )
        );
        return;
      }

      resolve();
    });

    scene.load.start();
  });
}
