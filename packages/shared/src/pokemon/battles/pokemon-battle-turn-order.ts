import { getPokemonFormsBySpecies } from "../pokemon-form.registry.js";

import { getPokemonMove } from "../pokemon-move.registry.js";

import { getActiveBattlePokemon } from "./pokemon-battle-participant.js";

import { isBattleTurnReady, type BattleTurn } from "./pokemon-battle-turn.js";

import type { BattleCommand } from "./pokemon-battle-command.js";

import type { BattleId, BattleInstance } from "./pokemon-battle.types.js";

export type BattleTurnOrderRandomSource = () => number;

export interface BattleTurnResolutionEntry {
  readonly command: BattleCommand;
  readonly actionPriority: number;
  readonly movePriority: number;
  readonly speed: number;
  readonly tieBreaker: number;
}

export interface BattleTurnResolutionOrder {
  readonly battleId: BattleId;
  readonly turnNumber: number;
  readonly entries: readonly BattleTurnResolutionEntry[];
}

export function createBattleTurnResolutionOrder(
  battle: BattleInstance,
  turn: BattleTurn,
  random: BattleTurnOrderRandomSource
): BattleTurnResolutionOrder {
  if (turn.battleId !== battle.battleId) {
    throw new Error(`Turn ${turn.number} does not belong to battle "${battle.battleId}"`);
  }

  if (!isBattleTurnReady(battle, turn)) {
    throw new Error(
      `Battle turn ${turn.number} for battle "${battle.battleId}" is not ready`
    );
  }

  const entries = turn.commands.map((command) =>
    createResolutionEntry(battle, command, random)
  );

  entries.sort(compareResolutionEntries);

  return {
    battleId: battle.battleId,
    turnNumber: turn.number,
    entries,
  };
}

function createResolutionEntry(
  battle: BattleInstance,
  command: BattleCommand,
  random: BattleTurnOrderRandomSource
): BattleTurnResolutionEntry {
  const participant = battle.participants.find(
    (candidate) => candidate.id === command.participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${command.participantId}" not found in battle "${battle.battleId}"`
    );
  }

  const activePokemon = getActiveBattlePokemon(participant);

  const actionPriority = getCommandActionPriority(command);

  const movePriority = getCommandMovePriority(command);

  const speed = getBattlePokemonSpeed(
    activePokemon.pokemon.speciesId,
    activePokemon.pokemon.formId,
    activePokemon.pokemon.level
  );

  const tieBreaker = random();

  if (!Number.isFinite(tieBreaker) || tieBreaker < 0 || tieBreaker >= 1) {
    throw new Error(`Invalid battle turn order random value "${tieBreaker}"`);
  }

  return {
    command,
    actionPriority,
    movePriority,
    speed,
    tieBreaker,
  };
}

function getCommandActionPriority(command: BattleCommand): number {
  switch (command.action.type) {
    case "switch-pokemon":
    case "run":
    case "use-item":
      return 1;

    case "use-move":
      return 0;
  }
}

function getCommandMovePriority(command: BattleCommand): number {
  switch (command.action.type) {
    case "switch-pokemon":
    case "run":
    case "use-item":
      return 0;

    case "use-move": {
      const move = getPokemonMove(command.action.moveId);

      if (!move) {
        throw new Error(
          `Pokémon move "${command.action.moveId}" not found while resolving battle turn order`
        );
      }

      return move.priority;
    }
  }
}

function getBattlePokemonSpeed(speciesId: number, formId: number, level: number): number {
  const forms = getPokemonFormsBySpecies(speciesId);

  const form = forms.find((candidate) => candidate.formId === formId);

  if (!form) {
    throw new Error(
      `Pokémon form "${formId}" not found for species "${speciesId}" while resolving battle Speed`
    );
  }

  return calculateBattleSpeed(form.baseStats.speed, level);
}

function calculateBattleSpeed(baseSpeed: number, level: number): number {
  return Math.floor((2 * baseSpeed * level) / 100) + 5;
}

function compareResolutionEntries(
  left: BattleTurnResolutionEntry,
  right: BattleTurnResolutionEntry
): number {
  // 1. Higher action category priority acts first.
  if (left.actionPriority !== right.actionPriority) {
    return right.actionPriority - left.actionPriority;
  }

  // 2. Within the same action category, higher move priority acts first.
  if (left.movePriority !== right.movePriority) {
    return right.movePriority - left.movePriority;
  }

  // 3. Higher Speed acts first.
  if (left.speed !== right.speed) {
    return right.speed - left.speed;
  }

  // 4. Exact tie: server-provided RNG decides.
  return right.tieBreaker - left.tieBreaker;
}
