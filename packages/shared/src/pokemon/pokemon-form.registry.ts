import formsData from "./data/forms.json" with { type: "json" };
import type { PokemonForm, PokemonType } from "./pokemon.types.js";

const POKEMON_FORMS: PokemonForm[] = formsData.map((form) => ({
  formId: form.formId,
  pokemonId: form.pokemonId,
  speciesId: form.speciesId,

  name: form.name,
  formName: form.formName,

  isDefault: form.isDefault,
  isMega: form.isMega,
  isBattleOnly: form.isBattleOnly,

  types: form.types as PokemonType[],

  baseStats: {
    hp: form.baseStats.hp,
    attack: form.baseStats.attack,
    defense: form.baseStats.defense,
    specialAttack: form.baseStats.specialAttack,
    specialDefense: form.baseStats.specialDefense,
    speed: form.baseStats.speed,
  },

  height: form.height,
  weight: form.weight,
}));

const POKEMON_FORMS_BY_FORM_ID = new Map<number, PokemonForm>(
  POKEMON_FORMS.map((form) => [form.formId, form])
);

const POKEMON_FORMS_BY_SPECIES_ID = new Map<number, PokemonForm[]>();

for (const form of POKEMON_FORMS) {
  const speciesForms = POKEMON_FORMS_BY_SPECIES_ID.get(form.speciesId);

  if (speciesForms) {
    speciesForms.push(form);
  } else {
    POKEMON_FORMS_BY_SPECIES_ID.set(form.speciesId, [form]);
  }
}

export function getPokemonForm(formId: number): PokemonForm | undefined {
  return POKEMON_FORMS_BY_FORM_ID.get(formId);
}
export function getPokemonFormsBySpecies(speciesId: number): PokemonForm[] {
  return POKEMON_FORMS_BY_SPECIES_ID.get(speciesId) ?? [];
}

export function getAllPokemonForms(): PokemonForm[] {
  return POKEMON_FORMS;
}

export function getPokemonFormCount(): number {
  return POKEMON_FORMS.length;
}
