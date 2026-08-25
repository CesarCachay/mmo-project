import assert from 'node:assert/strict';

import { PokemonTrainerService } from '../pokemon/pokemon-trainer.service.js';
import { PokemonTrainerStateStore } from '../pokemon/pokemon-trainer-state.store.js';

console.log('============================================');
console.log('Pokémon Trainer Service Smoke Test');
console.log('============================================');

const store = new PokemonTrainerStateStore();
const service = new PokemonTrainerService(store);

const playerId = 'player-test-001';

// --------------------------------------------------
// Create trainer
// --------------------------------------------------

console.log('');
console.log('Testing trainer setup...');

const initialTrainerState = store.create(playerId);

assert.equal(
  initialTrainerState.party.pokemon.length,
  0,
  'Trainer should initially have an empty party',
);

console.log('✅ Trainer setup valid');

// --------------------------------------------------
// Add Pokémon through service
// --------------------------------------------------

console.log('');
console.log('Testing addPokemon()...');

const updatedTrainerState = service.addPokemon(playerId, 25, 5);

assert.equal(
  updatedTrainerState.party.pokemon.length,
  1,
  'Trainer party should contain one Pokémon',
);

const pokemon = updatedTrainerState.party.pokemon[0];

assert.ok(pokemon, 'Trainer party should contain a Pokémon instance');

assert.equal(pokemon.speciesId, 25, 'Added Pokémon should be Pikachu');

assert.equal(pokemon.level, 5, 'Added Pokémon should be level 5');

assert.equal(
  typeof pokemon.instanceId,
  'string',
  'Pokémon should have an instanceId',
);

assert.ok(
  pokemon.instanceId.length > 0,
  'Pokémon instanceId should not be empty',
);

console.log('✅ Pokémon added through service');

// --------------------------------------------------
// Store persistence
// --------------------------------------------------

console.log('');
console.log('Testing store persistence...');

const storedTrainerState = store.get(playerId);

assert.ok(storedTrainerState, 'Trainer state should still exist in the store');

assert.equal(
  storedTrainerState.party.pokemon.length,
  1,
  'Stored party should contain one Pokémon',
);

assert.equal(
  storedTrainerState.party.pokemon[0]?.instanceId,
  pokemon.instanceId,
  'Store should contain the same Pokémon instance',
);

console.log('✅ Trainer state persisted');

// --------------------------------------------------
// Immutability
// --------------------------------------------------

console.log('');
console.log('Testing state immutability...');

assert.equal(
  initialTrainerState.party.pokemon.length,
  0,
  'Original trainer state should remain unchanged',
);

assert.notEqual(
  initialTrainerState,
  updatedTrainerState,
  'Service should return a new trainer state',
);

console.log('✅ Trainer state remains immutable');

// --------------------------------------------------
// Unknown trainer
// --------------------------------------------------

console.log('');
console.log('Testing unknown trainer rejection...');

assert.throws(
  () => service.addPokemon('missing-player', 25, 5),
  /trainer state not found/i,
  'Adding Pokémon to an unknown trainer should fail',
);

console.log('✅ Unknown trainer rejected');

// --------------------------------------------------
// Complete
// --------------------------------------------------

console.log('');
console.log('============================================');
console.log('✅ Pokémon Trainer Service validation passed');
console.log('============================================');
