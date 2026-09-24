import type {
  BattleDeferredStatusMoveEffect,
  BattleDirectStatusMoveEffect,
  BattleMoveStatusCondition,
  BattleRandomStatusMoveEffect,
  BattleStatusMoveDefinition,
} from "./pokemon-battle-status-move.types.js";

function direct(
  status: BattleMoveStatusCondition,
  chancePercent: number,
  rollScope: BattleDirectStatusMoveEffect["rollScope"] = "once-per-move",
): BattleDirectStatusMoveEffect {
  return {
    kind: "direct",
    status,
    target: "opponent",
    chancePercent,
    rollScope,
  };
}

function randomOneOf(
  statuses: readonly BattleMoveStatusCondition[],
  chancePercent: number,
): BattleRandomStatusMoveEffect {
  return {
    kind: "random-one-of",
    statuses,
    target: "opponent",
    chancePercent,
    rollScope: "once-per-move",
  };
}

function deferred(
  mechanic: BattleDeferredStatusMoveEffect["mechanic"],
  statuses: readonly BattleMoveStatusCondition[],
  reason: string,
  target: BattleDeferredStatusMoveEffect["target"] = "opponent",
): BattleDeferredStatusMoveEffect {
  return {
    kind: "deferred",
    mechanic,
    statuses,
    target,
    reason,
  };
}

/**
 * Status Conditions V1 move metadata for the current move dataset.
 *
 * This table is DATA ONLY. It does not mutate Battle state, consume RNG or
 * decide immunities. Server-authoritative application belongs to Step 3.
 *
 * Move accuracy remains owned by the existing move-accuracy pipeline. The
 * chancePercent here is the status-effect chance AFTER the move succeeds.
 */
const BATTLE_STATUS_MOVE_DEFINITIONS: readonly BattleStatusMoveDefinition[] = [
  // -------------------------------------------------------------------------
  // Burn
  // -------------------------------------------------------------------------
  { moveId: 7, effects: [direct("burn", 10)] }, // Fire Punch
  { moveId: 52, effects: [direct("burn", 10)] }, // Ember
  { moveId: 53, effects: [direct("burn", 10)] }, // Flamethrower
  { moveId: 126, effects: [direct("burn", 10)] }, // Fire Blast
  { moveId: 172, effects: [direct("burn", 10)] }, // Flame Wheel
  { moveId: 221, effects: [direct("burn", 50)] }, // Sacred Fire
  { moveId: 257, effects: [direct("burn", 10)] }, // Heat Wave
  { moveId: 261, effects: [direct("burn", 100)] }, // Will-O-Wisp
  { moveId: 299, effects: [direct("burn", 10)] }, // Blaze Kick
  { moveId: 394, effects: [direct("burn", 10)] }, // Flare Blitz
  { moveId: 424, effects: [direct("burn", 10)] }, // Fire Fang
  { moveId: 436, effects: [direct("burn", 30)] }, // Lava Plume
  { moveId: 10008, effects: [direct("burn", 10)] }, // Shadow Fire

  // -------------------------------------------------------------------------
  // Poison / badly poisoned
  // -------------------------------------------------------------------------
  { moveId: 40, effects: [direct("poison", 30)] }, // Poison Sting
  { moveId: 41, effects: [direct("poison", 20, "per-hit")] }, // Twineedle
  { moveId: 77, effects: [direct("poison", 100)] }, // Poison Powder
  { moveId: 92, effects: [direct("badly-poisoned", 100)] }, // Toxic
  { moveId: 123, effects: [direct("poison", 40)] }, // Smog
  { moveId: 124, effects: [direct("poison", 30)] }, // Sludge
  { moveId: 139, effects: [direct("poison", 100)] }, // Poison Gas
  { moveId: 188, effects: [direct("poison", 30)] }, // Sludge Bomb
  { moveId: 305, effects: [direct("badly-poisoned", 50)] }, // Poison Fang
  { moveId: 342, effects: [direct("poison", 10)] }, // Poison Tail
  { moveId: 398, effects: [direct("poison", 30)] }, // Poison Jab
  { moveId: 440, effects: [direct("poison", 10)] }, // Cross Poison
  { moveId: 441, effects: [direct("poison", 30)] }, // Gunk Shot

  // -------------------------------------------------------------------------
  // Paralysis
  // -------------------------------------------------------------------------
  { moveId: 9, effects: [direct("paralysis", 10)] }, // Thunder Punch
  { moveId: 34, effects: [direct("paralysis", 30)] }, // Body Slam
  { moveId: 78, effects: [direct("paralysis", 100)] }, // Stun Spore
  { moveId: 84, effects: [direct("paralysis", 10)] }, // Thunder Shock
  { moveId: 85, effects: [direct("paralysis", 10)] }, // Thunderbolt
  { moveId: 86, effects: [direct("paralysis", 100)] }, // Thunder Wave
  { moveId: 87, effects: [direct("paralysis", 30)] }, // Thunder
  { moveId: 122, effects: [direct("paralysis", 30)] }, // Lick
  { moveId: 137, effects: [direct("paralysis", 100)] }, // Glare
  { moveId: 192, effects: [direct("paralysis", 100)] }, // Zap Cannon
  { moveId: 209, effects: [direct("paralysis", 30)] }, // Spark
  { moveId: 225, effects: [direct("paralysis", 30)] }, // Dragon Breath
  { moveId: 340, effects: [direct("paralysis", 30)] }, // Bounce
  { moveId: 344, effects: [direct("paralysis", 10)] }, // Volt Tackle
  { moveId: 395, effects: [direct("paralysis", 30)] }, // Force Palm
  { moveId: 422, effects: [direct("paralysis", 10)] }, // Thunder Fang
  { moveId: 435, effects: [direct("paralysis", 30)] }, // Discharge
  { moveId: 10004, effects: [direct("paralysis", 10)] }, // Shadow Bolt

  // -------------------------------------------------------------------------
  // Sleep
  // -------------------------------------------------------------------------
  { moveId: 47, effects: [direct("sleep", 100)] }, // Sing
  { moveId: 79, effects: [direct("sleep", 100)] }, // Sleep Powder
  { moveId: 95, effects: [direct("sleep", 100)] }, // Hypnosis
  { moveId: 142, effects: [direct("sleep", 100)] }, // Lovely Kiss
  { moveId: 147, effects: [direct("sleep", 100)] }, // Spore
  { moveId: 320, effects: [direct("sleep", 100)] }, // Grass Whistle
  { moveId: 464, effects: [direct("sleep", 100)] }, // Dark Void

  // -------------------------------------------------------------------------
  // Freeze
  // -------------------------------------------------------------------------
  { moveId: 8, effects: [direct("freeze", 10)] }, // Ice Punch
  { moveId: 58, effects: [direct("freeze", 10)] }, // Ice Beam
  { moveId: 59, effects: [direct("freeze", 10)] }, // Blizzard
  { moveId: 181, effects: [direct("freeze", 10)] }, // Powder Snow
  { moveId: 423, effects: [direct("freeze", 10)] }, // Ice Fang
  { moveId: 10006, effects: [direct("freeze", 10)] }, // Shadow Chill

  // -------------------------------------------------------------------------
  // Confusion
  // -------------------------------------------------------------------------
  { moveId: 48, effects: [direct("confusion", 100)] }, // Supersonic
  { moveId: 60, effects: [direct("confusion", 10)] }, // Psybeam
  { moveId: 93, effects: [direct("confusion", 10)] }, // Confusion
  { moveId: 109, effects: [direct("confusion", 100)] }, // Confuse Ray
  { moveId: 146, effects: [direct("confusion", 20)] }, // Dizzy Punch
  { moveId: 186, effects: [direct("confusion", 100)] }, // Sweet Kiss
  { moveId: 223, effects: [direct("confusion", 100)] }, // Dynamic Punch
  { moveId: 298, effects: [direct("confusion", 100)] }, // Teeter Dance (1v1 target)
  { moveId: 324, effects: [direct("confusion", 10)] }, // Signal Beam
  { moveId: 352, effects: [direct("confusion", 20)] }, // Water Pulse
  { moveId: 431, effects: [direct("confusion", 20)] }, // Rock Climb
  { moveId: 10016, effects: [direct("confusion", 100)] }, // Shadow Panic (1v1 target)

  // -------------------------------------------------------------------------
  // Multi-status direct move
  // -------------------------------------------------------------------------
  {
    moveId: 161, // Tri Attack
    effects: [
      randomOneOf(["burn", "freeze", "paralysis"], 20),
    ],
  },

  // -------------------------------------------------------------------------
  // Explicitly tracked special/composite cases.
  // These are intentionally NOT consumed by the generic Step 3 infliction
  // path until their prerequisite mechanics exist.
  // -------------------------------------------------------------------------
  {
    moveId: 156, // Rest
    effects: [
      deferred(
        "self-rest",
        ["sleep"],
        "Rest must heal to full, cure the previous major status and then apply fixed-duration self sleep atomically.",
        "self",
      ),
    ],
  },
  {
    moveId: 281, // Yawn
    effects: [
      deferred(
        "delayed-sleep",
        ["sleep"],
        "Yawn schedules sleep for a later turn and is cancelled by switching.",
      ),
    ],
  },
  {
    moveId: 374, // Fling
    effects: [
      deferred(
        "held-item-dependent",
        ["burn", "poison", "badly-poisoned", "paralysis"],
        "Fling status depends on the held item, which is not part of the generic move-status contract.",
      ),
    ],
  },
  {
    moveId: 375, // Psycho Shift
    effects: [
      deferred(
        "status-transfer",
        ["burn", "poison", "badly-poisoned", "paralysis", "sleep"],
        "Psycho Shift transfers the user's existing status instead of creating a fixed status effect.",
      ),
    ],
  },
  {
    moveId: 290, // Secret Power
    effects: [
      deferred(
        "terrain-dependent",
        ["burn", "poison", "paralysis", "sleep", "freeze", "confusion"],
        "Secret Power chooses its secondary effect from battlefield terrain/environment rules.",
      ),
    ],
  },
  {
    moveId: 390, // Toxic Spikes
    effects: [
      deferred(
        "entry-hazard",
        ["poison", "badly-poisoned"],
        "Toxic Spikes inflicts poison on a later switch-in and depends on hazard layer count.",
      ),
    ],
  },
  {
    moveId: 207, // Swagger
    effects: [
      deferred(
        "stat-stage-composite",
        ["confusion"],
        "Swagger must apply its Attack-stage change together with confusion; stat-stage mechanics are not part of Status V1 Step 2.",
      ),
    ],
  },
  {
    moveId: 260, // Flatter
    effects: [
      deferred(
        "stat-stage-composite",
        ["confusion"],
        "Flatter must apply its Special Attack-stage change together with confusion; stat-stage mechanics are not part of Status V1 Step 2.",
      ),
    ],
  },
  {
    moveId: 448, // Chatter
    effects: [
      deferred(
        "recording-dependent-confusion",
        ["confusion"],
        "Legacy Chatter confusion depends on recorded audio; the project has no recording mechanic or normalized replacement rule yet.",
      ),
    ],
  },
  {
    moveId: 37, // Thrash
    effects: [
      deferred(
        "fatigue-confusion",
        ["confusion"],
        "Thrash confuses the user only after its multi-turn rampage sequence completes.",
        "self",
      ),
    ],
  },
  {
    moveId: 80, // Petal Dance
    effects: [
      deferred(
        "fatigue-confusion",
        ["confusion"],
        "Petal Dance confuses the user only after its multi-turn rampage sequence completes.",
        "self",
      ),
    ],
  },
  {
    moveId: 200, // Outrage
    effects: [
      deferred(
        "fatigue-confusion",
        ["confusion"],
        "Outrage confuses the user only after its multi-turn rampage sequence completes.",
        "self",
      ),
    ],
  },
];

const BATTLE_STATUS_MOVE_REGISTRY = new Map<number, BattleStatusMoveDefinition>(
  BATTLE_STATUS_MOVE_DEFINITIONS.map((definition) => [
    definition.moveId,
    definition,
  ]),
);

export function getBattleStatusMoveDefinition(
  moveId: number,
): BattleStatusMoveDefinition | undefined {
  return BATTLE_STATUS_MOVE_REGISTRY.get(moveId);
}

export function getAllBattleStatusMoveDefinitions(): readonly BattleStatusMoveDefinition[] {
  return BATTLE_STATUS_MOVE_DEFINITIONS;
}

export function getBattleStatusMoveDefinitionCount(): number {
  return BATTLE_STATUS_MOVE_REGISTRY.size;
}

export function hasBattleStatusMoveDefinition(moveId: number): boolean {
  return BATTLE_STATUS_MOVE_REGISTRY.has(moveId);
}

/**
 * Effects safe for the generic Status Infliction Engine planned for Step 3.
 * Deferred/composite mechanics are excluded by construction.
 */
export function getBattleExecutableStatusMoveEffects(
  moveId: number,
): readonly (BattleDirectStatusMoveEffect | BattleRandomStatusMoveEffect)[] {
  return (
    getBattleStatusMoveDefinition(moveId)?.effects.filter(
      (
        effect,
      ): effect is BattleDirectStatusMoveEffect | BattleRandomStatusMoveEffect =>
        effect.kind !== "deferred",
    ) ?? []
  );
}

export function getBattleDeferredStatusMoveEffects(
  moveId: number,
): readonly BattleDeferredStatusMoveEffect[] {
  return (
    getBattleStatusMoveDefinition(moveId)?.effects.filter(
      (effect): effect is BattleDeferredStatusMoveEffect =>
        effect.kind === "deferred",
    ) ?? []
  );
}
