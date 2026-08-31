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

export type { ChatMessage, ChatMessageInput, ChatMessageSender } from "./chat.js";
export { CHAT_EVENTS, CHAT_MESSAGE_MAX_LENGTH, isChatMessageInput } from "./chat.js";

export type { MapId, MapTransitionInput, MapTransitionResolved } from "./map.js";
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
  SharedMapNpc,
  SharedMapEncounterZone,
  SharedMapEncounterZoneBounds,
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
  PokemonFollowerPublicState,
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
export {
  POKEMON_EVENTS,
  isPokemonWildEncounterStartedPayload,
  isPokemonBattleReplacementInput,
  isPokemonBattleReplacementResolvedPayload,
  isPokemonBattleCompletedPayload,
} from "./pokemon/pokemon-network.js";
export type {
  PokemonTrainerStatePayload,
  PokemonStarterSelectionStatus,
  PokemonTrainerSessionPayload,
  PokemonWildEncounterStartedPayload,
  PokemonBattleReplacementInput,
  PokemonBattleReplacementResolvedPayload,
  PokemonBattleCompletedOutcome,
  PokemonBattleCompletedPayload,
} from "./pokemon/pokemon-network.js";

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

// Dialogue with NPCs
export {
  DIALOGUE_EVENTS,
  isDialogueAdvanceInput,
  isDialogueStartInput,
} from "./dialogue-network.js";
export type {
  DialogueStartInput,
  DialogueAdvanceInput,
  DialogueSessionState,
} from "./dialogue-network.js";
export type { DialogueId, DialogueDefinition } from "./dialogue.js";
export { DIALOGUES, getDialogue } from "./dialogue.js";

// Pokemon Encounter
export {
  PokemonEncounterEntry,
  PokemonEncounterTable,
  PokemonEncounterZone,
  WildPokemonEncounter,
} from "./pokemon/encounters/pokemon-encounter.types.js";
export {
  POKEMON_ENCOUNTER_TABLES,
  type PokemonEncounterTableId,
} from "./pokemon/encounters/pokemon-encounter-table.registry.js";
export {
  selectWeightedEncounterEntry,
  type PokemonEncounterRng,
} from "./pokemon/encounters/pokemon-encounter-selection.js";
export { rollPokemonEncounterLevel } from "./pokemon/encounters/pokemon-encounter-level.js";
export { createWildPokemonEncounter } from "./pokemon/encounters/pokemon-wild-encounter.factory.js";

// Battles
export {
  BattleId,
  BattleType,
  BattleStatus,
  BattleSide,
  BattleParticipantId,
  BattleParticipantType,
  BattlePokemonState,
  BattleParticipant,
  BattleInstance,
} from "./pokemon/battles/pokemon-battle.types.js";
export {
  createBattleParticipant,
  getActiveBattlePokemon,
} from "./pokemon/battles/pokemon-battle-participant.js";
export type { CreateBattleParticipantInput } from "./pokemon/battles/pokemon-battle-participant.js";
export { createBattlePokemonState } from "./pokemon/battles/pokemon-battle-pokemon-state.js";
export {
  isBattleActive,
  completeBattle,
} from "./pokemon/battles/pokemon-battle-lifecycle.js";
export {
  isPokemonBattleStartedPayload,
  isPokemonBattleCommandInput,
} from "./pokemon/battles/pokemon-battle-network.js";
export type {
  PokemonBattleStartedPayload,
  PokemonBattleCommandInput,
} from "./pokemon/battles/pokemon-battle-network.js";
export { createBattleCommand } from "./pokemon/battles/pokemon-battle-command.js";
export type {
  BattleUseMoveAction,
  BattleCommandAction,
  BattleCommand,
  CreateBattleCommandInput,
} from "./pokemon/battles/pokemon-battle-command.js";
export { BattleTurn, BattleTurnNumber } from "./pokemon/battles/pokemon-battle-turn.js";
export {
  createBattleTurn,
  addBattleTurnCommand,
  hasBattleTurnCommand,
  isBattleTurnReady,
  createNextBattleTurn,
} from "./pokemon/battles/pokemon-battle-turn.js";
export { createBattleTurnResolutionOrder } from "./pokemon/battles/pokemon-battle-turn-order.js";
export type {
  BattleTurnOrderRandomSource,
  BattleTurnResolutionEntry,
  BattleTurnResolutionOrder,
} from "./pokemon/battles/pokemon-battle-turn-order.js";
export { createBattleMoveExecutionContext } from "./pokemon/battles/pokemon-battle-move-execution.js";
export type { BattleMoveExecutionContext } from "./pokemon/battles/pokemon-battle-move-execution.js";
export { resolveBattleMoveAccuracy } from "./pokemon/battles/pokemon-battle-move-accuracy.js";
export type {
  BattleAccuracyRandomSource,
  BattleMoveAccuracyResult,
} from "./pokemon/battles/pokemon-battle-move-accuracy.js";
export { consumeBattleMovePp } from "./pokemon/battles/pokemon-battle-move-pp.js";
export type { BattleMovePpConsumptionResult } from "./pokemon/battles/pokemon-battle-move-pp.js";
export {
  calculateBattleMoveDamage,
  resolveBattleDamageRandomModifier,
} from "./pokemon/battles/pokemon-battle-move-damage.js";
export type {
  BattleMoveDamageResult,
  BattleMoveDamageRandomSource,
} from "./pokemon/battles/pokemon-battle-move-damage.js";
export { applyBattleMoveDamage } from "./pokemon/battles/pokemon-battle-move-damage-application.js";
export type { BattleMoveDamageApplicationResult } from "./pokemon/battles/pokemon-battle-move-damage-application.js";
export {
  isBattlePokemonAbleToAct,
  isBattlePokemonFainted,
} from "./pokemon/battles/pokemon-battle-faint.js";
export { evaluateBattleMoveExecutionEligibility } from "./pokemon/battles/pokemon-battle-move-execution-eligibility.js";
export type {
  BattleMoveExecutionEligibility,
  BattleMoveExecutionSkipReason,
} from "./pokemon/battles/pokemon-battle-move-execution-eligibility.js";
export {
  getBattleParticipantReplacementPokemonIndexes,
  getBattleParticipantUsablePokemonIndexes,
  isBattleParticipantDefeated,
  hasBattleParticipantUsablePokemon,
} from "./pokemon/battles/pokemon-battle-participant-defeat.js";
export { resolveWildBattleContinuationOutcome } from "./pokemon/battles/pokemon-battle-continuation.js";
export type { WildBattleContinuationOutcome } from "./pokemon/battles/pokemon-battle-continuation.js";
export { replaceFaintedTrainerBattlePokemon } from "./pokemon/battles/pokemon-battle-participant-replacement.js";
export type { BattleTrainerPokemonReplacementResult } from "./pokemon/battles/pokemon-battle-participant-replacement.js";
export { calculateBattleNonHpStat } from "./pokemon/battles/pokemon-battle-stat.js";
export { syncPokemonPartyFromBattleParticipant } from "./pokemon/battles/pokemon-battle-trainer-party-sync.js";
