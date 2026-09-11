import {
  calculatePokemonMaxHp,
  createPokemonInstance,
  evaluatePokemonLevelEvolution,
  getPokemonAbilitySet,
  getPokemonDirectEvolutions,
  getPokemonFormsBySpecies,
  isPokemonPureLevelEvolutionDetail,
  planPokemonEvolution,
} from "../packages/shared/dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/*
 * --------------------------------------------------
 * 1. Dynamically discover a real pure-level evolution
 * --------------------------------------------------
 *
 * No hardcoded Bulbasaur / Charmander / Treecko etc.
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

assert(discovered !== null, "Expected at least one pure-level evolution");

console.log("Discovered evolution:", discovered);

/*
 * --------------------------------------------------
 * 2. Obtain authoritative candidate from evaluator
 * --------------------------------------------------
 */
const evaluation = evaluatePokemonLevelEvolution({
  speciesId: discovered.sourceSpeciesId,
  level: discovered.minLevel,
});

assert(
  evaluation.status === "eligible",
  "Expected discovered evolution to be eligible",
);

if (evaluation.status !== "eligible") {
  throw new Error("Expected eligible evolution evaluation");
}

/*
 * --------------------------------------------------
 * 3. Create source Pokémon
 * --------------------------------------------------
 */
const created = createPokemonInstance(
  discovered.sourceSpeciesId,
  discovered.minLevel,
);

const sourceMaxHp = calculatePokemonMaxHp(created);

const pokemon = {
  ...created,

  nickname: "Evolution Smoke",

  currentHp: Math.max(1, sourceMaxHp - 5),

  moves: created.moves.map((move) => ({
    ...move,
  })),
};

const beforeSnapshot = JSON.stringify(pokemon);

const originalMovesSnapshot = JSON.stringify(pokemon.moves);

/*
 * --------------------------------------------------
 * 4. Plan evolution
 * --------------------------------------------------
 */
const plan = planPokemonEvolution({
  pokemon,
  candidate: evaluation.candidate,
});

const evolved = plan.evolvedPokemonState;

/*
 * --------------------------------------------------
 * 5. Identity preservation
 * --------------------------------------------------
 */
assert(
  evolved.instanceId === pokemon.instanceId,
  "Evolution must preserve Pokemon instanceId",
);

assert(
  evolved.nickname === pokemon.nickname,
  "Evolution must preserve nickname",
);

assert(evolved.level === pokemon.level, "Evolution must preserve level");

assert(
  evolved.experience === pokemon.experience,
  "Evolution must preserve experience",
);

assert(
  JSON.stringify(evolved.moves) === originalMovesSnapshot,
  "Evolution must preserve moves",
);

assert(evolved.moves !== pokemon.moves, "Evolution must clone moves array");

/*
 * --------------------------------------------------
 * 6. Species / Form transformation
 * --------------------------------------------------
 */
assert(
  evolved.speciesId === discovered.targetSpeciesId,
  "Evolution must use target species",
);

const targetForms = getPokemonFormsBySpecies(discovered.targetSpeciesId);

const targetForm = targetForms.find((form) => form.formId === evolved.formId);

assert(targetForm !== undefined, "Evolution target form must exist");

assert(targetForm.isDefault, "Evolution target form must be default");

assert(
  targetForm.isMega === false,
  "Evolution must not automatically select Mega form",
);

assert(
  targetForm.isBattleOnly === false,
  "Evolution must not automatically select battle-only form",
);

/*
 * --------------------------------------------------
 * 7. Ability slot preservation
 * --------------------------------------------------
 */
const sourceAbilitySet = getPokemonAbilitySet(discovered.sourceSpeciesId);

const targetAbilitySet = getPokemonAbilitySet(discovered.targetSpeciesId);

assert(sourceAbilitySet !== undefined, "Source AbilitySet not found");

assert(targetAbilitySet !== undefined, "Target AbilitySet not found");

const sourceAbility = sourceAbilitySet.abilities.find(
  (entry) => entry.abilityId === pokemon.abilityId,
);

assert(sourceAbility !== undefined, "Source ability not found");

const targetAbility = targetAbilitySet.abilities.find(
  (entry) => entry.slot === sourceAbility.slot,
);

assert(targetAbility !== undefined, "Target ability with same slot not found");

assert(
  evolved.abilityId === targetAbility.abilityId,
  "Evolution must preserve logical ability slot",
);

/*
 * --------------------------------------------------
 * 8. Missing HP preservation
 * --------------------------------------------------
 */
const targetMaxHp = calculatePokemonMaxHp(evolved);

const missingHpBefore = sourceMaxHp - pokemon.currentHp;

const missingHpAfter = targetMaxHp - evolved.currentHp;

assert(
  missingHpAfter === missingHpBefore,
  [
    "Evolution must preserve missing HP.",
    `Before=${missingHpBefore}`,
    `After=${missingHpAfter}`,
  ].join(" "),
);

/*
 * --------------------------------------------------
 * 9. Fainted Pokémon stays fainted
 * --------------------------------------------------
 */
const faintedPlan = planPokemonEvolution({
  pokemon: {
    ...pokemon,
    currentHp: 0,
  },

  candidate: evaluation.candidate,
});

assert(
  faintedPlan.evolvedPokemonState.currentHp === 0,
  "Evolution must not revive a fainted Pokémon",
);

/*
 * --------------------------------------------------
 * 10. Planner must be pure
 * --------------------------------------------------
 */
assert(
  JSON.stringify(pokemon) === beforeSnapshot,
  "Evolution planner mutated source Pokémon",
);

console.log("");
console.log("POKÉMON EVOLUTION PLAN SMOKE ✅");

console.log({
  instanceId: evolved.instanceId,

  species: {
    from: plan.sourceSpeciesId,
    to: plan.targetSpeciesId,
  },

  form: {
    from: plan.sourceFormId,
    to: plan.targetFormId,
  },

  ability: plan.ability,

  hp: plan.hp,
});
