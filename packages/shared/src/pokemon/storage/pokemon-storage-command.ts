export interface PokemonStorageWithdrawCommand {
  readonly type: "withdraw";
  readonly pokemonInstanceId: string;
}

export interface PokemonStorageDepositCommand {
  readonly type: "deposit";
  readonly pokemonInstanceId: string;
}

export interface PokemonStorageSwapCommand {
  readonly type: "swap";

  readonly storedPokemonInstanceId: string;
  readonly partyPokemonInstanceId: string;
}

export type PokemonStorageCommand =
  | PokemonStorageWithdrawCommand
  | PokemonStorageDepositCommand
  | PokemonStorageSwapCommand;

export function isPokemonStorageCommand(value: unknown): value is PokemonStorageCommand {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "withdraw":
    case "deposit":
      return isNonEmptyString(value.pokemonInstanceId);

    case "swap":
      return (
        isNonEmptyString(value.storedPokemonInstanceId) &&
        isNonEmptyString(value.partyPokemonInstanceId) &&
        value.storedPokemonInstanceId !== value.partyPokemonInstanceId
      );

    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
