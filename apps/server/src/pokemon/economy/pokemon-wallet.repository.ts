import { Injectable } from '@nestjs/common';

import {
  createPokemonMoney,
  type PokemonMoney,
} from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';
import type { PokemonTrainerId } from '../pokemon-trainer-identity';

@Injectable()
export class PokemonWalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async loadMoney(trainerId: PokemonTrainerId): Promise<PokemonMoney> {
    const rows = await this.prisma.$queryRaw<Array<{ money: number }>>`
      SELECT "money"
      FROM "pokemon_trainers"
      WHERE "id" = CAST(${trainerId} AS uuid)
      LIMIT 1
    `;

    const row = rows[0];

    if (!row) {
      throw new Error(`Pokémon trainer ${trainerId} does not exist`);
    }

    return createPokemonMoney(row.money);
  }

  public async saveMoney(
    trainerId: PokemonTrainerId,
    money: PokemonMoney,
  ): Promise<PokemonMoney> {
    const validatedMoney = createPokemonMoney(money);

    const rows = await this.prisma.$queryRaw<Array<{ money: number }>>`
      UPDATE "pokemon_trainers"
      SET "money" = ${validatedMoney},
          "updated_at" = NOW()
      WHERE "id" = CAST(${trainerId} AS uuid)
      RETURNING "money"
    `;

    const row = rows[0];

    if (!row) {
      throw new Error(`Pokémon trainer ${trainerId} does not exist`);
    }

    return createPokemonMoney(row.money);
  }
}
