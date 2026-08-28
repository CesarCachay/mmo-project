import assert from 'node:assert/strict';

import { createPokemonTrainerIdentity } from '../pokemon/pokemon-trainer-identity';

import { PokemonTrainerRepository } from '../pokemon/pokemon-trainer.repository';

import { hashPokemonTrainerSessionToken } from '../pokemon/pokemon-trainer-session-token';

import { PrismaService } from '../database/prisma.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.$connect();

  const repository = new PokemonTrainerRepository(prisma);

  const identity = createPokemonTrainerIdentity();

  try {
    const created = await repository.create(identity);

    assert.equal(created.trainerId, identity.trainerId);

    const foundByTrainerId = await repository.findByTrainerId(
      identity.trainerId,
    );

    assert.ok(foundByTrainerId);

    assert.equal(foundByTrainerId.trainerId, identity.trainerId);

    const foundBySessionToken = await repository.findBySessionToken(
      identity.sessionToken,
    );

    assert.ok(foundBySessionToken);

    assert.equal(foundBySessionToken.trainerId, identity.trainerId);

    const databaseTrainer = await prisma.pokemonTrainer.findUnique({
      where: {
        id: identity.trainerId,
      },
    });

    assert.ok(databaseTrainer);

    assert.notEqual(databaseTrainer.sessionTokenHash, identity.sessionToken);

    assert.equal(
      databaseTrainer.sessionTokenHash,
      hashPokemonTrainerSessionToken(identity.sessionToken),
    );

    console.log('[PokemonTrainerRepository] test passed', {
      trainerId: identity.trainerId,

      foundByTrainerId: true,

      foundBySessionToken: true,

      rawTokenStored: false,
    });
  } finally {
    await prisma.pokemonTrainer.deleteMany({
      where: {
        id: identity.trainerId,
      },
    });

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[PokemonTrainerRepository] test failed', error);

  process.exitCode = 1;
});
