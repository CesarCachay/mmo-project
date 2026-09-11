export type PokemonEvolutionDecision =
  | {
      readonly type: "accept";
    }
  | {
      readonly type: "cancel";
    };
