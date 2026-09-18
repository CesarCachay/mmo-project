import Phaser from "phaser";

import type { PokemonBattleCompletedPayload } from "@cesar-mmo/shared";

export const WILD_BATTLE_AUDIO_KEYS = {
  CAPTURE_CONTAINED: "wild-battle-capture-contained",
  CAPTURE_SUCCESS: "wild-battle-capture-success",
  CAPTURE_FAILED: "wild-battle-capture-failed",
  VICTORY: "wild-battle-victory",
  DEFEAT: "wild-battle-defeat",
} as const;

export const WILD_BATTLE_AUDIO_ASSETS = {
  CAPTURE_CONTAINED: "/assets/audio/battle/capture-contained.wav",
  CAPTURE_SUCCESS: "/assets/audio/battle/capture-success.wav",
  CAPTURE_FAILED: "/assets/audio/battle/capture-failed.wav",
  VICTORY: "/assets/audio/battle/wild-battle-victory.wav",
  DEFEAT: "/assets/audio/battle/wild-battle-defeat.wav",
} as const;

export class WildBattleAudioController {
  private readonly captureContained: Phaser.Sound.BaseSound;
  private readonly captureSuccess: Phaser.Sound.BaseSound;
  private readonly captureFailed: Phaser.Sound.BaseSound;
  private readonly victory: Phaser.Sound.BaseSound;
  private readonly defeat: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene) {
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

    this.defeat = scene.sound.add(WILD_BATTLE_AUDIO_KEYS.DEFEAT, {
      volume: 0.55,
    });
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

  public playBattleOutcome(outcome: PokemonBattleCompletedPayload["outcome"]): void {
    this.stopOutcome();

    switch (outcome) {
      case "wild-defeated":
        this.victory.play();
        return;

      case "trainer-defeated":
        this.defeat.play();
        return;

      /* wild-captured already has its own capture-success sound. trainer-escaped has no jingle */
      default:
        return;
    }
  }

  public stopOutcome(): void {
    this.victory.stop();
    this.defeat.stop();
  }

  public stopAll(): void {
    this.captureContained.stop();
    this.captureSuccess.stop();
    this.captureFailed.stop();

    this.stopOutcome();
  }

  public destroy(): void {
    this.stopAll();

    this.captureContained.destroy();
    this.captureSuccess.destroy();
    this.captureFailed.destroy();
    this.victory.destroy();
    this.defeat.destroy();
  }
}
