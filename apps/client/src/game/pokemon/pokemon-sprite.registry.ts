import { getPokemonFormsBySpecies, type PokemonForm } from "@cesar-mmo/shared";

export interface PokemonSpriteAsset {
  textureKey: string;
  path: string;
}

const POKEMON_PARTY_ICON_BASE_PATH = "/assets/pokemon/icons/party/current";

/**
 * Allows us to handle exceptional cases where the asset filename
 * does not follow the regular speciesId + formName convention.
 *
 * Example future entry:
 * "479:some-form" -> "479-custom-name"
 */
const POKEMON_PARTY_ICON_KEY_OVERRIDES = new Map<string, string>();

function createFormOverrideKey(speciesId: number, formName: string): string {
  return `${speciesId}:${formName}`;
}

function validatePokemonSpriteIds(speciesId: number, formId: number): void {
  if (!Number.isInteger(speciesId) || speciesId <= 0) {
    throw new Error(
      `Pokémon sprite speciesId must be a positive integer. Received: ${speciesId}`
    );
  }

  if (!Number.isInteger(formId) || formId <= 0) {
    throw new Error(
      `Pokémon sprite formId must be a positive integer. Received: ${formId}`
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

function getPokemonPartyIconSpriteKey(form: PokemonForm): string {
  const formName = form.formName.trim();

  const overrideKey = createFormOverrideKey(form.speciesId, formName);

  const override = POKEMON_PARTY_ICON_KEY_OVERRIDES.get(overrideKey);

  if (override) {
    return override;
  }

  if (formName.length === 0) {
    return String(form.speciesId);
  }

  return `${form.speciesId}-${formName}`;
}

export function getPokemonSpriteAsset(
  speciesId: number,
  formId: number
): PokemonSpriteAsset {
  validatePokemonSpriteIds(speciesId, formId);

  const form = resolvePokemonForm(speciesId, formId);

  const spriteKey = getPokemonPartyIconSpriteKey(form);

  return {
    textureKey: `pokemon-party-icon-${spriteKey}`,
    path: `${POKEMON_PARTY_ICON_BASE_PATH}/${spriteKey}.png`,
  };
}
