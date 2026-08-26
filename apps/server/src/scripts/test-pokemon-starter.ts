import assert from 'node:assert/strict';

import { PokemonTrainerService } from '../pokemon/pokemon-trainer.service.js';
import { PokemonTrainerStateStore } from '../pokemon/pokemon-trainer-state.store.js';

console.log('============================================');
console.log('Pokémon Starter Smoke Test');
console.log('============================================');

const store = new PokemonTrainerStateStore();
const service = new PokemonTrainerService(store);

const playerA = 'player-starter-001';
const playerB = 'player-starter-002';

// --------------------------------------------------
// Trainer A setup
// --------------------------------------------------

console.log('');
console.log('Testing Trainer A setup...');

store.create(playerA);

const playerAInitialState = store.get(playerA);

assert.ok(playerAInitialState, 'Trainer A state should exist');

assert.equal(
  playerAInitialState.party.pokemon.length,
  0,
  'Trainer A should start with an empty party',
);

console.log('✅ Trainer A setup valid');

// --------------------------------------------------
// Trainer A chooses Mudkip
// --------------------------------------------------

console.log('');
console.log('Testing Mudkip starter choice...');

const playerAUpdatedState = service.chooseStarter(playerA, 'MUDKIP');

assert.equal(
  playerAUpdatedState.party.pokemon.length,
  1,
  'Trainer A should have exactly one Pokémon',
);

const mudkip = playerAUpdatedState.party.pokemon[0];

assert.ok(mudkip, 'Mudkip instance should exist');

assert.equal(mudkip.speciesId, 258, 'Trainer A starter should be Mudkip');

assert.equal(mudkip.level, 5, 'Mudkip should start at level 5');

assert.ok(mudkip.instanceId.length > 0, 'Mudkip should have an instanceId');

console.log('✅ Mudkip starter created correctly');

// --------------------------------------------------
// Trainer A cannot choose twice
// --------------------------------------------------

console.log('');
console.log('Testing duplicate starter rejection...');

assert.throws(
  () => service.chooseStarter(playerA, 'CHARMANDER'),
  /already has a Pokémon/i,
  'Trainer A should not be able to choose a second starter',
);

const playerAStoredState = store.get(playerA);

assert.ok(playerAStoredState, 'Trainer A state should still exist');

assert.equal(
  playerAStoredState.party.pokemon.length,
  1,
  'Rejected starter choice must not modify Trainer A party',
);

assert.equal(
  playerAStoredState.party.pokemon[0]?.instanceId,
  mudkip.instanceId,
  'Trainer A should still have the original Mudkip',
);

console.log('✅ Second starter choice rejected');

// --------------------------------------------------
// Trainer B chooses Piplup
// --------------------------------------------------

console.log('');
console.log('Testing independent Trainer B starter...');

store.create(playerB);

const playerBUpdatedState = service.chooseStarter(playerB, 'PIPLUP');

assert.equal(
  playerBUpdatedState.party.pokemon.length,
  1,
  'Trainer B should have exactly one Pokémon',
);

const piplup = playerBUpdatedState.party.pokemon[0];

assert.ok(piplup, 'Piplup instance should exist');

assert.equal(piplup.speciesId, 393, 'Trainer B starter should be Piplup');

assert.equal(piplup.level, 5, 'Piplup should start at level 5');

assert.notEqual(
  piplup.instanceId,
  mudkip.instanceId,
  'Different trainers must receive different Pokémon instances',
);

console.log('✅ Trainer B starter created independently');

// --------------------------------------------------
// Unknown trainer
// --------------------------------------------------

console.log('');
console.log('Testing unknown trainer rejection...');

assert.throws(
  () => service.chooseStarter('missing-player', 'BULBASAUR'),
  /trainer state not found/i,
  'Unknown trainer should not be able to choose a starter',
);

console.log('✅ Unknown trainer rejected');

// --------------------------------------------------
// Complete
// --------------------------------------------------

console.log('');
console.log('============================================');
console.log('✅ Pokémon Starter validation passed');
console.log('============================================');
