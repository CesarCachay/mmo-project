export type PokemonGymId = "gym-01" | "gym-02";
export type PokemonGymBadgeId = "boulder-badge" | "cascade-badge";
/*
 * Presentation IDs are intentionally broader than the currently registered
 * gyms. The corresponding runtime art already exists in the client asset
 * bundle, so future Gym Leaders can reuse the same intro/presentation
 * pipeline without adding new branching logic.
 */
export type PokemonGymLeaderPresentationId =
  | "brock"
  | "misty"
  | "surge"
  | "erika"
  | "koga"
  | "sabrina"
  | "giovanni";

export interface PokemonGymBadgeDefinition {
  readonly id: PokemonGymBadgeId;
  readonly displayName: string;
}

export interface PokemonGymDefinition {
  readonly id: PokemonGymId;
  readonly mapId: string;
  readonly displayName: string;
  readonly leaderTrainerBattleId: string;
  readonly leaderPresentationId: PokemonGymLeaderPresentationId;
  readonly badgeId: PokemonGymBadgeId;
}
