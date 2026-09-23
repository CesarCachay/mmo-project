export type { Player, PlayerInput, Direction } from "./game.types.js";

export { PLAYER_SIZE, PLAYER_SPEED, SERVER_TICK_RATE } from "./game.constants.js";

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
  SharedMapStorageTerminal,
  SharedMapHealingStation,
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
  PokemonEvolutionDetail,
} from "./pokemon/pokemon.types.js";
export {
  MAX_POKEMON_PARTY_SIZE,
  MAX_POKEMON_MOVE_SLOTS,
} from "./pokemon/pokemon.types.js";

export { getPokemonSpecies } from "./pokemon/pokemon.registry.js";
export {
  getTypeEffectiveness,
  getCombinedTypeEffectiveness,
} from "./pokemon/pokemon-type.registry.js";
export {
  getPokemonEvolutionChain,
  getPokemonEvolutionChainCount,
  getPokemonEvolutionNode,
  getPokemonDirectEvolutions,
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
  hasPokemonPartyUsablePokemon,
  isPokemonPartyWiped,
} from "./pokemon/pokemon-party.js";
export {
  POKEMON_EVENTS,
  isPokemonWildEncounterStartedPayload,
  isPokemonBattleReplacementInput,
  isPokemonBattleReplacementResolvedPayload,
  isPokemonBattleCompletedPayload,
  isPokemonBattleStateUpdatedPayload,
  isPokemonStarterSelectedPayload,
} from "./pokemon/pokemon-network.js";
export type {
  PokemonTrainerStatePayload,
  PokemonStarterSelectionStatus,
  PokemonStarterSelectedPayload,
  PokemonWildEncounterStartedPayload,
  PokemonBattleReplacementInput,
  PokemonBattleReplacementResolvedPayload,
  PokemonBattleCompletedOutcome,
  PokemonBattleCompletedPayload,
  PokemonGymBadgeAward,
  PokemonTrainerBattleCompletionRewards,
  PokemonBattleInteractionState,
  PokemonBattleStateUpdatedPayload,
} from "./pokemon/pokemon-network.js";

// Pokemon Starters
export {
  POKEMON_STARTERS,
  POKEMON_STARTER_REWARD_ITEMS,
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

// Trainer Battles
export {
  POKEMON_TRAINER_BATTLE_REGISTRY,
  isPokemonTrainerBattleId,
  getPokemonTrainerBattleDefinition,
  findPokemonTrainerBattleDefinition,
  getAllPokemonTrainerBattleDefinitions,
} from "./pokemon/trainers/pokemon-trainer-battle.registry.js";
export type { PokemonTrainerBattleId } from "./pokemon/trainers/pokemon-trainer-battle.registry.js";
export type {
  PokemonTrainerBattleAiProfileId,
  PokemonTrainerBattleCategory,
  PokemonGymLeaderBattleMetadata,
  PokemonTrainerBattlePokemonDefinition,
  PokemonTrainerBattleDefinition,
} from "./pokemon/trainers/pokemon-trainer-battle.types.js";
export {
  isPokemonTrainerBattleStartInput,
} from "./pokemon/trainers/pokemon-trainer-battle-network.js";
export type {
  PokemonTrainerBattleStartInput,
} from "./pokemon/trainers/pokemon-trainer-battle-network.js";
export { validatePokemonTrainerBattleDefinition } from "./pokemon/trainers/pokemon-trainer-battle.validation.js";
export type { PokemonTrainerBattleValidationIssue } from "./pokemon/trainers/pokemon-trainer-battle.validation.js";
export {
  POKEMON_GYM_REGISTRY,
  POKEMON_GYM_BADGE_REGISTRY,
  isPokemonGymId,
  isPokemonGymBadgeId,
  getPokemonGymDefinition,
  getPokemonGymBadgeDefinition,
} from "./pokemon/trainers/pokemon-gym.registry.js";
export type {
  PokemonGymId,
  PokemonGymBadgeId,
  PokemonGymLeaderPresentationId,
  PokemonGymDefinition,
  PokemonGymBadgeDefinition,
} from "./pokemon/trainers/pokemon-gym.types.js";
export {
  checkPokemonTrainerSight,
  POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR,
} from "./pokemon/trainers/pokemon-trainer-sight.js";
export type {
  PokemonTrainerSightSource,
  PokemonTrainerSightCheckInput,
  PokemonTrainerSightResult,
} from "./pokemon/trainers/pokemon-trainer-sight.js";

// Battles
export {
  BattleId,
  BattleType,
  BattleStatus,
  BattleSide,
  BattleParticipantId,
  BattleParticipantType,
  BattleWeatherType,
  BattleWeatherState,
  BattleSideHazards,
  BattleFieldEffectsState,
  BattleFieldState,
  BattlePokemonState,
  BattleParticipant,
  BattleInstance,
  WildBattleInstance,
  TrainerBattleInstance,
} from "./pokemon/battles/pokemon-battle.types.js";
export {
  createBattleParticipant,
  getActiveBattlePokemon,
  getBattleParticipantById,
  getOpposingBattleParticipant,
} from "./pokemon/battles/pokemon-battle-participant.js";
export type { CreateBattleParticipantInput } from "./pokemon/battles/pokemon-battle-participant.js";
export { createBattlePokemonState } from "./pokemon/battles/pokemon-battle-pokemon-state.js";
export {
  PERSISTENT_BATTLEFIELD_MOVE_IDS,
  createEmptyBattleSideHazards,
  createEmptyBattleFieldState,
  ensureBattleFieldState,
  applyPersistentBattlefieldMove,
  advanceBattleFieldStateTurn,
  hasPersistentBattleFieldEffects,
} from "./pokemon/battles/pokemon-battle-field-state.js";
export {
  isBattleActive,
  completeBattle,
  isWildBattleInstance,
  isTrainerBattleInstance,
} from "./pokemon/battles/pokemon-battle-lifecycle.js";
export {
  isPokemonBattleInstance,
  isPokemonBattleStartedPayload,
  isPokemonBattleCommandInput,
} from "./pokemon/battles/pokemon-battle-network.js";
export type {
  PokemonBattleStartedPayload,
  PokemonBattleCommandInput,
  PokemonBattlePresentationContext,
  PokemonWildBattlePresentationContext,
  PokemonStandardTrainerBattlePresentationContext,
  PokemonGymLeaderBattlePresentationContext,
} from "./pokemon/battles/pokemon-battle-network.js";
export {
  createBattleCommand,
  POKEMON_STRUGGLE_MOVE_ID,
} from "./pokemon/battles/pokemon-battle-command.js";
export type {
  BattleUseMoveAction,
  BattleCommandAction,
  BattleRunAction,
  BattleStruggleAction,
  BattleUseItemAction,
  BattleUseItemTarget,
  BattleCommand,
  CreateBattleCommandInput,
  BattleSwitchPokemonAction,
} from "./pokemon/battles/pokemon-battle-command.js";
export {
  evaluatePokemonBattleRunRule,
  evaluatePokemonBattleItemRule,
  evaluatePokemonBattleCommandActionRule,
  assertPokemonBattleCommandActionAllowed,
} from "./pokemon/battles/pokemon-battle-rules.js";
export type {
  PokemonBattleRuleDecision,
  PokemonBattleRuleRejectionReason,
} from "./pokemon/battles/pokemon-battle-rules.js";
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
export {
  getBattleMoveMultiHitRule,
  resolveBattleMoveHitCount,
} from "./pokemon/battles/pokemon-battle-multi-hit.js";
export type {
  BattleMoveMultiHitRule,
  BattleMultiHitRandomSource,
} from "./pokemon/battles/pokemon-battle-multi-hit.js";
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
export { resolveTrainerBattleContinuationOutcome } from "./pokemon/battles/pokemon-trainer-battle-continuation.js";
export type { TrainerBattleContinuationOutcome } from "./pokemon/battles/pokemon-trainer-battle-continuation.js";
export { replaceFaintedTrainerBattlePokemon } from "./pokemon/battles/pokemon-battle-participant-replacement.js";
export type { BattleTrainerPokemonReplacementResult } from "./pokemon/battles/pokemon-battle-participant-replacement.js";
export { calculateBattleNonHpStat } from "./pokemon/battles/pokemon-battle-stat.js";
export { syncPokemonPartyFromBattleParticipant } from "./pokemon/battles/pokemon-battle-trainer-party-sync.js";
export { isBattlePresentationEvent } from "./pokemon/battles/pokemon-battle-presentation.js";
export type {
  BattleMoveUsedEvent,
  BattleMoveMissedEvent,
  BattleDamageAppliedEvent,
  BattlePokemonFaintedEvent,
  BattlePokemonSwitchedEvent,
  BattleRunFailedEvent,
  BattleRunSucceededEvent,
  BattlePresentationEvent,
  BattleItemUsedEvent,
  BattleHpRestoredEvent,
  BattleCaptureFailedPresentationEvent,
  BattleCaptureSucceededPresentationEvent,
  BattleExperienceGainedEvent,
  BattlePokemonLeveledUpEvent,
  BattleMoveLearningRequiredEvent,
  BattleEvolutionRequiredEvent,
} from "./pokemon/battles/pokemon-battle-presentation.js";
export { isPokemonBattleTurnResolvedPayload } from "./pokemon/battles/pokemon-battle-presentation-network.js";
export type { PokemonBattleTurnResolvedPayload } from "./pokemon/battles/pokemon-battle-presentation-network.js";
export { resolveBattleRunAttempt } from "./pokemon/battles/run/pokemon-battle-run.js";
export type {
  BattleRunRandomSource,
  BattleRunResolution,
} from "./pokemon/battles/run/pokemon-battle-run.js";

// ECONOMY
export {
  POKEMON_STARTING_MONEY,
  POKEMON_MAX_MONEY,
  isPokemonMoney,
  createPokemonMoney,
  addPokemonMoney,
  spendPokemonMoney,
  assertPokemonMoney,
} from "./pokemon/economy/pokemon-money.js";
export type { PokemonMoney } from "./pokemon/economy/pokemon-money.js";
export {
  POKEMON_ITEM_ECONOMY_REGISTRY,
  getPokemonItemEconomyDefinition,
  getPokemonItemBuyPrice,
  getPokemonItemSellPrice,
  isPokemonItemPurchasable,
  isPokemonItemSellable,
} from "./pokemon/economy/pokemon-item-economy.registry.js";
export type {
  PokemonItemEconomyDefinition,
} from "./pokemon/economy/pokemon-item-economy.registry.js";
export {
  POKEMON_SHOP_CATALOG_IDS,
  POKEMON_SHOP_CATALOG_REGISTRY,
  getPokemonShopCatalog,
  isPokemonShopCatalogId,
  isPokemonShopItemStocked,
} from "./pokemon/economy/shop/pokemon-shop.catalog.js";
export type {
  PokemonShopCatalogId,
  PokemonShopCatalogDefinition,
} from "./pokemon/economy/shop/pokemon-shop.catalog.js";
export {
  POKEMON_SHOP_MAX_TRANSACTION_QUANTITY,
  quotePokemonShopPurchase,
  quotePokemonShopSale,
  isPokemonShopTransactionQuantity,
  assertPokemonShopTransactionQuantity,
} from "./pokemon/economy/shop/pokemon-shop-pricing.js";
export type {
  PokemonShopPriceQuote,
} from "./pokemon/economy/shop/pokemon-shop-pricing.js";
export {
  POKEMON_SHOP_EVENTS,
  isPokemonShopOpenInput,
  isPokemonShopBuyInput,
  isPokemonShopSellInput,
  isPokemonShopCloseInput,
  isPokemonShopOpenedPayload,
  isPokemonShopPurchasedPayload,
  isPokemonShopSoldPayload,
  isPokemonShopClosedReason,
  isPokemonShopClosedPayload,
  isPokemonShopErrorCode,
  isPokemonShopErrorPayload,
} from "./pokemon/economy/shop/pokemon-shop-network.js";
export type {
  PokemonShopOpenInput,
  PokemonShopBuyInput,
  PokemonShopSellInput,
  PokemonShopCloseInput,
  PokemonShopOpenedPayload,
  PokemonShopPurchasedPayload,
  PokemonShopSoldPayload,
  PokemonShopClosedReason,
  PokemonShopClosedPayload,
  PokemonShopErrorCode,
  PokemonShopErrorPayload,
} from "./pokemon/economy/shop/pokemon-shop-network.js";

// INVENTORY
export {
  PokemonInventory,
  PokemonInventoryItemStack,
  PokemonItemId,
} from "./pokemon/inventory/pokemon-inventory.js";
export {
  POKEMON_ITEM_IDS,
  createPokemonInventory,
  getPokemonInventoryItemQuantity,
  setPokemonInventoryItemQuantity,
  consumePokemonInventoryItem,
  isPokemonItemId,
  addPokemonInventoryItem,
} from "./pokemon/inventory/pokemon-inventory.js";

// ITEMS
export {
  POKEMON_ITEM_REGISTRY,
  getPokemonItem,
} from "./pokemon/items/pokemon-item.registry.js";
export type {
  PokemonItemCategory,
  PokemonItemBattleTarget,
  PokemonItemEffect,
  PokemonItemDefinition,
} from "./pokemon/items/pokemon-item.registry.js";
export {
  calculatePokemonMaxHp,
  calculatePokemonNonHpStat,
  calculatePokemonDerivedStats,
} from "./pokemon/pokemon-stat.js";

export type { PokemonDerivedStats } from "./pokemon/pokemon-stat.js";
export { planBattleHealingItemUse } from "./pokemon/inventory/pokemon-battle-healing-item.js";
export type { BattleHealingItemPlan } from "./pokemon/inventory/pokemon-battle-healing-item.js";
export {
  POKEMON_OVERWORLD_ITEM_EVENTS,
  isPokemonOverworldItemUseInput,
  isPokemonOverworldItemUsedPayload,
  isPokemonOverworldItemErrorPayload,
} from "./pokemon/items/pokemon-overworld-item-network.js";
export type {
  PokemonOverworldItemUseInput,
  PokemonOverworldItemUsedPayload,
  PokemonOverworldItemErrorCode,
  PokemonOverworldItemErrorPayload,
} from "./pokemon/items/pokemon-overworld-item-network.js";

// CAPTURE
export { resolvePokemonCapture } from "./pokemon/battles/capture/pokemon-battle-capture.js";
export type {
  PokemonCaptureRandomSource,
  PokemonCaptureResolution,
  ResolvePokemonCaptureInput,
} from "./pokemon/battles/capture/pokemon-battle-capture.js";

// STORAGE
export { isPokemonStorageOpenInput } from "./pokemon/storage/pokemon-storage-network.js";
export type {
  PokemonStorageStatePayload,
  PokemonStorageOpenInput,
  PokemonStorageErrorCode,
  PokemonStorageErrorPayload,
} from "./pokemon/storage/pokemon-storage-network.js";
export { isPokemonStorageCommand } from "./pokemon/storage/pokemon-storage-command.js";
export type {
  PokemonStorageWithdrawCommand,
  PokemonStorageDepositCommand,
  PokemonStorageSwapCommand,
  PokemonStorageCommand,
} from "./pokemon/storage/pokemon-storage-command.js";
export { createPokemonStorage } from "./pokemon/storage/pokemon-storage.js";
export type { PokemonStorage } from "./pokemon/storage/pokemon-storage.js";

// PARTY RE-ORDER
export {
  POKEMON_PARTY_REORDER_EVENTS,
  isPokemonPartyReorderInput,
  isPokemonPartyReorderedPayload,
  isPokemonPartyReorderErrorCode,
  isPokemonPartyReorderErrorPayload,
} from "./pokemon/pokemon-party-reorder-network.js";
export type {
  PokemonPartyReorderInput,
  PokemonPartyReorderedPayload,
  PokemonPartyReorderErrorCode,
  PokemonPartyReorderErrorPayload,
} from "./pokemon/pokemon-party-reorder-network.js";

// PROGRESSION
export {
  POKEMON_GROWTH_RATES,
  isPokemonGrowthRate,
} from "./pokemon/progression/pokemon-growth-rate.js";
export type { PokemonGrowthRate } from "./pokemon/progression/pokemon-growth-rate.js";
export {
  MIN_POKEMON_LEVEL,
  MAX_POKEMON_LEVEL,
  getExperienceForLevel,
  getLevelFromExperience,
  getExperienceToNextLevel,
} from "./pokemon/progression/pokemon-experience.js";
export {
  getPokemonLevelExperienceRange,
  isPokemonExperienceCompatibleWithLevel,
  assertPokemonExperienceCompatibleWithLevel,
} from "./pokemon/progression/pokemon-progression-invariant.js";
export type { PokemonLevelExperienceRange } from "./pokemon/progression/pokemon-progression-invariant.js";
export { planPokemonExperienceGain } from "./pokemon/progression/pokemon-progression-plan.js";
export type {
  PlanPokemonExperienceGainInput,
  PokemonExperienceProgressionPlan,
} from "./pokemon/progression/pokemon-progression-plan.js";
export { planPokemonLevelStatTransition } from "./pokemon/progression/pokemon-level-stat-transition.js";
export type {
  PlanPokemonLevelStatTransitionInput,
  PokemonLevelStatTransition,
} from "./pokemon/progression/pokemon-level-stat-transition.js";
export { resolvePokemonLevelUpMoves } from "./pokemon/progression/pokemon-level-up-moves.js";
export type {
  PokemonLevelUpMoveCandidate,
  ResolvePokemonLevelUpMovesInput,
} from "./pokemon/progression/pokemon-level-up-moves.js";
export { resolvePokemonMoveLearningCandidate } from "./pokemon/progression/pokemon-move-learning.js";
export type {
  PokemonMoveLearningSkipReason,
  PokemonMoveLearningResolution,
  ResolvePokemonMoveLearningCandidateInput,
} from "./pokemon/progression/pokemon-move-learning.js";
export { resolvePokemonMoveLearningDecision } from "./pokemon/progression/pokemon-move-learning-decision.js";
export type {
  PokemonPendingMoveLearningResolution,
  PokemonMoveLearningDecision,
  PokemonMoveLearningDecisionResult,
  ResolvePokemonMoveLearningDecisionInput,
} from "./pokemon/progression/pokemon-move-learning-decision.js";
export { planPokemonMoveLearningSequence } from "./pokemon/progression/pokemon-move-learning-sequence.js";
export type {
  PlanPokemonMoveLearningSequenceInput,
  PokemonMoveLearningSequenceResult,
} from "./pokemon/progression/pokemon-move-learning-sequence.js";
export { planPokemonProgression } from "./pokemon/progression/pokemon-progression.js";
export type {
  PlanPokemonProgressionInput,
  PokemonProgressionPlan,
} from "./pokemon/progression/pokemon-progression.js";
// Pokémon Battle Experience
export { calculateWildBattleExperienceReward } from "./pokemon/progression/pokemon-experience-reward.js";
export type {
  CalculateWildBattleExperienceRewardInput,
  PokemonWildBattleExperienceReward,
} from "./pokemon/progression/pokemon-experience-reward.js";
export {
  POKEMON_SHARED_EXPERIENCE_RATIO,
  distributePokemonPartyExperience,
} from "./pokemon/progression/pokemon-party-experience.js";
export type {
  PokemonPartyExperienceSnapshot,
  PokemonPartyExperienceRewardReason,
  PokemonPartyExperienceReward,
  DistributePokemonPartyExperienceInput,
  PokemonPartyExperienceDistribution,
} from "./pokemon/progression/pokemon-party-experience.js";
export {
  isPokemonMoveLearningDecisionInput,
  isPokemonMoveLearningResolvedPayload,
  isPokemonMoveLearningErrorPayload,
  isPokemonEvolutionRequiredPayload,
  isPokemonEvolutionDecisionInput,
  isPokemonEvolutionResolvedPayload,
  isPokemonEvolutionErrorPayload,
} from "./pokemon/progression/pokemon-progression-network.js";
export type {
  PokemonPendingMoveLearningNetworkState,
  PokemonMoveLearningDecisionInput,
  PokemonMoveLearningResolvedPayload,
  PokemonMoveLearningErrorPayload,
  PokemonEvolutionResolvedPayload,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionDecisionInput,
  PokemonEvolutionErrorPayload,
} from "./pokemon/progression/pokemon-progression-network.js";

// EVOLUTION
export {
  evaluatePokemonLevelEvolution,
  isPokemonPureLevelEvolutionDetail,
} from "./pokemon/evolution/pokemon-evolution-eligibility.js";
export type {
  EvaluatePokemonLevelEvolutionInput,
  PokemonLevelEvolutionCandidate,
  PokemonLevelEvolutionIneligibilityReason,
  PokemonLevelEvolutionEvaluation,
} from "./pokemon/evolution/pokemon-evolution-eligibility.js";
export { planPokemonEvolution } from "./pokemon/evolution/pokemon-evolution-plan.js";
export type {
  PlanPokemonEvolutionInput,
  PokemonEvolutionAbilityTransition,
  PokemonEvolutionHpTransition,
  PokemonEvolutionPlan,
} from "./pokemon/evolution/pokemon-evolution-plan.js";
export { isPokemonEvolutionPresentation } from "./pokemon/evolution/pokemon-evolution-presentation.js";
export type { PokemonEvolutionPresentation } from "./pokemon/evolution/pokemon-evolution-presentation.js";
export type { PokemonEvolutionDecision } from "./pokemon/evolution/pokemon-evolution-decision.js";

// Centro Pokemon
export { planPokemonCenterHealing } from "./pokemon/healing/pokemon-center-healing.js";
export type { PokemonCenterHealingPlan } from "./pokemon/healing/pokemon-center-healing.js";
export {
  POKEMON_CENTER_HEALING_EVENTS,
  isPokemonCenterHealInput,
  isPokemonCenterHealedPayload,
  isPokemonCenterHealingErrorCode,
  isPokemonCenterHealingErrorPayload,
} from "./pokemon/healing/pokemon-center-healing-network.js";
export type {
  PokemonCenterHealInput,
  PokemonCenterHealedPayload,
  PokemonCenterHealingErrorCode,
  PokemonCenterHealingErrorPayload,
} from "./pokemon/healing/pokemon-center-healing-network.js";
