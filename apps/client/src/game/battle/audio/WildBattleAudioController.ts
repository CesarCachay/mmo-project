import Phaser from "phaser";

import type {
  BattleType,
  PokemonBattleCompletedPayload,
  PokemonBattlePresentationContext,
} from "@cesar-mmo/shared";

import { resolveBattleMusicProfile } from "./battle-music-profile";
import { resolveBattleOutcomeAudioProfile } from "./battle-outcome-audio-profile";

export const WILD_BATTLE_AUDIO_KEYS = {
  THEME: "wild-battle-theme",
  CAPTURE_CONTAINED: "wild-battle-capture-contained",
  CAPTURE_SUCCESS: "wild-battle-capture-success",
  CAPTURE_FAILED: "wild-battle-capture-failed",
  VICTORY: "wild-battle-victory",
  DEFEAT: "wild-battle-defeat",
} as const;

export const WILD_BATTLE_AUDIO_ASSETS = {
  THEME: "/assets/audio/battle/wild-battle-theme.wav",
  CAPTURE_CONTAINED: "/assets/audio/battle/capture-contained.wav",
  CAPTURE_SUCCESS: "/assets/audio/battle/capture-success.wav",
  CAPTURE_FAILED: "/assets/audio/battle/capture-failed.wav",
  VICTORY: "/assets/audio/battle/wild-battle-victory.wav",
  DEFEAT: "/assets/audio/battle/wild-battle-defeat.wav",
} as const;

export const TRAINER_BATTLE_AUDIO_KEYS = {
  THEME: "trainer-battle-theme",
} as const;

export const TRAINER_BATTLE_AUDIO_ASSETS = {
  THEME: "/assets/audio/battle/trainer-battle-theme.wav",
} as const;

export const GYM_LEADER_BATTLE_AUDIO_KEYS = {
  THEME: "gym-leader-battle-theme",
  VICTORY: "gym-leader-battle-victory",
} as const;

export const GYM_LEADER_BATTLE_AUDIO_ASSETS = {
  THEME: "/assets/audio/battle/gym-leader-battle-theme.wav",
  VICTORY: "/assets/audio/battle/gym-leader-battle-victory.wav",
} as const;

export const BATTLE_ITEM_AUDIO_KEYS = {
  HEAL: "battle-item-heal",
  REVIVE: "battle-item-revive",
} as const;

export const BATTLE_ITEM_AUDIO_ASSETS = {
  HEAL: "/assets/audio/battle/item-heal.wav",
  REVIVE: "/assets/audio/battle/item-revive.wav",
} as const;

export class WildBattleAudioController {
  private readonly theme: Phaser.Sound.BaseSound;
  private readonly trainerTheme: Phaser.Sound.BaseSound;
  private readonly gymLeaderTheme?: Phaser.Sound.BaseSound;
  private readonly captureContained: Phaser.Sound.BaseSound;
  private readonly captureSuccess: Phaser.Sound.BaseSound;
  private readonly captureFailed: Phaser.Sound.BaseSound;
  private readonly victory: Phaser.Sound.BaseSound;
  private readonly gymLeaderVictory?: Phaser.Sound.BaseSound;
  private readonly defeat: Phaser.Sound.BaseSound;
  private readonly itemHeal: Phaser.Sound.BaseSound;
  private readonly itemRevive: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene) {
    this.theme = scene.sound.add(WILD_BATTLE_AUDIO_KEYS.THEME, {
      volume: 0.3,
      loop: true,
    });

    this.trainerTheme = scene.sound.add(TRAINER_BATTLE_AUDIO_KEYS.THEME, {
      volume: 0.32,
      loop: true,
    });

    if (scene.cache.audio.exists(GYM_LEADER_BATTLE_AUDIO_KEYS.THEME)) {
      this.gymLeaderTheme = scene.sound.add(GYM_LEADER_BATTLE_AUDIO_KEYS.THEME, {
        volume: 0.34,
        loop: true,
      });
    }

    this.captureContained = scene.sound.add(WILD_BATTLE_AUDIO_KEYS.CAPTURE_CONTAINED, {
      volume: 0.48,
    });

    this.captureSuccess = scene.sound.add(WILD_BATTLE_AUDIO_KEYS.CAPTURE_SUCCESS, {
      volume: 0.55,
    });

    this.captureFailed = scene.sound.add(WILD_BATTLE_AUDIO_KEYS.CAPTURE_FAILED, {
      volume: 0.52,
    });

    this.victory = scene.sound.add(WILD_BATTLE_AUDIO_KEYS.VICTORY, {
      volume: 0.58,
    });

    if (scene.cache.audio.exists(GYM_LEADER_BATTLE_AUDIO_KEYS.VICTORY)) {
      this.gymLeaderVictory = scene.sound.add(GYM_LEADER_BATTLE_AUDIO_KEYS.VICTORY, {
        volume: 0.62,
      });
    }

    this.defeat = scene.sound.add(WILD_BATTLE_AUDIO_KEYS.DEFEAT, {
      volume: 0.55,
    });

    this.itemHeal = scene.sound.add(BATTLE_ITEM_AUDIO_KEYS.HEAL, {
      volume: 0.46,
    });

    this.itemRevive = scene.sound.add(BATTLE_ITEM_AUDIO_KEYS.REVIVE, {
      volume: 0.5,
    });
  }

  public playBattleMusic(
    battleType: BattleType,
    presentation?: PokemonBattlePresentationContext,
  ): void {
    this.stopBattleMusic();

    switch (resolveBattleMusicProfile(battleType, presentation)) {
      case "wild":
        this.theme.play();
        return;

      case "trainer":
        this.trainerTheme.play();
        return;

      case "gym-leader":
        (this.gymLeaderTheme ?? this.trainerTheme).play();
        return;
    }
  }

  public stopBattleMusic(): void {
    this.theme.stop();
    this.trainerTheme.stop();
    this.gymLeaderTheme?.stop();
  }

  public playCaptureContained(): void {
    this.captureContained.stop();
    this.captureContained.play();
  }

  public playCaptureSuccess(): void {
    this.captureSuccess.stop();
    this.captureSuccess.play();
  }

  public playCaptureFailed(): void {
    this.captureFailed.stop();
    this.captureFailed.play();
  }

  public playHpRestore(isRevive: boolean): void {
    const sound = isRevive ? this.itemRevive : this.itemHeal;
    sound.stop();
    sound.play();
  }

  public playBattleOutcome(
    outcome: PokemonBattleCompletedPayload["outcome"],
    presentation?: PokemonBattlePresentationContext,
  ): void {
    this.stopBattleMusic();
    this.stopOutcome();

    switch (resolveBattleOutcomeAudioProfile(outcome, presentation)) {
      case "standard-victory":
        this.victory.play();
        return;

      case "gym-leader-victory":
        (this.gymLeaderVictory ?? this.victory).play();
        return;

      case "defeat":
        this.defeat.play();
        return;

      /* wild-captured already has its own capture-success sound. trainer-escaped has no jingle */
      case "none":
        return;
    }
  }

  public stopOutcome(): void {
    this.victory.stop();
    this.gymLeaderVictory?.stop();
    this.defeat.stop();
  }

  public stopAll(): void {
    this.stopBattleMusic();
    this.captureContained.stop();
    this.captureSuccess.stop();
    this.captureFailed.stop();
    this.itemHeal.stop();
    this.itemRevive.stop();

    this.stopOutcome();
  }

  public destroy(): void {
    this.stopAll();

    this.theme.destroy();
    this.trainerTheme.destroy();
    this.gymLeaderTheme?.destroy();
    this.captureContained.destroy();
    this.captureSuccess.destroy();
    this.captureFailed.destroy();
    this.itemHeal.destroy();
    this.itemRevive.destroy();
    this.victory.destroy();
    this.gymLeaderVictory?.destroy();
    this.defeat.destroy();
  }
}
