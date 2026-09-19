export interface PokemonTrainerBattleStartInput {
  readonly npcId: string;
}

export function isPokemonTrainerBattleStartInput(
  value: unknown,
): value is PokemonTrainerBattleStartInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.npcId === "string" &&
    candidate.npcId.trim().length > 0 &&
    candidate.npcId.length <= 64
  );
}
