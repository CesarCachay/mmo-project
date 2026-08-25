import assert from "node:assert/strict";

import {
  MAX_POKEMON_PARTY_SIZE,
  addPokemonToParty,
  createPokemonInstance,
  createPokemonParty,
  getPokemonPartySize,
  hasPokemonInstance,
  isPokemonPartyFull,
  removePokemonFromParty,
} from "@cesar-mmo/shared";

console.log("======================================");

console.log("Pokémon Party Domain Smoke Test");

console.log("======================================");

// --------------------------------------------------
// 1. Create empty party
// --------------------------------------------------

console.log("");
console.log("Testing empty party...");

const emptyParty = createPokemonParty();

assert.equal(getPokemonPartySize(emptyParty), 0, "New party should be empty");

assert.equal(isPokemonPartyFull(emptyParty), false, "New party should not be full");

console.log("✅ Empty party valid");

// --------------------------------------------------
// 2. Create Pokémon instances
// --------------------------------------------------

console.log("");
console.log("Creating Pokémon instances...");

const bulbasaur = createPokemonInstance(1, 5);
const ivysaur = createPokemonInstance(2, 16);
const venusaur = createPokemonInstance(3, 32);
const charmander = createPokemonInstance(4, 5);
const charmeleon = createPokemonInstance(5, 16);
const charizard = createPokemonInstance(6, 36);

console.log("✅ Pokémon instances created");

// --------------------------------------------------
// 3. Add first Pokémon
// --------------------------------------------------

console.log("");
console.log("Testing addPokemonToParty...");

const partyWithOne = addPokemonToParty(emptyParty, bulbasaur);

assert.equal(getPokemonPartySize(partyWithOne), 1, "Party should contain one Pokémon");

assert.equal(
  hasPokemonInstance(partyWithOne, bulbasaur.instanceId),
  true,
  "Bulbasaur instance should exist in the party"
);

// Original state should not mutate
assert.equal(
  getPokemonPartySize(emptyParty),
  0,
  "Original party should remain unchanged"
);

console.log("✅ Add operation valid");

// --------------------------------------------------
// 4. Fill party to maximum size
// --------------------------------------------------

console.log("");
console.log("Testing maximum party size...");

let fullParty = partyWithOne;

fullParty = addPokemonToParty(fullParty, ivysaur);

fullParty = addPokemonToParty(fullParty, venusaur);

fullParty = addPokemonToParty(fullParty, charmander);

fullParty = addPokemonToParty(fullParty, charmeleon);

fullParty = addPokemonToParty(fullParty, charizard);

assert.equal(
  getPokemonPartySize(fullParty),
  MAX_POKEMON_PARTY_SIZE,
  `Party should contain ${MAX_POKEMON_PARTY_SIZE} Pokémon`
);

assert.equal(isPokemonPartyFull(fullParty), true, "Party should be full");

console.log(`✅ Party reaches maximum size of ${MAX_POKEMON_PARTY_SIZE}`);

// --------------------------------------------------
// 5. Reject seventh Pokémon
// --------------------------------------------------

console.log("");
console.log("Testing party overflow...");

const squirtle = createPokemonInstance(7, 5);

assert.throws(
  () => addPokemonToParty(fullParty, squirtle),
  /cannot contain more than/i,
  "Adding a seventh Pokémon should fail"
);

assert.equal(
  getPokemonPartySize(fullParty),
  MAX_POKEMON_PARTY_SIZE,
  "Full party should remain unchanged after rejection"
);

console.log("✅ Seventh Pokémon rejected");

// --------------------------------------------------
// 6. Reject duplicated instanceId
// --------------------------------------------------

console.log("");
console.log("Testing duplicate instance...");

assert.throws(
  () => addPokemonToParty(partyWithOne, bulbasaur),
  /already in the party/i,
  "Same Pokémon instance should not be added twice"
);

assert.equal(
  getPokemonPartySize(partyWithOne),
  1,
  "Party should remain unchanged after duplicate rejection"
);

console.log("✅ Duplicate instance rejected");

// --------------------------------------------------
// 7. Same species with different instanceIds is valid
// --------------------------------------------------

console.log("");
console.log("Testing same species with different instances...");

const bulbasaurTwo = createPokemonInstance(1, 5);

assert.notEqual(
  bulbasaur.instanceId,
  bulbasaurTwo.instanceId,
  "Different Pokémon instances should have different instanceIds"
);

const partyWithTwoBulbasaur = addPokemonToParty(partyWithOne, bulbasaurTwo);

assert.equal(
  getPokemonPartySize(partyWithTwoBulbasaur),
  2,
  "Two Pokémon of the same species should be allowed"
);

assert.equal(
  partyWithTwoBulbasaur.pokemon.filter((pokemon) => pokemon.speciesId === 1).length,
  2,
  "Party should contain two Bulbasaur instances"
);

console.log("✅ Same species with different instanceIds allowed");

// --------------------------------------------------
// 8. Remove Pokémon
// --------------------------------------------------

console.log("");
console.log("Testing removePokemonFromParty...");

const partyAfterRemoval = removePokemonFromParty(fullParty, charizard.instanceId);

assert.equal(
  getPokemonPartySize(partyAfterRemoval),
  MAX_POKEMON_PARTY_SIZE - 1,
  "Party should contain one fewer Pokémon"
);

assert.equal(
  hasPokemonInstance(partyAfterRemoval, charizard.instanceId),
  false,
  "Removed Pokémon should no longer exist in party"
);

assert.equal(
  getPokemonPartySize(fullParty),
  MAX_POKEMON_PARTY_SIZE,
  "Original full party should remain unchanged"
);

assert.equal(
  isPokemonPartyFull(partyAfterRemoval),
  false,
  "Party should no longer be full after removal"
);

console.log("✅ Remove operation valid");

// --------------------------------------------------
// 9. Reject removal of missing Pokémon
// --------------------------------------------------

console.log("");
console.log("Testing invalid removal...");

assert.throws(
  () => removePokemonFromParty(partyAfterRemoval, charizard.instanceId),
  /not in the party/i,
  "Removing a missing Pokémon should fail"
);

console.log("✅ Missing Pokémon removal rejected");

// --------------------------------------------------
// Final result
// --------------------------------------------------

console.log("");
console.log("======================================");

console.log("✅ Pokémon Party Domain validation passed");

console.log("======================================");
