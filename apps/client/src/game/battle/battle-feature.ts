import Phaser from "phaser";

import "./ui/modern/battle-ui.css";
import "./ui/modern/mobile-battle-ui.css";
import "./ui/modern/animations.css";
import "./ui/modern/move-vfx.css";
import "./ui/modern/status-vfx.css";
import "./ui/modern/items.css";
import "./ui/modern/progression.css";
import "./ui/modern/evolution.css";
import "./ui/modern/battle-shell-compat.css";

import { BattleController } from "./BattleController";
import {
  BATTLE_ITEM_AUDIO_ASSETS,
  BATTLE_ITEM_AUDIO_KEYS,
  GYM_LEADER_BATTLE_AUDIO_ASSETS,
  GYM_LEADER_BATTLE_AUDIO_KEYS,
  TRAINER_BATTLE_AUDIO_ASSETS,
  TRAINER_BATTLE_AUDIO_KEYS,
  WILD_BATTLE_AUDIO_ASSETS,
  WILD_BATTLE_AUDIO_KEYS,
} from "./audio/WildBattleAudioController";

export { BattleController };

type BattleAudioAsset = Readonly<{
  key: string;
  path: string;
  required?: boolean;
}>;

const BATTLE_AUDIO_ASSETS: readonly BattleAudioAsset[] = [
  {
    key: WILD_BATTLE_AUDIO_KEYS.THEME,
    path: WILD_BATTLE_AUDIO_ASSETS.THEME,
    required: true,
  },
  {
    key: TRAINER_BATTLE_AUDIO_KEYS.THEME,
    path: TRAINER_BATTLE_AUDIO_ASSETS.THEME,
    required: true,
  },
  {
    key: GYM_LEADER_BATTLE_AUDIO_KEYS.THEME,
    path: GYM_LEADER_BATTLE_AUDIO_ASSETS.THEME,
  },
  {
    key: GYM_LEADER_BATTLE_AUDIO_KEYS.VICTORY,
    path: GYM_LEADER_BATTLE_AUDIO_ASSETS.VICTORY,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.CAPTURE_CONTAINED,
    path: WILD_BATTLE_AUDIO_ASSETS.CAPTURE_CONTAINED,
    required: true,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.CAPTURE_SUCCESS,
    path: WILD_BATTLE_AUDIO_ASSETS.CAPTURE_SUCCESS,
    required: true,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.CAPTURE_FAILED,
    path: WILD_BATTLE_AUDIO_ASSETS.CAPTURE_FAILED,
    required: true,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.VICTORY,
    path: WILD_BATTLE_AUDIO_ASSETS.VICTORY,
    required: true,
  },
  {
    key: WILD_BATTLE_AUDIO_KEYS.DEFEAT,
    path: WILD_BATTLE_AUDIO_ASSETS.DEFEAT,
    required: true,
  },
  {
    key: BATTLE_ITEM_AUDIO_KEYS.HEAL,
    path: BATTLE_ITEM_AUDIO_ASSETS.HEAL,
    required: true,
  },
  {
    key: BATTLE_ITEM_AUDIO_KEYS.REVIVE,
    path: BATTLE_ITEM_AUDIO_ASSETS.REVIVE,
    required: true,
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
      const failedRequiredAssets = failedAssets.filter((asset) => asset.required);
      const failedOptionalAssets = failedAssets.filter((asset) => !asset.required);

      if (failedOptionalAssets.length > 0) {
        console.warn(
          [
            "Optional battle audio assets failed to load; runtime fallbacks will be used:",
            ...failedOptionalAssets.map((asset) => `${asset.key} -> ${asset.path}`),
          ].join("\n")
        );
      }

      if (failedRequiredAssets.length > 0) {
        reject(
          new Error(
            [
              "Failed to load battle audio assets:",
              ...failedRequiredAssets.map((asset) => `${asset.key} -> ${asset.path}`),
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
