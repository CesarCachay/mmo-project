import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = resolve(__dirname, "../packages/shared/src/pokemon/data");

async function readJsonFile(fileName) {
  const path = resolve(DATA_DIR, fileName);
  const content = await readFile(path, "utf8");

  return JSON.parse(content);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUniqueIds(items, getId, label) {
  const seen = new Set();

  for (const item of items) {
    const id = getId(item);

    assert(!seen.has(id), `${label} contains duplicate id ${id}`);

    seen.add(id);
  }
}

async function main() {
  console.log("Validating Pokémon data...");

  const [species, evolutionChains, moves, learnsets, abilities, pokemonAbilities, forms] =
    await Promise.all([
      readJsonFile("species.json"),
      readJsonFile("evolution-chains.json"),
      readJsonFile("moves.json"),
      readJsonFile("learnsets.json"),
      readJsonFile("abilities.json"),
      readJsonFile("pokemon-abilities.json"),
      readJsonFile("forms.json"),
    ]);

  // --------------------------------------------------
  // Indexes
  // --------------------------------------------------

  const speciesIds = new Set(species.map((pokemon) => pokemon.id));

  const moveIds = new Set(moves.map((move) => move.id));

  const abilityIds = new Set(abilities.map((ability) => ability.id));

  // --------------------------------------------------
  // Expected counts
  // --------------------------------------------------

  assert(species.length === 493, `Expected 493 Pokémon species, got ${species.length}`);

  assert(learnsets.length === 493, `Expected 493 learnsets, got ${learnsets.length}`);

  assert(
    pokemonAbilities.length === 493,
    `Expected 493 Pokémon ability sets, got ${pokemonAbilities.length}`
  );

  // --------------------------------------------------
  // Unique IDs
  // --------------------------------------------------

  assertUniqueIds(species, (pokemon) => pokemon.id, "Species");

  assertUniqueIds(moves, (move) => move.id, "Moves");

  assertUniqueIds(abilities, (ability) => ability.id, "Abilities");

  assertUniqueIds(evolutionChains, (chain) => chain.id, "Evolution chains");

  assertUniqueIds(forms, (form) => form.formId, "Forms");

  // --------------------------------------------------
  // Learnsets
  // --------------------------------------------------

  for (const learnset of learnsets) {
    assert(
      speciesIds.has(learnset.speciesId),
      `Learnset references unknown speciesId ${learnset.speciesId}`
    );

    for (const move of learnset.levelUpMoves) {
      assert(
        moveIds.has(move.moveId),
        `Species ${learnset.speciesId} references unknown moveId ${move.moveId}`
      );
    }
  }

  // --------------------------------------------------
  // Abilities
  // --------------------------------------------------

  for (const pokemonAbilitySet of pokemonAbilities) {
    assert(
      speciesIds.has(pokemonAbilitySet.speciesId),
      `Ability set references unknown speciesId ${pokemonAbilitySet.speciesId}`
    );

    for (const ability of pokemonAbilitySet.abilities) {
      assert(
        abilityIds.has(ability.abilityId),
        `Species ${pokemonAbilitySet.speciesId} references unknown abilityId ${ability.abilityId}`
      );
    }
  }

  // --------------------------------------------------
  // Forms
  // --------------------------------------------------

  const formsBySpeciesId = new Map();

  for (const form of forms) {
    assert(
      speciesIds.has(form.speciesId),
      `Form ${form.name} references unknown speciesId ${form.speciesId}`
    );

    const speciesForms = formsBySpeciesId.get(form.speciesId) ?? [];

    speciesForms.push(form);

    formsBySpeciesId.set(form.speciesId, speciesForms);
  }

  for (const pokemon of species) {
    const pokemonForms = formsBySpeciesId.get(pokemon.id) ?? [];

    assert(
      pokemonForms.length > 0,
      `Species ${pokemon.id} (${pokemon.name}) has no forms`
    );

    const defaultForms = pokemonForms.filter((form) => form.isDefault);

    assert(
      defaultForms.length >= 1,
      `Species ${pokemon.id} (${pokemon.name}) has no default form`
    );

    const baseForm = pokemonForms.find(
      (form) => form.speciesId === pokemon.id && form.pokemonId === pokemon.id
    );

    assert(
      baseForm !== undefined,
      `Species ${pokemon.id} (${pokemon.name}) has no base form with pokemonId ${pokemon.id}`
    );
  }

  // --------------------------------------------------
  // Mega forms
  // --------------------------------------------------

  const megaForms = forms.filter((form) => form.isMega);

  for (const form of megaForms) {
    assert(form.isDefault === false, `Mega form ${form.name} cannot be default`);

    assert(form.isBattleOnly === true, `Mega form ${form.name} should be battle-only`);
  }

  // --------------------------------------------------
  // Evolution chains
  // --------------------------------------------------

  function validateEvolutionNode(node, chainId) {
    assert(
      speciesIds.has(node.speciesId),
      `Evolution chain ${chainId} references unknown speciesId ${node.speciesId}`
    );

    for (const child of node.evolvesTo) {
      validateEvolutionNode(child, chainId);
    }
  }

  for (const chain of evolutionChains) {
    validateEvolutionNode(chain.root, chain.id);
  }

  // --------------------------------------------------
  // Success
  // --------------------------------------------------

  console.log("");
  console.log("Pokémon data validation passed.");
  console.log(`Species: ${species.length}`);
  console.log(`Evolution chains: ${evolutionChains.length}`);
  console.log(`Moves: ${moves.length}`);
  console.log(`Learnsets: ${learnsets.length}`);
  console.log(`Abilities: ${abilities.length}`);
  console.log(`Ability sets: ${pokemonAbilities.length}`);
  console.log(`Forms: ${forms.length}`);
  console.log(`Mega forms: ${megaForms.length}`);
}

main().catch((error) => {
  console.error("");
  console.error("Pokémon data validation failed.");
  console.error(error);
  process.exitCode = 1;
});
