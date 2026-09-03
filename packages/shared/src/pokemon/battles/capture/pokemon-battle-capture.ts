export type PokemonCaptureRandomSource = () => number;

export interface ResolvePokemonCaptureInput {
  readonly currentHp: number;
  readonly maxHp: number;
  readonly captureRate: number;
  readonly ballModifier: number;
}

export interface PokemonCaptureResolution {
  readonly captured: boolean;

  /**
   * Number of successful shake checks.
   *
   * 0..3 = Pokémon escaped.
   * 4    = captured.
   */
  readonly shakeCount: number;

  /**
   * Modified catch value after HP/rate/ball calculation.
   * Useful for deterministic tests and server diagnostics.
   */
  readonly modifiedCatchRate: number;
}

const MAX_CAPTURE_RATE = 255;
const SHAKE_CHECK_COUNT = 4;

export function resolvePokemonCapture(
  input: ResolvePokemonCaptureInput,
  random: PokemonCaptureRandomSource = Math.random
): PokemonCaptureResolution {
  assertValidCaptureInput(input);

  const modifiedCatchRate = Math.floor(
    ((3 * input.maxHp - 2 * input.currentHp) * input.captureRate * input.ballModifier) /
      (3 * input.maxHp)
  );

  /*
   * Gen III/IV style behavior:
   * sufficiently high modified catch value → guaranteed capture.
   */
  if (modifiedCatchRate >= MAX_CAPTURE_RATE) {
    return {
      captured: true,
      shakeCount: SHAKE_CHECK_COUNT,
      modifiedCatchRate,
    };
  }

  if (modifiedCatchRate <= 0) {
    return {
      captured: false,
      shakeCount: 0,
      modifiedCatchRate,
    };
  }

  /*
   * Gen III/IV-inspired shake threshold.
   * Each shake performs an independent 16-bit RNG check.
   */
  const shakeThreshold = Math.floor(
    1_048_560 / Math.sqrt(Math.sqrt(16_711_680 / modifiedCatchRate))
  );

  let shakeCount = 0;

  for (let shake = 0; shake < SHAKE_CHECK_COUNT; shake += 1) {
    const randomValue = random();

    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new Error(
        `Capture RNG must return a finite number in [0, 1). Received: ${randomValue}`
      );
    }

    const roll = Math.floor(randomValue * 65_536);

    if (roll >= shakeThreshold) {
      return {
        captured: false,
        shakeCount,
        modifiedCatchRate,
      };
    }

    shakeCount += 1;
  }

  return {
    captured: true,
    shakeCount,
    modifiedCatchRate,
  };
}

function assertValidCaptureInput(input: ResolvePokemonCaptureInput): void {
  if (!Number.isInteger(input.maxHp) || input.maxHp <= 0) {
    throw new Error(`Capture maxHp must be a positive integer. Received: ${input.maxHp}`);
  }

  if (
    !Number.isInteger(input.currentHp) ||
    input.currentHp <= 0 ||
    input.currentHp > input.maxHp
  ) {
    throw new Error(
      `Capture currentHp must be between 1 and maxHp. Received: ${input.currentHp}/${input.maxHp}`
    );
  }

  if (
    !Number.isInteger(input.captureRate) ||
    input.captureRate < 0 ||
    input.captureRate > MAX_CAPTURE_RATE
  ) {
    throw new Error(
      `Capture rate must be an integer between 0 and 255. Received: ${input.captureRate}`
    );
  }

  if (!Number.isFinite(input.ballModifier) || input.ballModifier <= 0) {
    throw new Error(
      `Ball modifier must be greater than 0. Received: ${input.ballModifier}`
    );
  }
}
