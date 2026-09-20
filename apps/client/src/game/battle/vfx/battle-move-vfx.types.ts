export interface BattleMoveVfxPoint {
  readonly x: number;
  readonly y: number;
}

export type BattleMoveVfxArchetype =
  | "stream"
  | "projectile"
  | "beam"
  | "contact"
  | "melee"
  | "multi-projectile"
  | "burst"
  | "ground"
  | "wave"
  | "aoe"
  | "support"
  | "status"
  | "barrier"
  | "tether"
  | "battlefield"
  | "generic";

export type BattleMoveVfxElement =
  | "normal"
  | "fire"
  | "water"
  | "ice"
  | "ghost"
  | "grass"
  | "poison"
  | "electric"
  | "fighting"
  | "dark"
  | "dragon"
  | "bug"
  | "rock"
  | "ground"
  | "flying"
  | "psychic"
  | "steel"
  | "fairy"
  | "shadow";

export type BattleMoveVfxStreamPresetId = "flamethrower" | "water-gun" | "hydro-pump";
export type BattleMoveVfxProjectilePresetId = "ember" | "shadow-ball" | "energy-ball" | "sludge-bomb" | "seed-bomb";
export type BattleMoveVfxBeamPresetId = "ice-beam" | "aurora-beam" | "hyper-beam" | "solar-beam";
export type BattleMoveVfxContactPresetId = "tackle" | "headbutt" | "body-slam" | "take-down";
export type BattleMoveVfxMeleePresetId =
  | "scratch" | "slash" | "dragon-claw" | "shadow-claw"
  | "mega-punch" | "fire-punch" | "ice-punch" | "thunder-punch"
  | "double-kick" | "mega-kick"
  | "bite" | "crunch" | "fire-fang" | "ice-fang" | "thunder-fang";
export type BattleMoveVfxMultiProjectilePresetId = "bullet-seed" | "pin-missile" | "rock-blast" | "barrage";
export type BattleMoveVfxBurstPresetId = "fire-blast" | "self-destruct" | "explosion";
export type BattleMoveVfxGroundPresetId = "earthquake" | "earth-power";
export type BattleMoveVfxWavePresetId = "surf" | "heat-wave" | "icy-wind" | "gust" | "hyper-voice" | "bug-buzz";
export type BattleMoveVfxAoePresetId = "rock-slide" | "twister" | "muddy-water";
export type BattleMoveVfxSupportPresetId =
  | "swords-dance"
  | "agility"
  | "double-team"
  | "recover"
  | "focus-energy"
  | "rest"
  | "charge"
  | "refresh"
  | "bulk-up"
  | "calm-mind"
  | "dragon-dance"
  | "roost";
export type BattleMoveVfxStatusPresetId =
  | "tail-whip"
  | "leer"
  | "growl"
  | "sing"
  | "poison-powder"
  | "stun-spore"
  | "sleep-powder"
  | "hypnosis"
  | "confuse-ray";
export type BattleMoveVfxBarrierPresetId = "light-screen" | "reflect" | "safeguard";
export type BattleMoveVfxTetherPresetId = "absorb" | "mega-drain" | "leech-seed" | "giga-drain" | "ingrain";
export type BattleMoveVfxBattlefieldPresetId =
  | "rain-dance"
  | "sunny-day"
  | "sandstorm"
  | "hail"
  | "spikes"
  | "toxic-spikes"
  | "stealth-rock"
  | "trick-room"
  | "gravity";
export type BattleMoveVfxGenericPresetId = "physical" | "special" | "status";

export type BattleMoveVfxContactMotionStyle = "dash" | "headbutt" | "slam" | "reckless";

interface BattleMoveVfxDefinitionBase {
  readonly moveId: number;
  readonly element: BattleMoveVfxElement;
  readonly durationMs: number;
}

export interface BattleMoveVfxStreamDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "stream"; readonly presetId: BattleMoveVfxStreamPresetId; }
export interface BattleMoveVfxProjectileDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "projectile"; readonly presetId: BattleMoveVfxProjectilePresetId; }
export interface BattleMoveVfxBeamDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "beam"; readonly presetId: BattleMoveVfxBeamPresetId; }
export interface BattleMoveVfxContactDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "contact"; readonly presetId: BattleMoveVfxContactPresetId; }
export interface BattleMoveVfxMeleeDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "melee"; readonly presetId: BattleMoveVfxMeleePresetId; }
export interface BattleMoveVfxMultiProjectileDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "multi-projectile"; readonly presetId: BattleMoveVfxMultiProjectilePresetId; }
export interface BattleMoveVfxBurstDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "burst"; readonly presetId: BattleMoveVfxBurstPresetId; }
export interface BattleMoveVfxGroundDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "ground"; readonly presetId: BattleMoveVfxGroundPresetId; }
export interface BattleMoveVfxWaveDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "wave"; readonly presetId: BattleMoveVfxWavePresetId; }
export interface BattleMoveVfxAoeDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "aoe"; readonly presetId: BattleMoveVfxAoePresetId; }
export interface BattleMoveVfxSupportDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "support"; readonly presetId: BattleMoveVfxSupportPresetId; }
export interface BattleMoveVfxStatusDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "status"; readonly presetId: BattleMoveVfxStatusPresetId; }
export interface BattleMoveVfxBarrierDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "barrier"; readonly presetId: BattleMoveVfxBarrierPresetId; }
export interface BattleMoveVfxTetherDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "tether"; readonly presetId: BattleMoveVfxTetherPresetId; }
export interface BattleMoveVfxBattlefieldDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "battlefield"; readonly presetId: BattleMoveVfxBattlefieldPresetId; }
export interface BattleMoveVfxGenericDefinition extends BattleMoveVfxDefinitionBase { readonly archetype: "generic"; readonly presetId: BattleMoveVfxGenericPresetId; }

export type BattleMoveVfxDefinition =
  | BattleMoveVfxStreamDefinition
  | BattleMoveVfxProjectileDefinition
  | BattleMoveVfxBeamDefinition
  | BattleMoveVfxContactDefinition
  | BattleMoveVfxMeleeDefinition
  | BattleMoveVfxMultiProjectileDefinition
  | BattleMoveVfxBurstDefinition
  | BattleMoveVfxGroundDefinition
  | BattleMoveVfxWaveDefinition
  | BattleMoveVfxAoeDefinition
  | BattleMoveVfxSupportDefinition
  | BattleMoveVfxStatusDefinition
  | BattleMoveVfxBarrierDefinition
  | BattleMoveVfxTetherDefinition
  | BattleMoveVfxBattlefieldDefinition
  | BattleMoveVfxGenericDefinition;

export interface BattleMoveVfxContactMotionRequest {
  readonly target: BattleMoveVfxPoint;
  readonly durationMs: number;
  readonly windupEnd: number;
  readonly dashEnd: number;
  readonly impactHoldEnd: number;
  readonly travelRatio: number;
  readonly windupDistance: number;
  readonly arcHeight: number;
  readonly style: BattleMoveVfxContactMotionStyle;
}

export interface BattleMoveVfxActorMotion {
  playContactMotion(request: BattleMoveVfxContactMotionRequest): Promise<void>;
}

export interface BattleMoveVfxRequest {
  readonly moveId: number;
  readonly source: BattleMoveVfxPoint;
  readonly target: BattleMoveVfxPoint;
  readonly missed?: boolean;
  readonly actorMotion?: BattleMoveVfxActorMotion;
}

export interface BattleMoveVfxRenderRequest extends BattleMoveVfxRequest {
  readonly definition: BattleMoveVfxDefinition;
}

export interface BattleMoveVfxRenderer {
  play(request: BattleMoveVfxRenderRequest): Promise<void>;
  clear(): void;
}
