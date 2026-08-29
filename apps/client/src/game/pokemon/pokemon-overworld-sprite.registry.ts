import { getPokemonFormsBySpecies, type PokemonForm } from "@cesar-mmo/shared";

export const POKEMON_OVERWORLD_DIRECTIONS = ["down", "left", "right", "up"] as const;

export type PokemonOverworldDirection = (typeof POKEMON_OVERWORLD_DIRECTIONS)[number];

export type PokemonOverworldFrame = 1 | 2;

export interface PokemonOverworldSpriteAsset {
  spriteKey: string;
  textureKey: string;
  path: string;
  direction: PokemonOverworldDirection;
  frame: PokemonOverworldFrame;
}

export interface PokemonOverworldDirectionAssets {
  direction: PokemonOverworldDirection;
  frames: readonly [PokemonOverworldSpriteAsset, PokemonOverworldSpriteAsset];
}

const POKEMON_OVERWORLD_BASE_PATH = "/assets/pokemon/overworld/normal";

function validatePokemonIds(speciesId: number, formId: number): void {
  if (!Number.isInteger(speciesId) || speciesId <= 0) {
    throw new Error(
      `Pokémon overworld speciesId must be a positive integer. Received: ${speciesId}`
    );
  }

  if (!Number.isInteger(formId) || formId <= 0) {
    throw new Error(
      `Pokémon overworld formId must be a positive integer. Received: ${formId}`
    );
  }
}

function resolvePokemonForm(speciesId: number, formId: number): PokemonForm {
  const forms = getPokemonFormsBySpecies(speciesId);
  const form = forms.find((candidate) => candidate.formId === formId);
  if (!form) {
    throw new Error(`Pokémon form ${formId} not found for species ${speciesId}`);
  }
  return form;
}

function getPokemonOverworldSpriteKey(form: PokemonForm): string {
  /*
   * First follower version intentionally supports
   * default forms only.
   *
   * Our overworld asset pack does contain some
   * alternate forms, but not every form in the
   * shared Pokémon dataset (notably Megas).
   *
   * We prefer an explicit error over silently
   * displaying the wrong Pokémon.
   */
  if (!form.isDefault) {
    throw new Error(
      `Pokémon overworld sprite is not configured yet for alternate form ${form.name}`
    );
  }

  return String(form.speciesId);
}

export function getPokemonOverworldSpriteAsset(
  speciesId: number,
  formId: number,
  direction: PokemonOverworldDirection,
  frame: PokemonOverworldFrame
): PokemonOverworldSpriteAsset {
  validatePokemonIds(speciesId, formId);

  const form = resolvePokemonForm(speciesId, formId);

  const spriteKey = getPokemonOverworldSpriteKey(form);

  return {
    spriteKey,
    textureKey: `pokemon-overworld-${spriteKey}-${direction}-${frame}`,
    path: `${POKEMON_OVERWORLD_BASE_PATH}/${direction}/frame-${frame}/${spriteKey}.png`,
    direction,
    frame,
  };
}

export function getPokemonOverworldDirectionAssets(
  speciesId: number,
  formId: number,
  direction: PokemonOverworldDirection
): PokemonOverworldDirectionAssets {
  return {
    direction,
    frames: [
      getPokemonOverworldSpriteAsset(speciesId, formId, direction, 1),
      getPokemonOverworldSpriteAsset(speciesId, formId, direction, 2),
    ],
  };
}
