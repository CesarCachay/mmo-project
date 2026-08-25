import assert from "node:assert/strict";

import {
  createPokemonInstance,
  getPokemonSpecies,
  getPokemonFormsBySpecies,
  getPokemonAbilitySet,
  getPokemonLearnset,
  getPokemonMove,
} from "@cesar-mmo/shared";

function validatePokemonInstance(speciesId, level) {
  console.log("");
  console.log(`Testing Pokémon instance: species=${speciesId}, level=${level}`);

  const instance = createPokemonInstance(speciesId, level);

  const species = getPokemonSpecies(speciesId);

  assert.ok(species, `Species ${speciesId} should exist`);

  console.log(`Species: ${species.name}`);

  // --------------------------------------------------
  // Basic instance data
  // --------------------------------------------------

  assert.equal(
    instance.speciesId,
    speciesId,
    "Instance speciesId should match requested speciesId"
  );

  assert.equal(instance.level, level, "Instance level should match requested level");

  assert.equal(instance.experience, 0, "New Pokémon should start with 0 experience");

  assert.equal(typeof instance.instanceId, "string", "instanceId should be a string");

  assert.ok(instance.instanceId.length > 0, "instanceId should not be empty");

  // --------------------------------------------------
  // Default form
  // --------------------------------------------------

  const forms = getPokemonFormsBySpecies(speciesId);

  const defaultForm = forms.find((form) => form.isDefault);

  assert.ok(defaultForm, `Species ${speciesId} should have a default form`);

  assert.equal(
    instance.formId,
    defaultForm.formId,
    "Instance should use the default form"
  );

  // --------------------------------------------------
  // HP
  // --------------------------------------------------

  assert.ok(Number.isInteger(instance.currentHp), "currentHp should be an integer");

  assert.ok(instance.currentHp > 0, "currentHp should be greater than 0");

  // --------------------------------------------------
  // Ability
  // --------------------------------------------------

  const abilitySet = getPokemonAbilitySet(speciesId);

  assert.ok(abilitySet, `Species ${speciesId} should have an ability set`);

  const expectedAbility = [...abilitySet.abilities]
    .sort((a, b) => a.slot - b.slot)
    .find((ability) => !ability.isHidden);

  assert.ok(expectedAbility, `Species ${speciesId} should have a standard ability`);

  assert.equal(
    instance.abilityId,
    expectedAbility.abilityId,
    "Instance should use the first non-hidden ability by slot"
  );

  // --------------------------------------------------
  // Moves
  // --------------------------------------------------

  assert.ok(instance.moves.length <= 4, "Pokémon instance should have at most 4 moves");

  const moveIds = instance.moves.map((move) => move.moveId);

  assert.equal(
    new Set(moveIds).size,
    moveIds.length,
    "Pokémon instance should not contain duplicate moves"
  );

  const learnset = getPokemonLearnset(speciesId);

  assert.ok(learnset, `Species ${speciesId} should have a learnset`);

  const availableMoveIds = new Set(
    learnset.levelUpMoves
      .filter((entry) => entry.level <= level)
      .map((entry) => entry.moveId)
  );

  for (const instanceMove of instance.moves) {
    assert.ok(
      availableMoveIds.has(instanceMove.moveId),
      `Move ${instanceMove.moveId} should be learnable by level ${level}`
    );

    const move = getPokemonMove(instanceMove.moveId);

    assert.ok(move, `Move ${instanceMove.moveId} should exist in Move Registry`);

    assert.equal(
      instanceMove.currentPp,
      move.pp ?? 0,
      `Move ${move.name} should start with its base PP`
    );
  }

  // --------------------------------------------------
  // Result
  // --------------------------------------------------

  console.log("Instance:");
  console.log(instance);

  console.log("Moves:");

  for (const instanceMove of instance.moves) {
    const move = getPokemonMove(instanceMove.moveId);

    console.log(
      `  - ${move?.name ?? instanceMove.moveId} (${instanceMove.currentPp} PP)`
    );
  }

  console.log("✅ Instance valid");

  return instance;
}

function validateInvalidInputs() {
  console.log("");
  console.log("Testing invalid inputs...");

  assert.throws(
    () => createPokemonInstance(25, 0),
    /level/i,
    "Level 0 should be rejected"
  );

  assert.throws(
    () => createPokemonInstance(25, 5.5),
    /level/i,
    "Decimal levels should be rejected"
  );

  assert.throws(
    () => createPokemonInstance(0, 5),
    /speciesId/i,
    "speciesId 0 should be rejected"
  );

  assert.throws(
    () => createPokemonInstance(9999, 5),
    /not found/i,
    "Unknown species should be rejected"
  );

  console.log("✅ Invalid inputs rejected");
}

console.log("======================================");

console.log("Pokémon Instance Factory Smoke Test");

console.log("======================================");

// Pikachu
validatePokemonInstance(25, 5);

// Charizard
validatePokemonInstance(6, 50);

// Bulbasaur
validatePokemonInstance(1, 5);

// Invalid cases
validateInvalidInputs();

console.log("");
console.log("======================================");

console.log("✅ Pokémon Instance Factory validation passed");

console.log("======================================");
