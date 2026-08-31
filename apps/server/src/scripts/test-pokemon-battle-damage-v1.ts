import assert from 'node:assert/strict';

import {
  calculateBattleMoveDamage,
  calculateBattleNonHpStat,
  createBattleCommand,
  createBattleMoveExecutionContext,
  createPokemonInstance,
  resolveBattleDamageRandomModifier,
  type BattleParticipant,
  type BattleTurnResolutionEntry,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session.js';

const TACKLE = 33;

const EMBER = 52;

const THUNDER_SHOCK = 84;

function getParticipant(
  participants: readonly BattleParticipant[],

  type: 'trainer' | 'wild',
): BattleParticipant {
  const participant = participants.find((candidate) => candidate.type === type);

  assert.ok(participant);

  return participant;
}

function createDamageContext(
  actorSpeciesId: number,

  targetSpeciesId: number,

  moveId: number,
) {
  const actor = createPokemonInstance(actorSpeciesId, 5);

  const target = createPokemonInstance(targetSpeciesId, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: `damage-player-${globalThis.crypto.randomUUID()}`,

    trainerId: `damage-trainer-${globalThis.crypto.randomUUID()}`,

    mapId: 'route-01',

    zoneId: 'route-grass-zone-01',

    encounterTableId: 'town-grass',

    pokemon: target,

    status: 'active',
  };

  const battle = createWildBattleInstance({
    encounterSession,

    trainerPokemon: [actor],
  });

  const trainer = getParticipant(battle.participants, 'trainer');

  const trainerPokemon = trainer.pokemon[trainer.activePokemonIndex];

  assert.ok(trainerPokemon);

  trainerPokemon.pokemon.moves = [
    {
      moveId,

      currentPp: 10,
    },
  ];

  const command = createBattleCommand(battle, {
    participantId: trainer.id,

    action: {
      type: 'use-move',

      moveId,
    },
  });

  const entry: BattleTurnResolutionEntry = {
    command,

    movePriority: 0,

    speed: 1,

    tieBreaker: 0,
  };

  return createBattleMoveExecutionContext(battle, entry);
}

function testDerivedStat(): void {
  assert.equal(calculateBattleNonHpStat(100, 50), 105);

  assert.equal(calculateBattleNonHpStat(52, 5), 10);

  console.log('✅ Level-derived Battle stats');
}

function testDamageRandom(): void {
  assert.equal(
    resolveBattleDamageRandomModifier(() => 0),
    0.85,
  );

  assert.equal(
    resolveBattleDamageRandomModifier(() => 0.999999),
    1,
  );

  assert.throws(() => {
    resolveBattleDamageRandomModifier(() => 1);
  }, /RNG must return/);

  console.log('✅ Damage random range 85%-100%');
}

function testStabAndSuperEffective(): void {
  //
  // Charmander → Ember → Bulbasaur
  //
  // Fire user + Fire move = STAB.
  //
  // Fire → Grass = super effective.
  //

  const context = createDamageContext(4, 1, EMBER);

  const result = calculateBattleMoveDamage(
    context,

    // Force 100%.
    () => 0.999999,
  );

  assert.equal(result.stabMultiplier, 1.5);

  assert.equal(result.typeEffectiveness, 2);

  assert.equal(result.randomModifier, 1);

  assert.ok(result.damage > result.baseDamage);

  console.log('✅ STAB applied');

  console.log('✅ Super-effective damage applied');
}

function testResistance(): void {
  //
  // Charmander Ember → Squirtle
  //
  // Fire → Water = 0.5.
  //

  const context = createDamageContext(4, 7, EMBER);

  const result = calculateBattleMoveDamage(context, () => 0.999999);

  assert.equal(result.stabMultiplier, 1.5);

  assert.equal(result.typeEffectiveness, 0.5);

  console.log('✅ Resistant target multiplier applied');
}

function testNoStab(): void {
  //
  // Charmander uses Normal Tackle.
  //

  const context = createDamageContext(4, 7, TACKLE);

  const result = calculateBattleMoveDamage(context, () => 0.999999);

  assert.equal(result.stabMultiplier, 1);

  console.log('✅ Non-STAB move remains 1x');
}

function testImmunity(): void {
  //
  // Pikachu Thunder Shock
  // vs Geodude Rock/Ground.
  //
  // Electric → Ground = 0.
  //

  const context = createDamageContext(25, 74, THUNDER_SHOCK);

  const result = calculateBattleMoveDamage(context, () => 0.999999);

  assert.equal(result.typeEffectiveness, 0);

  assert.equal(result.damage, 0);

  console.log('✅ Type immunity produces exactly 0 damage');
}

function testPhysicalUsesDerivedStats(): void {
  const context = createDamageContext(4, 7, TACKLE);

  const result = calculateBattleMoveDamage(context, () => 0.999999);

  //
  // Charmander base Attack 52,
  // Lv5 simplified Battle Attack = 10.
  //

  assert.equal(result.attack, 10);

  //
  // Squirtle base Defense 65,
  // Lv5 simplified Battle Defense = 11.
  //

  assert.equal(result.defense, 11);

  console.log('✅ Physical damage uses calculated Attack / Defense');
}

function main(): void {
  testDerivedStat();

  testDamageRandom();

  testStabAndSuperEffective();

  testResistance();

  testNoStab();

  testImmunity();

  testPhysicalUsesDerivedStats();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon Battle Damage V1 smoke test passed');

  console.log('============================================');
}

main();
