import assert from 'node:assert/strict';

import { PrismaService } from '../database/prisma.service.js';

import { createPokemonTrainerIdentity } from '../pokemon/pokemon-trainer-identity.js';

import { PokemonPartyRepository } from '../pokemon/pokemon-party.repository.js';

import { PokemonTrainerRepository } from '../pokemon/pokemon-trainer.repository.js';

import { PokemonTrainerService } from '../pokemon/pokemon-trainer.service.js';

import { PokemonTrainerStateStore } from '../pokemon/pokemon-trainer-state.store.js';

async function main(): Promise<void> {
  console.log('============================================');

  console.log('Pokémon Starter Persistence Integration Test');

  console.log('============================================');

  const prisma = new PrismaService();

  await prisma.$connect();

  const trainerRepository = new PokemonTrainerRepository(prisma);

  const partyRepository = new PokemonPartyRepository(prisma);

  const trainerStateStore = new PokemonTrainerStateStore();

  const trainerService = new PokemonTrainerService(
    trainerStateStore,
    partyRepository,
  );

  const identity = createPokemonTrainerIdentity();

  try {
    // --------------------------------------------------
    // Persist Trainer
    // --------------------------------------------------

    console.log('');
    console.log('Testing trainer persistence...');

    await trainerRepository.create(identity);

    const persistedTrainer = await trainerRepository.findByTrainerId(
      identity.trainerId,
    );

    assert.ok(persistedTrainer, 'Trainer should exist in PostgreSQL');

    assert.equal(persistedTrainer.trainerId, identity.trainerId);

    console.log('✅ Trainer persisted');

    // --------------------------------------------------
    // Runtime TrainerState
    // --------------------------------------------------

    console.log('');
    console.log('Testing runtime trainer state...');

    const initialState = trainerStateStore.create(identity.trainerId);

    assert.equal(
      initialState.party.pokemon.length,
      0,
      'Trainer should start with an empty party',
    );

    console.log('✅ Runtime TrainerState created');

    // --------------------------------------------------
    // Unlock starter
    // --------------------------------------------------

    trainerStateStore.unlockStarterSelection(identity.trainerId);

    assert.equal(
      trainerStateStore.isStarterSelectionUnlocked(identity.trainerId),
      true,
    );

    console.log('✅ Starter selection unlocked');

    // --------------------------------------------------
    // Choose Charmander
    // --------------------------------------------------

    console.log('');
    console.log('Testing Charmander selection...');

    const updatedState = await trainerService.chooseStarter(
      identity.trainerId,
      'CHARMANDER',
    );

    assert.equal(
      updatedState.party.pokemon.length,
      1,
      'Trainer should have exactly one Pokémon',
    );

    const charmander = updatedState.party.pokemon[0];

    assert.ok(charmander, 'Charmander instance should exist');

    assert.equal(charmander.speciesId, 4, 'Starter should be Charmander');

    assert.equal(charmander.level, 5, 'Charmander should start at level 5');

    assert.ok(
      charmander.instanceId.length > 0,
      'Charmander should have an instanceId',
    );

    console.log('✅ Charmander created');

    // --------------------------------------------------
    // Runtime state updated
    // --------------------------------------------------

    const storedRuntimeState = trainerStateStore.get(identity.trainerId);

    assert.ok(storedRuntimeState, 'Runtime TrainerState should still exist');

    assert.equal(storedRuntimeState.party.pokemon.length, 1);

    assert.equal(
      storedRuntimeState.party.pokemon[0]?.instanceId,
      charmander.instanceId,
      'Runtime store should contain the same Pokémon instance',
    );

    console.log('✅ Runtime Party updated');

    // --------------------------------------------------
    // PostgreSQL Party
    // --------------------------------------------------

    console.log('');
    console.log('Testing PostgreSQL party persistence...');

    const persistedParty = await partyRepository.loadParty(identity.trainerId);

    assert.equal(
      persistedParty.pokemon.length,
      1,
      'PostgreSQL party should contain one Pokémon',
    );

    const persistedCharmander = persistedParty.pokemon[0];

    assert.ok(persistedCharmander, 'Persisted Charmander should exist');

    assert.deepEqual(
      persistedCharmander,
      charmander,
      'Persisted Pokémon should exactly match runtime Pokémon',
    );

    console.log('✅ Charmander persisted to PostgreSQL');

    // --------------------------------------------------
    // Verify DB position
    // --------------------------------------------------

    const databasePokemon = await prisma.pokemonInstance.findUnique({
      where: {
        id: charmander.instanceId,
      },
    });

    assert.ok(databasePokemon, 'PokemonInstance row should exist');

    assert.equal(databasePokemon.trainerId, identity.trainerId);

    assert.equal(databasePokemon.speciesId, 4);

    assert.equal(
      databasePokemon.partyPosition,
      0,
      'Starter should occupy party position 0',
    );

    console.log('✅ Database ownership and party position valid');

    // --------------------------------------------------
    // Moves persisted
    // --------------------------------------------------

    const databaseMoves = await prisma.pokemonInstanceMove.findMany({
      where: {
        pokemonInstanceId: charmander.instanceId,
      },

      orderBy: {
        slot: 'asc',
      },
    });

    assert.equal(
      databaseMoves.length,
      charmander.moves.length,
      'All starter moves should be persisted',
    );

    for (let slot = 0; slot < charmander.moves.length; slot += 1) {
      const runtimeMove = charmander.moves[slot];

      const databaseMove = databaseMoves[slot];

      assert.ok(runtimeMove);
      assert.ok(databaseMove);

      assert.equal(databaseMove.slot, slot);

      assert.equal(databaseMove.moveId, runtimeMove.moveId);

      assert.equal(databaseMove.currentPp, runtimeMove.currentPp);
    }

    console.log('✅ Pokémon moves persisted in correct order');

    // --------------------------------------------------
    // Starter should now be locked
    // --------------------------------------------------

    assert.equal(
      trainerStateStore.isStarterSelectionUnlocked(identity.trainerId),
      false,
      'Starter selection should lock after successful choice',
    );

    console.log('✅ Starter selection locked');

    // --------------------------------------------------
    // Cannot choose second starter
    // --------------------------------------------------

    console.log('');
    console.log('Testing duplicate starter rejection...');

    await assert.rejects(
      () => trainerService.chooseStarter(identity.trainerId, 'SQUIRTLE'),
      /already has a Pokémon/i,
      'Trainer should not be able to choose another starter',
    );

    const partyAfterRejection = await partyRepository.loadParty(
      identity.trainerId,
    );

    assert.equal(
      partyAfterRejection.pokemon.length,
      1,
      'Rejected selection must not modify persisted party',
    );

    assert.equal(
      partyAfterRejection.pokemon[0]?.instanceId,
      charmander.instanceId,
      'Original Charmander should remain persisted',
    );

    console.log('✅ Second starter rejected without modifying persistence');

    // --------------------------------------------------
    // Complete
    // --------------------------------------------------

    console.log('');
    console.log('============================================');

    console.log('✅ Pokémon Starter Persistence validation passed');

    console.log('============================================');
  } finally {
    /*
     * PokemonTrainer -> PokemonInstance -> Moves
     * are removed through DB cascades.
     */
    await prisma.pokemonTrainer.deleteMany({
      where: {
        id: identity.trainerId,
      },
    });

    trainerStateStore.clear();

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[PokemonStarterPersistence] test failed', error);

  process.exitCode = 1;
});
