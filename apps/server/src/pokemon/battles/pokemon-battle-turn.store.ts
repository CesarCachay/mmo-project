import {
  addBattleTurnCommand,
  createBattleTurn,
  createNextBattleTurn,
  type BattleCommand,
  type BattleId,
  type BattleInstance,
  type BattleTurn,
} from '@cesar-mmo/shared';

export class PokemonBattleTurnStore {
  private readonly turnsByBattleId = new Map<BattleId, BattleTurn>();

  create(battle: BattleInstance): BattleTurn {
    const battleId = battle.battleId;

    if (this.turnsByBattleId.has(battleId)) {
      throw new Error(`Battle "${battleId}" already has an active turn`);
    }

    const turn = createBattleTurn(battle, 1);
    this.turnsByBattleId.set(battleId, turn);
    return turn;
  }

  advance(battle: BattleInstance): BattleTurn {
    const currentTurn = this.getByBattleId(battle.battleId);

    if (!currentTurn) {
      throw new Error(`Battle turn not found for battle "${battle.battleId}"`);
    }

    const nextTurn = createNextBattleTurn(battle, currentTurn);

    this.turnsByBattleId.set(battle.battleId, nextTurn);

    return nextTurn;
  }

  getByBattleId(battleId: BattleId): BattleTurn | undefined {
    return this.turnsByBattleId.get(battleId);
  }

  hasBattleTurn(battleId: BattleId): boolean {
    return this.turnsByBattleId.has(battleId);
  }

  submitCommand(battle: BattleInstance, command: BattleCommand): BattleTurn {
    const turn = this.turnsByBattleId.get(battle.battleId);

    if (!turn) {
      throw new Error(
        `Battle "${battle.battleId}" does not have an active turn`,
      );
    }

    const updatedTurn = addBattleTurnCommand(battle, turn, command);
    this.turnsByBattleId.set(battle.battleId, updatedTurn);
    return updatedTurn;
  }

  remove(battleId: BattleId): void {
    this.turnsByBattleId.delete(battleId);
  }

  clear(): void {
    this.turnsByBattleId.clear();
  }
}
