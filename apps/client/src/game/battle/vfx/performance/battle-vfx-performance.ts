export type BattleVfxQualityTier = "low" | "balanced" | "high";

export interface BattleVfxPerformanceProfile {
  readonly tier: BattleVfxQualityTier;
  readonly reducedMotion: boolean;
  readonly pixelRatioCap: number;
  readonly persistentFps: number;
  readonly particleScale: number;
  readonly maxConcurrentMoveSounds: number;
  readonly sameAssetCooldownMs: number;
  readonly shakeAmplitudeScale: number;
  readonly impactDurationScale: number;
}

type NavigatorWithDeviceMemory = Navigator & {
  readonly deviceMemory?: number;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

function mediaMatches(query: string): boolean {
  return window.matchMedia?.(query).matches ?? false;
}

function resolveTier(): BattleVfxQualityTier {
  const navigatorWithMemory = navigator as NavigatorWithDeviceMemory;
  const memoryGb = navigatorWithMemory.deviceMemory;
  const logicalCores = navigator.hardwareConcurrency || 4;
  const coarsePointer = mediaMatches(COARSE_POINTER_QUERY);
  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const backingPixels = window.innerWidth * window.innerHeight * devicePixelRatio ** 2;

  const clearlyConstrained =
    (memoryGb !== undefined && memoryGb <= 4) ||
    logicalCores <= 4 ||
    (coarsePointer && backingPixels >= 4_000_000);

  if (clearlyConstrained) {
    return "low";
  }

  const clearlyHighEnd =
    !coarsePointer &&
    logicalCores >= 8 &&
    (memoryGb === undefined || memoryGb >= 8);

  return clearlyHighEnd ? "high" : "balanced";
}

export function getBattleVfxPerformanceProfile(): BattleVfxPerformanceProfile {
  const reducedMotion = mediaMatches(REDUCED_MOTION_QUERY);

  if (reducedMotion) {
    return {
      tier: "low",
      reducedMotion: true,
      pixelRatioCap: 1,
      persistentFps: 12,
      particleScale: 0.35,
      maxConcurrentMoveSounds: 3,
      sameAssetCooldownMs: 65,
      shakeAmplitudeScale: 0,
      impactDurationScale: 0.7,
    };
  }

  const tier = resolveTier();

  switch (tier) {
    case "low":
      return {
        tier,
        reducedMotion: false,
        pixelRatioCap: 1.25,
        persistentFps: 18,
        particleScale: 0.58,
        maxConcurrentMoveSounds: 4,
        sameAssetCooldownMs: 50,
        shakeAmplitudeScale: 0.65,
        impactDurationScale: 0.82,
      };

    case "balanced":
      return {
        tier,
        reducedMotion: false,
        pixelRatioCap: 1.5,
        persistentFps: 24,
        particleScale: 0.78,
        maxConcurrentMoveSounds: 6,
        sameAssetCooldownMs: 34,
        shakeAmplitudeScale: 0.85,
        impactDurationScale: 0.92,
      };

    case "high":
    default:
      return {
        tier: "high",
        reducedMotion: false,
        pixelRatioCap: 2,
        persistentFps: 30,
        particleScale: 1,
        maxConcurrentMoveSounds: 8,
        sameAssetCooldownMs: 24,
        shakeAmplitudeScale: 1,
        impactDurationScale: 1,
      };
  }
}

export function getBattleCanvasPixelRatio(): number {
  const profile = getBattleVfxPerformanceProfile();
  return Math.min(
    profile.pixelRatioCap,
    Math.max(1, window.devicePixelRatio || 1),
  );
}
