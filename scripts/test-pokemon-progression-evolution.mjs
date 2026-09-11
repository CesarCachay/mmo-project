import {
  createPokemonInstance,
  getExperienceForLevel,
  getPokemonDirectEvolutions,
  getPokemonSpecies,
  isPokemonPureLevelEvolutionDetail,
  planPokemonProgression,
} from "../packages/shared/dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

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

assert(discovered !== null, "No pure level evolution found");

const species = getPokemonSpecies(discovered.sourceSpeciesId);

assert(species !== undefined, "Source species not found");

const initialLevel = discovered.minLevel - 1;

const pokemon = createPokemonInstance(discovered.sourceSpeciesId, initialLevel);

const targetExperience = getExperienceForLevel(
  species.growthRate,
  discovered.minLevel,
);

const gainedExperience = targetExperience - pokemon.experience;

assert(gainedExperience > 0, "Expected positive EXP gain");

const plan = planPokemonProgression({
  pokemon,
  growthRate: species.growthRate,
  gainedExperience,
});

assert(
  plan.experience.currentLevel === discovered.minLevel,
  "Expected Pokémon to reach evolution level",
);

assert(
  plan.evolution.evaluation.status === "eligible",
  "Expected eligible Evolution",
);

assert(
  plan.evolution.deferredByMoveLearning === false,
  "Unexpected Move Learning deferral",
);

assert(plan.evolution.plan !== null, "Expected Evolution plan");

assert(
  plan.automaticPokemonState.instanceId === pokemon.instanceId,
  "Evolution changed instanceId",
);

assert(
  plan.automaticPokemonState.speciesId === discovered.targetSpeciesId,
  "automaticPokemonState did not evolve",
);

assert(
  plan.automaticPokemonState.level === discovered.minLevel,
  "Evolution changed final level",
);

assert(
  plan.automaticPokemonState.experience === targetExperience,
  "Evolution changed final EXP",
);

console.log("");
console.log("POKÉMON PROGRESSION + EVOLUTION SMOKE ✅");

console.log({
  sourceSpeciesId: discovered.sourceSpeciesId,

  targetSpeciesId: plan.automaticPokemonState.speciesId,

  level: plan.automaticPokemonState.level,

  evolution: plan.evolution,
});
