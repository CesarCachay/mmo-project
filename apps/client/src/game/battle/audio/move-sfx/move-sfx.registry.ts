import { getPokemonMove } from "@cesar-mmo/shared";

import { getBattleMoveVfxDefinition } from "../../vfx/move-vfx.registry";
import type {
  BattleMoveVfxArchetype,
  BattleMoveVfxSignaturePresetId,
} from "../../vfx/battle-move-vfx.types";
import type {
  BattleMoveSfxArchetypeId,
  BattleMoveSfxAssetId,
  BattleMoveSfxCoreId,
  BattleMoveSfxSignatureId,
} from "./move-sfx.assets";

export interface BattleMoveSfxProfile {
  readonly moveId: number;
  readonly useAssets: readonly BattleMoveSfxAssetId[];
  readonly impactAssets: readonly BattleMoveSfxAssetId[];
  readonly missAssets: readonly BattleMoveSfxAssetId[];
}

const HEAL_MOVE_IDS = new Set([105, 156, 355]); // Recover, Rest, Roost

const SIGNATURE_MOVE_ASSET = new Map<number, BattleMoveSfxSignatureId>([
  [63, "hyper-beam"],
  [87, "thunder"],
  [59, "blizzard"],
  [94, "psychic"],
  [434, "draco-meteor"],
  [467, "shadow-force"],
  [76, "solar-beam"],
  [89, "earthquake"],
  [57, "surf"],
  [370, "close-combat"],
  [413, "brave-bird"],
  [153, "explosion"],
]);

const SIGNATURE_BASE_ARCHETYPE: Readonly<Record<BattleMoveVfxSignaturePresetId, BattleMoveSfxArchetypeId>> = {
  thunderbolt: "beam",
  thunder: "burst",
  blizzard: "wave",
  psychic: "wave",
  "aura-sphere": "projectile",
  "dark-pulse": "wave",
  "dragon-pulse": "beam",
  "focus-blast": "projectile",
  "brave-bird": "contact",
  "close-combat": "melee",
  "leaf-storm": "wave",
  "draco-meteor": "multi-projectile",
  "air-slash": "melee",
  "flash-cannon": "beam",
  "stone-edge": "ground",
  "shadow-force": "melee",
};

const CHARGE_ARCHETYPES = new Set<BattleMoveSfxArchetypeId>([
  "beam",
  "stream",
  "barrier",
  "tether",
]);

const WHOOSH_ARCHETYPES = new Set<BattleMoveSfxArchetypeId>([
  "projectile",
  "contact",
  "melee",
  "multi-projectile",
]);

function resolveBaseArchetype(
  archetype: BattleMoveVfxArchetype,
  signaturePresetId?: BattleMoveVfxSignaturePresetId,
): BattleMoveSfxArchetypeId {
  if (archetype !== "signature") {
    return archetype;
  }

  return signaturePresetId ? SIGNATURE_BASE_ARCHETYPE[signaturePresetId] : "generic";
}

function resolveImpactCore(power: number | null, hitCount?: number): BattleMoveSfxCoreId {
  const effectivePower = (power ?? 0) * Math.max(1, Math.min(hitCount ?? 1, 3));

  if (effectivePower >= 100) {
    return "hit-heavy";
  }

  if (effectivePower >= 55) {
    return "hit-medium";
  }

  return "hit-soft";
}

function pushUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

export function getBattleMoveSfxProfile(
  moveId: number,
  hitCount?: number,
): BattleMoveSfxProfile | undefined {
  const move = getPokemonMove(moveId);
  const vfx = getBattleMoveVfxDefinition(moveId);

  if (!move || !vfx) {
    return undefined;
  }

  const signaturePresetId = vfx.archetype === "signature" ? vfx.presetId : undefined;
  const baseArchetype = resolveBaseArchetype(vfx.archetype, signaturePresetId);
  const useAssets: BattleMoveSfxAssetId[] = [];
  const impactAssets: BattleMoveSfxAssetId[] = [];

  const signatureAsset = SIGNATURE_MOVE_ASSET.get(moveId);
  if (signatureAsset) {
    pushUnique(useAssets, `signature/${signatureAsset}`);
  }

  pushUnique(useAssets, `archetype/${baseArchetype}`);

  if (CHARGE_ARCHETYPES.has(baseArchetype)) {
    pushUnique(useAssets, "core/charge");
  } else if (WHOOSH_ARCHETYPES.has(baseArchetype)) {
    pushUnique(useAssets, "core/whoosh");
  }

  if (move.damageClass === "status") {
    pushUnique(useAssets, HEAL_MOVE_IDS.has(moveId) ? "core/heal" : "core/buff");
    pushUnique(useAssets, `element/${vfx.element}`);
  } else {
    pushUnique(impactAssets, `core/${resolveImpactCore(move.power, hitCount)}`);
    pushUnique(impactAssets, `element/${vfx.element}`);
  }

  return {
    moveId,
    useAssets,
    impactAssets,
    missAssets: ["core/miss"],
  };
}
