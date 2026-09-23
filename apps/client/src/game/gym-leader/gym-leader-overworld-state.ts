import {
  getPokemonTrainerBattleDefinition,
  type PokemonTrainerBattleId,
} from "@cesar-mmo/shared";

export interface GymLeaderOverworldLabelPresentation {
  readonly text: string;
  readonly completed: boolean;
}

export function getTrainerBattleInteractionPrompt(
  trainerBattleId: PokemonTrainerBattleId,
  defeated: boolean,
): string | undefined {
  if (defeated) {
    return "Hablar";
  }

  const definition = getPokemonTrainerBattleDefinition(trainerBattleId);

  return definition.category === "gym-leader" ? "Desafiar" : undefined;
}

export function getGymLeaderOverworldLabelPresentation(input: {
  readonly displayName: string;
  readonly trainerBattleId?: PokemonTrainerBattleId;
  readonly defeatedTrainerBattleIds: ReadonlySet<string>;
}): GymLeaderOverworldLabelPresentation {
  const trainerBattleId = input.trainerBattleId;

  if (!trainerBattleId) {
    return {
      text: input.displayName,
      completed: false,
    };
  }

  const definition = getPokemonTrainerBattleDefinition(trainerBattleId);
  const completed =
    definition.category === "gym-leader" &&
    input.defeatedTrainerBattleIds.has(trainerBattleId);

  return {
    text: completed ? `${input.displayName} ✓` : input.displayName,
    completed,
  };
}
