import type { BattleImpactFeedbackProfile } from "../../vfx/impact/battle-impact-feedback";
import { getBattleVfxPerformanceProfile } from "../../vfx/performance/battle-vfx-performance";

function wait(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export class ModernBattleImpactFeedbackController {
  private readonly root: HTMLElement;
  private generation = 0;
  private animationFrame?: number;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  public playHitStop(profile: BattleImpactFeedbackProfile): Promise<void> {
    const performanceProfile = getBattleVfxPerformanceProfile();
    const reducedMotion = performanceProfile.reducedMotion;
    const durationMs = reducedMotion
      ? Math.min(profile.hitStopMs, 14)
      : profile.hitStopMs;

    return wait(durationMs);
  }

  public playShake(profile: BattleImpactFeedbackProfile): Promise<void> {
    const performanceProfile = getBattleVfxPerformanceProfile();
    if (performanceProfile.reducedMotion) {
      return Promise.resolve();
    }

    const generation = this.beginShake();
    const durationMs = Math.max(1, profile.shakeDurationMs);
    const amplitude = Math.max(
      0,
      profile.shakeAmplitudePx * performanceProfile.shakeAmplitudeScale,
    );
    const frequency = Math.max(0.25, profile.shakeFrequency);
    const startedAt = performance.now();

    this.root.style.willChange = "translate";

    return new Promise((resolve) => {
      const finish = (): void => {
        if (generation === this.generation) {
          this.resetTranslate();
        }
        resolve();
      };

      const frame = (now: number): void => {
        if (generation !== this.generation) {
          resolve();
          return;
        }

        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / durationMs);

        if (progress >= 1) {
          finish();
          return;
        }

        const envelope = Math.pow(1 - progress, 1.45);
        const phase = elapsed * 0.085 * frequency;
        const x =
          (Math.sin(phase * 2.17) * 0.72 + Math.sin(phase * 4.73) * 0.28) *
          amplitude *
          envelope;
        const y =
          (Math.cos(phase * 2.89) * 0.52 + Math.sin(phase * 5.21) * 0.22) *
          amplitude *
          envelope;

        this.root.style.setProperty("translate", `${x.toFixed(2)}px ${y.toFixed(2)}px`);
        this.animationFrame = window.requestAnimationFrame(frame);
      };

      this.animationFrame = window.requestAnimationFrame(frame);
    });
  }

  public clear(): void {
    this.generation += 1;

    if (this.animationFrame !== undefined) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }

    this.resetTranslate();
  }

  public destroy(): void {
    this.clear();
  }

  private beginShake(): number {
    this.clear();
    return this.generation;
  }

  private resetTranslate(): void {
    this.root.style.removeProperty("translate");
    this.root.style.removeProperty("will-change");
  }
}
