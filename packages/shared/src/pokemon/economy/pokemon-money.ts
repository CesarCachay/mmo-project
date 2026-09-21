export type PokemonMoney = number;

export const POKEMON_STARTING_MONEY: PokemonMoney = 3_000;
export const POKEMON_MAX_MONEY: PokemonMoney = 999_999;

export function isPokemonMoney(value: unknown): value is PokemonMoney {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= POKEMON_MAX_MONEY
  );
}

export function createPokemonMoney(
  value: number = POKEMON_STARTING_MONEY,
): PokemonMoney {
  assertPokemonMoney(value);
  return value;
}

export function addPokemonMoney(
  currentMoney: PokemonMoney,
  amount: number,
): PokemonMoney {
  assertPokemonMoney(currentMoney);
  assertNonNegativeMoneyAmount(amount);

  return Math.min(POKEMON_MAX_MONEY, currentMoney + amount);
}

export function spendPokemonMoney(
  currentMoney: PokemonMoney,
  amount: number,
): PokemonMoney {
  assertPokemonMoney(currentMoney);
  assertNonNegativeMoneyAmount(amount);

  if (amount > currentMoney) {
    throw new Error(
      `Not enough money: requested ${amount}, available ${currentMoney}`,
    );
  }

  return currentMoney - amount;
}

export function assertPokemonMoney(value: number): asserts value is PokemonMoney {
  if (!isPokemonMoney(value)) {
    throw new Error(
      `Pokémon money must be an integer between 0 and ${POKEMON_MAX_MONEY}, received "${value}"`,
    );
  }
}

function assertNonNegativeMoneyAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(
      `Pokémon money amount must be a non-negative integer, received "${amount}"`,
    );
  }
}
