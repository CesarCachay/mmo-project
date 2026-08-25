import assert from 'node:assert/strict';

import { addPokemonToParty, createPokemonInstance } from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from '../pokemon/pokemon-trainer-state.store.js';

console.log('============================================');
console.log('Pokémon Trainer State Store Smoke Test');
console.log('============================================');

const store = new PokemonTrainerStateStore();

const playerId = 'player-test-001';

// --------------------------------------------------
// Initial state
// --------------------------------------------------

console.log('');
console.log('Testing initial state...');

assert.equal(
  store.has(playerId),
  false,
  'Player should not initially have a trainer state',
);

assert.equal(
  store.get(playerId),
  undefined,
  'Unknown player should return undefined',
);

console.log('✅ Initial state valid');

// --------------------------------------------------
// Create
// --------------------------------------------------

console.log('');
console.log('Testing trainer state creation...');

const trainerState = store.create(playerId);

assert.equal(
  store.has(playerId),
  true,
  'Trainer state should exist after creation',
);

assert.equal(
  store.get(playerId),
  trainerState,
  'Store should return the created trainer state',
);

assert.deepEqual(
  trainerState.party,
  {
    pokemon: [],
  },
  'New trainer should start with an empty Pokémon party',
);

console.log('✅ Trainer state created');

// --------------------------------------------------
// Duplicate creation
// --------------------------------------------------

console.log('');
console.log('Testing duplicate creation...');

assert.throws(
  () => store.create(playerId),
  /already exists/i,
  'Creating a second trainer state for the same player should fail',
);

console.log('✅ Duplicate trainer state rejected');

// --------------------------------------------------
// Multiple players
// --------------------------------------------------

console.log('');
console.log('Testing multiple players...');

const secondPlayerId = 'player-test-002';

store.create(secondPlayerId);

assert.equal(store.has(playerId), true);

assert.equal(store.has(secondPlayerId), true);

assert.notEqual(
  store.get(playerId),
  store.get(secondPlayerId),
  'Players should have independent trainer states',
);

console.log('✅ Multiple trainer states isolated');

// --------------------------------------------------
// Pokémon Party Update
// --------------------------------------------------

console.log('');
console.log('Testing Pokémon party update...');

const pikachu = createPokemonInstance(25, 5);

const currentTrainerState = store.get(playerId);

assert.ok(
  currentTrainerState,
  'Trainer state should exist before updating party',
);

const updatedParty = addPokemonToParty(currentTrainerState.party, pikachu);

const updatedTrainerState = store.setParty(playerId, updatedParty);

// --------------------------------------------------
// Immutability
// --------------------------------------------------

assert.equal(
  currentTrainerState.party.pokemon.length,
  0,
  'Original trainer state should remain unchanged',
);

// --------------------------------------------------
// Updated state
// --------------------------------------------------

assert.equal(
  updatedTrainerState.party.pokemon.length,
  1,
  'Trainer party should contain one Pokémon',
);

assert.equal(
  updatedTrainerState.party.pokemon[0]?.instanceId,
  pikachu.instanceId,
  'Stored Pokémon should preserve its instanceId',
);

assert.equal(
  updatedTrainerState.party.pokemon[0]?.speciesId,
  25,
  'Stored Pokémon should be Pikachu',
);

assert.equal(
  updatedTrainerState.party.pokemon[0]?.level,
  5,
  'Stored Pokémon should preserve its level',
);

// --------------------------------------------------
// Store persistence
// --------------------------------------------------

const storedTrainerState = store.get(playerId);

assert.ok(
  storedTrainerState,
  'Trainer state should still exist after party update',
);

assert.equal(
  storedTrainerState.party.pokemon.length,
  1,
  'Updated party should be persisted in the store',
);

assert.equal(
  storedTrainerState.party.pokemon[0]?.instanceId,
  pikachu.instanceId,
  'Store should contain the exact Pokémon instance',
);

console.log('✅ Pokémon party update valid');

// --------------------------------------------------
// Invalid Party Update
// --------------------------------------------------

console.log('');
console.log('Testing invalid party update...');

assert.throws(
  () => store.setParty('missing-player', updatedParty),
  /trainer state not found/i,
  'Updating party for an unknown player should fail',
);

console.log('✅ Unknown trainer party update rejected');

// --------------------------------------------------
// Remove
// --------------------------------------------------

console.log('');
console.log('Testing removal...');

store.remove(playerId);

assert.equal(
  store.has(playerId),
  false,
  'Trainer state should disappear after removal',
);

assert.equal(store.get(playerId), undefined);

assert.equal(
  store.has(secondPlayerId),
  true,
  'Removing one player must not affect another player',
);

console.log('✅ Trainer state removed');

// --------------------------------------------------
// Clear
// --------------------------------------------------

console.log('');
console.log('Testing clear...');

store.clear();

assert.equal(store.has(secondPlayerId), false);

assert.equal(store.get(secondPlayerId), undefined);

console.log('✅ Store cleared');

// --------------------------------------------------
// Complete
// --------------------------------------------------

console.log('');
console.log('============================================');
console.log('✅ Pokémon Trainer State Store validation passed');
console.log('============================================');
