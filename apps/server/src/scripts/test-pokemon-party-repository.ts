import assert from 'node:assert/strict';

import { createPokemonInstance, type PokemonParty } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service';

import { createPokemonTrainerIdentity } from '../pokemon/pokemon-trainer-identity';

import { PokemonTrainerRepository } from '../pokemon/pokemon-trainer.repository';

import { PokemonPartyRepository } from '../pokemon/pokemon-party.repository';

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.$connect();

  const trainerRepository = new PokemonTrainerRepository(prisma);

  const partyRepository = new PokemonPartyRepository(prisma);

  const identity = createPokemonTrainerIdentity();

  try {
    await trainerRepository.create(identity);

    const charmander = createPokemonInstance(4, 5);

    const squirtle = createPokemonInstance(7, 5);

    const initialParty: PokemonParty = {
      pokemon: [charmander, squirtle],
    };

    await partyRepository.saveParty(identity.trainerId, initialParty);

    const loadedParty = await partyRepository.loadParty(identity.trainerId);

    assert.deepEqual(
      loadedParty,
      initialParty,
      'Loaded party must exactly match the saved runtime party',
    );

    console.log('✅ Party save/load valid');

    /*
     * Validate party order persistence.
     */
    const reorderedParty: PokemonParty = {
      pokemon: [squirtle, charmander],
    };

    await partyRepository.saveParty(identity.trainerId, reorderedParty);

    const loadedReorderedParty = await partyRepository.loadParty(
      identity.trainerId,
    );

    assert.deepEqual(
      loadedReorderedParty,
      reorderedParty,
      'Party order must survive persistence',
    );

    console.log('✅ Party order persistence valid');

    /*
     * Remove Charmander from ACTIVE PARTY.
     *
     * It should remain owned by the Trainer
     * with partyPosition = null.
     */
    const reducedParty: PokemonParty = {
      pokemon: [squirtle],
    };

    await partyRepository.saveParty(identity.trainerId, reducedParty);

    const loadedReducedParty = await partyRepository.loadParty(
      identity.trainerId,
    );

    assert.deepEqual(loadedReducedParty, reducedParty);

    const storedCharmander = await prisma.pokemonInstance.findUnique({
      where: {
        id: charmander.instanceId,
      },
    });

    assert.ok(storedCharmander);

    assert.equal(storedCharmander.trainerId, identity.trainerId);

    assert.equal(storedCharmander.partyPosition, null);

    console.log('✅ Pokémon ownership preserved outside active party');

    console.log('');
    console.log('============================================');
    console.log('✅ Pokémon Party Repository validation passed');
    console.log('============================================');
  } finally {
    /*
     * Cascades remove Pokémon and moves.
     */
    await prisma.pokemonTrainer.deleteMany({
      where: {
        id: identity.trainerId,
      },
    });

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[PokemonPartyRepository] test failed', error);

  process.exitCode = 1;
});
