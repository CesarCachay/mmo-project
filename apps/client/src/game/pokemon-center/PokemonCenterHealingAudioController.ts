import Phaser from "phaser";

export const POKEMON_CENTER_HEALING_AUDIO_KEYS = {
  STEP: "pokemon-center-heal-step",
  COMPLETE: "pokemon-center-heal-complete",
} as const;

const STEP_VOLUME = 0.65;
const COMPLETE_VOLUME = 0.75;

const STEP_MIN_RATE = 0.92;
const STEP_MAX_RATE = 1.1;

export class PokemonCenterHealingAudioController {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public playStep(stepNumber: number, totalSteps: number): void {
    const safeTotal = Math.max(1, totalSteps);
    const safeStep = Phaser.Math.Clamp(stepNumber, 1, safeTotal);
    const progress = safeTotal <= 1 ? 0 : (safeStep - 1) / (safeTotal - 1);
    const rate = STEP_MIN_RATE + (STEP_MAX_RATE - STEP_MIN_RATE) * progress;

    this.scene.sound.play(POKEMON_CENTER_HEALING_AUDIO_KEYS.STEP, {
      volume: STEP_VOLUME,
      rate,
    });
  }

  public playComplete(): void {
    this.scene.sound.play(POKEMON_CENTER_HEALING_AUDIO_KEYS.COMPLETE, {
      volume: COMPLETE_VOLUME,
      rate: 1,
    });
  }

  public cancel(): void {
    this.scene.sound.stopByKey(POKEMON_CENTER_HEALING_AUDIO_KEYS.STEP);
    this.scene.sound.stopByKey(POKEMON_CENTER_HEALING_AUDIO_KEYS.COMPLETE);
  }

  public destroy(): void {
    this.cancel();
  }
}
