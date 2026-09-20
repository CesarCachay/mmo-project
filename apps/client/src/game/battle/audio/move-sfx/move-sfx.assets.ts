import type {
  BattleMoveVfxArchetype,
  BattleMoveVfxElement,
} from "../../vfx/battle-move-vfx.types";

export type BattleMoveSfxCoreId =
  | "charge"
  | "whoosh"
  | "hit-soft"
  | "hit-medium"
  | "hit-heavy"
  | "miss"
  | "heal"
  | "buff";

export type BattleMoveSfxArchetypeId = Exclude<BattleMoveVfxArchetype, "signature">;
export type BattleMoveSfxElementId = BattleMoveVfxElement;
export type BattleMoveSfxSignatureId =
  | "hyper-beam"
  | "thunder"
  | "blizzard"
  | "psychic"
  | "draco-meteor"
  | "shadow-force"
  | "solar-beam"
  | "earthquake"
  | "surf"
  | "close-combat"
  | "brave-bird"
  | "explosion";

export type BattleMoveSfxAssetId =
  | `core/${BattleMoveSfxCoreId}`
  | `archetype/${BattleMoveSfxArchetypeId}`
  | `element/${BattleMoveSfxElementId}`
  | `signature/${BattleMoveSfxSignatureId}`;

export interface BattleMoveSfxAsset {
  readonly id: BattleMoveSfxAssetId;
  readonly key: string;
  readonly path: string;
  readonly volume: number;
}

const GROUP_VOLUME = {
  core: 0.36,
  archetype: 0.24,
  element: 0.22,
  signature: 0.32,
} as const;

export function getBattleMoveSfxAsset(id: BattleMoveSfxAssetId): BattleMoveSfxAsset {
  const [group] = id.split("/") as [keyof typeof GROUP_VOLUME, string];

  return {
    id,
    key: `battle-move-sfx-${id.replace("/", "-")}`,
    path: `/assets/audio/battle/moves/${id}.mp3`,
    volume: GROUP_VOLUME[group],
  };
}
