import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const POKE_API_BASE_URL = "https://pokeapi.co/api/v2";
const MAX_POKEMON_ID = 493;

const OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/pokemon/data/species.json"
);
const EVOLUTION_CHAINS_OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/pokemon/data/evolution-chains.json"
);
const MOVES_OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/pokemon/data/moves.json"
);
const LEARNSETS_OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/pokemon/data/learnsets.json"
);
const ABILITIES_OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/pokemon/data/abilities.json"
);
const POKEMON_ABILITIES_OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/pokemon/data/pokemon-abilities.json"
);
const FORMS_OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/pokemon/data/forms.json"
);

const LEARNSET_VERSION_GROUP = "heartgold-soulsilver";
const IMPORT_SPECIES_ONLY = process.argv.includes("--species-only");

// generic helpers
function getIdFromUrl(url) {
  if (!url) {
    return null;
  }

  const parts = url.split("/").filter(Boolean);
  const id = Number(parts.at(-1));

  if (!Number.isInteger(id)) {
    throw new Error(`Could not extract id from URL: ${url}`);
  }

  return id;
}

// pokemon helpers
async function fetchPokemon(id) {
  const response = await fetch(`${POKE_API_BASE_URL}/pokemon/${id}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Pokémon ${id}: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

function getStat(pokemon, statName) {
  const stat = pokemon.stats.find((entry) => entry.stat.name === statName);
  if (!stat) {
    throw new Error(`Missing stat "${statName}" for Pokémon ${pokemon.name}`);
  }
  return stat.base_stat;
}

async function fetchPokemonSpecies(id) {
  const response = await fetch(`${POKE_API_BASE_URL}/pokemon-species/${id}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Pokémon species ${id}: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

function normalizePokemon(pokemon, species) {
  return {
    id: pokemon.id,
    name: pokemon.name,
    types: pokemon.types.sort((a, b) => a.slot - b.slot).map((entry) => entry.type.name),
    baseStats: {
      hp: getStat(pokemon, "hp"),
      attack: getStat(pokemon, "attack"),
      defense: getStat(pokemon, "defense"),
      specialAttack: getStat(pokemon, "special-attack"),
      specialDefense: getStat(pokemon, "special-defense"),
      speed: getStat(pokemon, "speed"),
    },

    height: pokemon.height,
    weight: pokemon.weight,
    baseExperience: pokemon.base_experience,

    captureRate: species.capture_rate,

    generation: getIdFromUrl(species.generation.url),
    evolutionChainId: getIdFromUrl(species.evolution_chain?.url),
  };
}

// evolution helpers
async function fetchEvolutionChain(id) {
  const response = await fetch(`${POKE_API_BASE_URL}/evolution-chain/${id}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch evolution chain ${id}: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

function normalizeEvolutionNode(chainNode) {
  return {
    speciesId: getIdFromUrl(chainNode.species.url),
    evolvesTo: chainNode.evolves_to
      .filter((node) => {
        const speciesId = getIdFromUrl(node.species.url);
        return speciesId !== null && speciesId <= MAX_POKEMON_ID;
      })
      .map((node) => normalizeEvolutionNode(node)),
  };
}
function normalizeEvolutionChain(chain) {
  return {
    id: chain.id,
    root: normalizeEvolutionNode(chain.chain),
  };
}

// moves helpers
async function fetchMove(id) {
  const response = await fetch(`${POKE_API_BASE_URL}/move/${id}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch move ${id}: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

function normalizeMove(move) {
  return {
    id: move.id,
    name: move.name,
    type: move.type.name,
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    priority: move.priority,
    damageClass: move.damage_class.name,
  };
}

async function fetchMoveList() {
  const response = await fetch(`${POKE_API_BASE_URL}/move?limit=10000`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch move list: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

// level up helpers
function normalizeLevelUpLearnset(pokemon) {
  const levelUpMoves = [];

  for (const moveEntry of pokemon.moves) {
    for (const detail of moveEntry.version_group_details) {
      if (
        detail.version_group.name !== LEARNSET_VERSION_GROUP ||
        detail.move_learn_method.name !== "level-up"
      ) {
        continue;
      }

      const moveId = getIdFromUrl(moveEntry.move.url);

      if (moveId === null) {
        continue;
      }

      levelUpMoves.push({
        moveId,
        level: detail.level_learned_at,
      });
    }
  }

  levelUpMoves.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }

    return a.moveId - b.moveId;
  });

  return {
    speciesId: pokemon.id,
    levelUpMoves,
  };
}

// pokemon abilities
function normalizePokemonAbilities(pokemon) {
  return {
    speciesId: pokemon.id,
    abilities: pokemon.abilities.map((entry) => ({
      abilityId: getIdFromUrl(entry.ability.url),
      slot: entry.slot,
      isHidden: entry.is_hidden,
    })),
  };
}

async function fetchAbility(id) {
  const response = await fetch(`${POKE_API_BASE_URL}/ability/${id}`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ability ${id}: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function normalizeAbility(ability) {
  return {
    id: ability.id,
    name: ability.name,
  };
}

// megas helpers
async function fetchPokemonByUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Pokémon variety: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function fetchPokemonFormByUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Pokémon form: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function normalizePokemonForm(speciesId, pokemon, form, isDefault) {
  return {
    formId: form.id,
    pokemonId: pokemon.id,
    speciesId,

    name: pokemon.name,
    formName: form.form_name,

    isDefault,
    isMega: form.is_mega,
    isBattleOnly: form.is_battle_only,

    types: pokemon.types.sort((a, b) => a.slot - b.slot).map((entry) => entry.type.name),

    baseStats: {
      hp: getStat(pokemon, "hp"),
      attack: getStat(pokemon, "attack"),
      defense: getStat(pokemon, "defense"),
      specialAttack: getStat(pokemon, "special-attack"),
      specialDefense: getStat(pokemon, "special-defense"),
      speed: getStat(pokemon, "speed"),
    },

    height: pokemon.height,
    weight: pokemon.weight,
  };
}

async function importPokemonForms(speciesId, pokemonSpecies) {
  const forms = [];

  for (const variety of pokemonSpecies.varieties) {
    const pokemon = await fetchPokemonByUrl(variety.pokemon.url);
    for (const formEntry of pokemon.forms) {
      const form = await fetchPokemonFormByUrl(formEntry.url);
      forms.push(normalizePokemonForm(speciesId, pokemon, form, variety.is_default));
    }
  }

  return forms;
}

// MAIN
async function main() {
  console.log(`Importing Pokémon #001 - #${MAX_POKEMON_ID} from PokéAPI...`);

  const species = [];
  const learnsets = [];
  const pokemonAbilities = [];
  const forms = [];

  for (let id = 1; id <= MAX_POKEMON_ID; id += 1) {
    const pokemon = await fetchPokemon(id);
    const pokemonSpecies = await fetchPokemonSpecies(id);

    species.push(normalizePokemon(pokemon, pokemonSpecies));

    if (!IMPORT_SPECIES_ONLY) {
      learnsets.push(normalizeLevelUpLearnset(pokemon));
      pokemonAbilities.push(normalizePokemonAbilities(pokemon));

      const pokemonForms = await importPokemonForms(id, pokemonSpecies);
      forms.push(...pokemonForms);
    }

    console.log(`[${String(id).padStart(3, "0")}/${MAX_POKEMON_ID}] ${pokemon.name}`);
  }

  if (IMPORT_SPECIES_ONLY) {
    await mkdir(dirname(OUTPUT_PATH), {
      recursive: true,
    });

    await writeFile(OUTPUT_PATH, `${JSON.stringify(species, null, 2)}\n`, "utf8");

    console.log("");
    console.log(`Imported ${species.length} Pokémon species.`);
    console.log(`Output: ${OUTPUT_PATH}`);

    return;
  }

  const evolutionChainIds = [
    ...new Set(
      species.map((pokemon) => pokemon.evolutionChainId).filter((id) => id !== null)
    ),
  ];

  const abilityIds = [
    ...new Set(
      pokemonAbilities.flatMap((entry) =>
        entry.abilities.map((ability) => ability.abilityId)
      )
    ),
  ];

  const evolutionChains = [];

  for (const evolutionChainId of evolutionChainIds) {
    const chain = await fetchEvolutionChain(evolutionChainId);
    evolutionChains.push(normalizeEvolutionChain(chain));
    console.log(`Evolution chain ${evolutionChainId} imported`);
  }

  console.log("");
  console.log("Importing moves from generations I - IV...");

  const moveList = await fetchMoveList();
  const moves = [];

  for (const moveEntry of moveList.results) {
    const moveId = getIdFromUrl(moveEntry.url);

    if (moveId === null) {
      continue;
    }

    const move = await fetchMove(moveId);

    const generation = getIdFromUrl(move.generation.url);

    if (generation === null || generation > 4) {
      continue;
    }

    moves.push(normalizeMove(move));

    console.log(`[Move ${move.id}] ${move.name}`);
  }

  console.log("");
  console.log("Importing abilities...");

  const abilities = [];

  for (const abilityId of abilityIds) {
    const ability = await fetchAbility(abilityId);
    abilities.push(normalizeAbility(ability));
    console.log(`[Ability ${ability.id}] ${ability.name}`);
  }

  await mkdir(dirname(OUTPUT_PATH), {
    recursive: true,
  });

  // write species file
  await writeFile(OUTPUT_PATH, `${JSON.stringify(species, null, 2)}\n`, "utf8");

  // write evolutions file
  await writeFile(
    EVOLUTION_CHAINS_OUTPUT_PATH,
    `${JSON.stringify(evolutionChains, null, 2)}\n`,
    "utf8"
  );

  // write moves file
  await writeFile(MOVES_OUTPUT_PATH, `${JSON.stringify(moves, null, 2)}\n`, "utf8");

  // write learn sets file
  await writeFile(
    LEARNSETS_OUTPUT_PATH,
    `${JSON.stringify(learnsets, null, 2)}\n`,
    "utf8"
  );

  // write abilities file
  await writeFile(
    ABILITIES_OUTPUT_PATH,
    `${JSON.stringify(abilities, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    POKEMON_ABILITIES_OUTPUT_PATH,
    `${JSON.stringify(pokemonAbilities, null, 2)}\n`,
    "utf8"
  );

  // write mega forms file
  await writeFile(FORMS_OUTPUT_PATH, `${JSON.stringify(forms, null, 2)}\n`, "utf8");

  console.log("");
  console.log(`Imported ${species.length} Pokémon.`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log("");
  console.log(`Imported ${evolutionChains.length} evolution chains.`);
  console.log(`Output: ${EVOLUTION_CHAINS_OUTPUT_PATH}`);
  console.log("");
  console.log(`Imported ${moves.length} moves from generations I - IV.`);
  console.log(`Output: ${MOVES_OUTPUT_PATH}`);
  console.log("");
  console.log(`Imported ${abilities.length} abilities.`);
  console.log(`Output: ${ABILITIES_OUTPUT_PATH}`);
  console.log("");
  console.log(`Imported ${pokemonAbilities.length} Pokémon ability sets.`);
  console.log(`Output: ${POKEMON_ABILITIES_OUTPUT_PATH}`);
  console.log("");
  console.log(`Imported ${forms.length} Pokémon forms.`);
  console.log(`Output: ${FORMS_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
