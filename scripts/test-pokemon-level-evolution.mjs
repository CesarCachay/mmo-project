import {
  evaluatePokemonLevelEvolution,
  getPokemonDirectEvolutions,
  isPokemonPureLevelEvolutionDetail,
} from "../packages/shared/dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/*
 * Discover a real level-only evolution dynamically.
 * No species-specific hardcode.
 */
let discovered = null;

for (let speciesId = 1; speciesId <= 493; speciesId += 1) {
  const targets = getPokemonDirectEvolutions(speciesId);

  for (const target of targets) {
    const detail = target.evolutionDetails.find(
      isPokemonPureLevelEvolutionDetail,
    );

    if (detail && detail.minLevel > 1) {
      discovered = {
        sourceSpeciesId: speciesId,
        targetSpeciesId: target.speciesId,
        minLevel: detail.minLevel,
      };

      break;
    }
  }

  if (discovered) {
    break;
  }
}

assert(
  discovered !== null,
  "Expected at least one pure level evolution in the dataset",
);

const beforeThreshold = evaluatePokemonLevelEvolution({
  speciesId: discovered.sourceSpeciesId,
  level: discovered.minLevel - 1,
});

assert(
  beforeThreshold.status === "not-eligible",
  "Pokémon must not evolve before its minimum level",
);

const atThreshold = evaluatePokemonLevelEvolution({
  speciesId: discovered.sourceSpeciesId,
  level: discovered.minLevel,
});

assert(
  atThreshold.status === "eligible",
  "Pokémon must evolve at its minimum level",
);

if (atThreshold.status !== "eligible") {
  throw new Error("Expected eligible evolution");
}

assert(
  atThreshold.candidate.targetSpeciesId === discovered.targetSpeciesId,
  "Evolution target species does not match registry data",
);

const aboveThreshold = evaluatePokemonLevelEvolution({
  speciesId: discovered.sourceSpeciesId,
  level: Math.min(100, discovered.minLevel + 1),
});

assert(
  aboveThreshold.status === "eligible",
  "Pokémon must remain eligible above its minimum level",
);

console.log("POKÉMON LEVEL EVOLUTION SMOKE ✅");
console.log(discovered);
console.log(atThreshold);
