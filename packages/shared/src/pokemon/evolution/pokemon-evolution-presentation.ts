export interface PokemonEvolutionPresentation {
  readonly pokemonInstanceId: string;

  readonly previousSpeciesId: number;
  readonly previousFormId: number;

  readonly currentSpeciesId: number;
  readonly currentFormId: number;
}

export function isPokemonEvolutionPresentation(
  value: unknown,
): value is PokemonEvolutionPresentation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    !isNonEmptyString(candidate.pokemonInstanceId) ||
    !isPositiveInteger(candidate.previousSpeciesId) ||
    !isPositiveInteger(candidate.previousFormId) ||
    !isPositiveInteger(candidate.currentSpeciesId) ||
    !isPositiveInteger(candidate.currentFormId)
  ) {
    return false;
  }

  /*
   * Normal Evolution V1 changes species.
   *
   * Form-only transformations such as Mega Evolution
   * are deliberately outside this milestone.
   */
  return candidate.previousSpeciesId !== candidate.currentSpeciesId;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}
