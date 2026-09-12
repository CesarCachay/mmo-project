export const POKEMON_EVOLUTION_ANIMATION_TIMING = {
  introMessageMs: 700,

  initialSourceHoldMs: 250,

  swapTimingsMs: [
    500, 475, 450, 425, 400, 375, 350, 325, 300, 275, 250, 225, 200, 175, 150,
    125,
  ] as const,

  finalFlashInMs: 190,
  finalFlashOutMs: 260,
  finalTargetRevealMs: 700,

  postRevealHoldMs: 180,

  congratulationsMessageMs: 1500,

  finalHoldMs: 180,
} as const;
