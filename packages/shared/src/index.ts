export type { Player, PlayerInput, Direction } from "./game.types.js";

export {
  PLAYER_COLORS,
  PLAYER_SIZE,
  PLAYER_SPEED,
  SERVER_TICK_RATE,
} from "./game.constants.js";

export {
  getMovementDelta,
  applyPlayerMovement,
  getDirectionFromInput,
  isPlayerMoving,
} from "./game.movement.js";

export { TOWN_01_MAP } from "./maps/generated/town-01.js";

export { isPositionWalkable, resolveMapCollision } from "./maps/collision.js";

export type { CollisionMap, Position } from "./maps/collision.js";

export { PLAYER_AVATAR_IDS, isPlayerAvatarId } from "./player/avatar.js";
export type { PlayerAvatarId } from "./player/avatar.js";

export type {
  ChatMessage,
  ChatMessageInput,
  ChatMessageSender,
} from "./chat.js";
export {
  CHAT_EVENTS,
  CHAT_MESSAGE_MAX_LENGTH,
  isChatMessageInput,
} from "./chat.js";

export type {
  MapId,
  MapTransitionInput,
  MapTransitionResolved,
} from "./map.js";
export {
  MAP_IDS,
  DEFAULT_MAP_ID,
  MAP_TRANSITION_ID_MAX_LENGTH,
  MAP_EVENTS,
  isMapTransitionInput,
} from "./map.js";

export type {
  SharedMapData,
  SharedMapSpawn,
  SharedMapTransition,
  SharedMapTransitionTrigger,
} from "./mapDataRegistry.js";
export { MAP_DATA_REGISTRY } from "./mapDataRegistry.js";

export type {
  PokemonType,
  PokemonSpecies,
  PokemonBaseStats,
  PokemonEvolutionNode,
  PokemonEvolutionChain,
  PokemonMove,
  PokemonDamageClass,
  PokemonAbility,
  PokemonAbilitySet,
  PokemonAbilitySlot,
  PokemonForm,
  PokemonLearnset,
  PokemonLevelUpMove,
  PokemonTypeEffectiveness,
  PokemonInstance,
  PokemonInstanceMove,
  PokemonParty,
  PokemonTrainerState,
} from "./pokemon/pokemon.types.js";
export { MAX_POKEMON_PARTY_SIZE } from "./pokemon/pokemon.types.js";

export { getPokemonSpecies } from "./pokemon/pokemon.registry.js";
export {
  getTypeEffectiveness,
  getCombinedTypeEffectiveness,
} from "./pokemon/pokemon-type.registry.js";
export {
  getPokemonEvolutionChain,
  getPokemonEvolutionChainCount,
} from "./pokemon/pokemon-evolution.registry.js";
export {
  getPokemonForm,
  getPokemonFormsBySpecies,
  getAllPokemonForms,
  getPokemonFormCount,
} from "./pokemon/pokemon-form.registry.js";
export {
  getPokemonLearnset,
  getPokemonLearnsetCount,
} from "./pokemon/pokemon-learnset.registry.js";
export {
  getPokemonMove,
  getAllPokemonMoves,
  getPokemonMoveCount,
} from "./pokemon/pokemon-move.registry.js";
export {
  getAllPokemonAbilitySets,
  getPokemonAbilitySet,
  getPokemonAbilitySetCount,
} from "./pokemon/pokemon-ability-set.registry.js";

// Pokemon Party
export { createPokemonInstance } from "./pokemon/pokemon-instance.factory.js";
export {
  createPokemonParty,
  getPokemonPartySize,
  isPokemonPartyFull,
  hasPokemonInstance,
  addPokemonToParty,
  removePokemonFromParty,
} from "./pokemon/pokemon-party.js";
export { POKEMON_EVENTS } from "./pokemon/pokemon-network.js";
export type { PokemonTrainerStatePayload } from "./pokemon/pokemon-network.js";

// Pokemon Starters
export {
  POKEMON_STARTERS,
  isPokemonStarterId,
  isPokemonStarterChoiceInput,
} from "./pokemon/pokemon-starter.js";
export type {
  PokemonStarterId,
  PokemonStarterChoiceInput,
} from "./pokemon/pokemon-starter.js";
