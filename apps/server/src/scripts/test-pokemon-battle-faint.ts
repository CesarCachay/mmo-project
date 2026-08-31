import assert from 'node:assert/strict';

import {
  createBattlePokemonState,
  createPokemonInstance,
  isBattlePokemonAbleToAct,
  isBattlePokemonFainted,
} from '@cesar-mmo/shared';

function createTestPokemon() {
  const pokemon = createPokemonInstance(19, 5);

  return createBattlePokemonState(pokemon);
}

function testPositiveHp(): void {
  const pokemon = createTestPokemon();

  pokemon.currentHp = 10;

  assert.equal(isBattlePokemonFainted(pokemon), false);

  assert.equal(isBattlePokemonAbleToAct(pokemon), true);

  console.log('✅ Pokémon with HP > 0 can act');
}

function testZeroHp(): void {
  const pokemon = createTestPokemon();

  pokemon.currentHp = 0;

  assert.equal(isBattlePokemonFainted(pokemon), true);

  assert.equal(isBattlePokemonAbleToAct(pokemon), false);

  console.log('✅ Pokémon with HP 0 is fainted');
}

function testNegativeHpRejected(): void {
  const pokemon = createTestPokemon();

  pokemon.currentHp = -1;

  assert.throws(() => {
    isBattlePokemonFainted(pokemon);
  }, /Invalid battle Pokémon HP/);

  assert.throws(() => {
    isBattlePokemonAbleToAct(pokemon);
  }, /Invalid battle Pokémon HP/);

  console.log('✅ Negative HP rejected');
}

function testNonIntegerHpRejected(): void {
  const pokemon = createTestPokemon();

  pokemon.currentHp = 4.5;

  assert.throws(() => {
    isBattlePokemonFainted(pokemon);
  }, /Invalid battle Pokémon HP/);

  console.log('✅ Non-integer HP rejected');
}

function main(): void {
  testPositiveHp();

  testZeroHp();

  testNegativeHpRejected();

  testNonIntegerHpRejected();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleFaint smoke test passed');

  console.log('============================================');
}

main();
