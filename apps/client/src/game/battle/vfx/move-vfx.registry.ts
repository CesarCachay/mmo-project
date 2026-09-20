import { getPokemonMove } from "@cesar-mmo/shared";
import type {
  BattleMoveVfxDefinition,
  BattleMoveVfxElement,
  BattleMoveVfxGenericPresetId,
} from "./battle-move-vfx.types";

const SPIKES_MOVE_ID = 191;
const SANDSTORM_MOVE_ID = 201;
const RAIN_DANCE_MOVE_ID = 240;
const SUNNY_DAY_MOVE_ID = 241;
const HAIL_MOVE_ID = 258;
const GRAVITY_MOVE_ID = 356;
const TOXIC_SPIKES_MOVE_ID = 390;
const TRICK_ROOM_MOVE_ID = 433;
const STEALTH_ROCK_MOVE_ID = 446;

const MEGA_PUNCH_MOVE_ID = 5;
const GUST_MOVE_ID = 16;
const SURF_MOVE_ID = 57;
const EARTHQUAKE_MOVE_ID = 89;
const ROCK_SLIDE_MOVE_ID = 157;
const ICY_WIND_MOVE_ID = 196;
const TWISTER_MOVE_ID = 239;
const HEAT_WAVE_MOVE_ID = 257;
const HYPER_VOICE_MOVE_ID = 304;
const MUDDY_WATER_MOVE_ID = 330;
const BUG_BUZZ_MOVE_ID = 405;
const EARTH_POWER_MOVE_ID = 414;
const FIRE_PUNCH_MOVE_ID = 7;
const ICE_PUNCH_MOVE_ID = 8;
const THUNDER_PUNCH_MOVE_ID = 9;
const SCRATCH_MOVE_ID = 10;
const PIN_MISSILE_MOVE_ID = 42;
const DOUBLE_KICK_MOVE_ID = 24;
const MEGA_KICK_MOVE_ID = 25;
const HEADBUTT_MOVE_ID = 29;
const TACKLE_MOVE_ID = 33;
const BITE_MOVE_ID = 44;
const BODY_SLAM_MOVE_ID = 34;
const TAKE_DOWN_MOVE_ID = 36;
const EMBER_MOVE_ID = 52;
const FLAMETHROWER_MOVE_ID = 53;
const WATER_GUN_MOVE_ID = 55;
const HYDRO_PUMP_MOVE_ID = 56;
const ICE_BEAM_MOVE_ID = 58;
const AURORA_BEAM_MOVE_ID = 62;
const HYPER_BEAM_MOVE_ID = 63;
const SOLAR_BEAM_MOVE_ID = 76;
const SELF_DESTRUCT_MOVE_ID = 120;
const FIRE_BLAST_MOVE_ID = 126;
const BARRAGE_MOVE_ID = 140;
const EXPLOSION_MOVE_ID = 153;
const SLASH_MOVE_ID = 163;
const SLUDGE_BOMB_MOVE_ID = 188;
const CRUNCH_MOVE_ID = 242;
const SHADOW_BALL_MOVE_ID = 247;
const BULLET_SEED_MOVE_ID = 331;
const DRAGON_CLAW_MOVE_ID = 337;
const ROCK_BLAST_MOVE_ID = 350;
const SEED_BOMB_MOVE_ID = 402;
const ENERGY_BALL_MOVE_ID = 412;
const THUNDER_FANG_MOVE_ID = 422;
const ICE_FANG_MOVE_ID = 423;
const FIRE_FANG_MOVE_ID = 424;
const SHADOW_CLAW_MOVE_ID = 421;
const THUNDERBOLT_MOVE_ID = 85;
const THUNDER_MOVE_ID = 87;
const BLIZZARD_MOVE_ID = 59;
const PSYCHIC_MOVE_ID = 94;
const AURA_SPHERE_MOVE_ID = 396;
const DARK_PULSE_MOVE_ID = 399;
const AIR_SLASH_MOVE_ID = 403;
const DRAGON_PULSE_MOVE_ID = 406;
const FOCUS_BLAST_MOVE_ID = 411;
const BRAVE_BIRD_MOVE_ID = 413;
const FLASH_CANNON_MOVE_ID = 430;
const DRACO_METEOR_MOVE_ID = 434;
const LEAF_STORM_MOVE_ID = 437;
const STONE_EDGE_MOVE_ID = 444;
const SHADOW_FORCE_MOVE_ID = 467;
const CLOSE_COMBAT_MOVE_ID = 370;


const SWORDS_DANCE_MOVE_ID = 14;
const TAIL_WHIP_MOVE_ID = 39;
const LEER_MOVE_ID = 43;
const GROWL_MOVE_ID = 45;
const SING_MOVE_ID = 47;
const ABSORB_MOVE_ID = 71;
const MEGA_DRAIN_MOVE_ID = 72;
const LEECH_SEED_MOVE_ID = 73;
const POISON_POWDER_MOVE_ID = 77;
const STUN_SPORE_MOVE_ID = 78;
const SLEEP_POWDER_MOVE_ID = 79;
const HYPNOSIS_MOVE_ID = 95;
const AGILITY_MOVE_ID = 97;
const DOUBLE_TEAM_MOVE_ID = 104;
const RECOVER_MOVE_ID = 105;
const CONFUSE_RAY_MOVE_ID = 109;
const LIGHT_SCREEN_MOVE_ID = 113;
const REFLECT_MOVE_ID = 115;
const FOCUS_ENERGY_MOVE_ID = 116;
const REST_MOVE_ID = 156;
const GIGA_DRAIN_MOVE_ID = 202;
const SAFEGUARD_MOVE_ID = 219;
const CHARGE_MOVE_ID = 268;
const INGRAIN_MOVE_ID = 275;
const REFRESH_MOVE_ID = 287;
const BULK_UP_MOVE_ID = 339;
const CALM_MIND_MOVE_ID = 347;
const DRAGON_DANCE_MOVE_ID = 349;
const ROOST_MOVE_ID = 355;

const MOVE_VFX_REGISTRY: ReadonlyMap<number, BattleMoveVfxDefinition> = new Map([
  [SPIKES_MOVE_ID, { moveId: SPIKES_MOVE_ID, archetype: "battlefield", element: "ground", presetId: "spikes", durationMs: 900 }],
  [SANDSTORM_MOVE_ID, { moveId: SANDSTORM_MOVE_ID, archetype: "battlefield", element: "rock", presetId: "sandstorm", durationMs: 1150 }],
  [RAIN_DANCE_MOVE_ID, { moveId: RAIN_DANCE_MOVE_ID, archetype: "battlefield", element: "water", presetId: "rain-dance", durationMs: 1100 }],
  [SUNNY_DAY_MOVE_ID, { moveId: SUNNY_DAY_MOVE_ID, archetype: "battlefield", element: "fire", presetId: "sunny-day", durationMs: 1100 }],
  [HAIL_MOVE_ID, { moveId: HAIL_MOVE_ID, archetype: "battlefield", element: "ice", presetId: "hail", durationMs: 1100 }],
  [GRAVITY_MOVE_ID, { moveId: GRAVITY_MOVE_ID, archetype: "battlefield", element: "psychic", presetId: "gravity", durationMs: 1050 }],
  [TOXIC_SPIKES_MOVE_ID, { moveId: TOXIC_SPIKES_MOVE_ID, archetype: "battlefield", element: "poison", presetId: "toxic-spikes", durationMs: 940 }],
  [TRICK_ROOM_MOVE_ID, { moveId: TRICK_ROOM_MOVE_ID, archetype: "battlefield", element: "psychic", presetId: "trick-room", durationMs: 1120 }],
  [STEALTH_ROCK_MOVE_ID, { moveId: STEALTH_ROCK_MOVE_ID, archetype: "battlefield", element: "rock", presetId: "stealth-rock", durationMs: 980 }],

  [SWORDS_DANCE_MOVE_ID, { moveId: SWORDS_DANCE_MOVE_ID, archetype: "support", element: "normal", presetId: "swords-dance", durationMs: 860 }],
  [TAIL_WHIP_MOVE_ID, { moveId: TAIL_WHIP_MOVE_ID, archetype: "status", element: "normal", presetId: "tail-whip", durationMs: 700 }],
  [LEER_MOVE_ID, { moveId: LEER_MOVE_ID, archetype: "status", element: "normal", presetId: "leer", durationMs: 680 }],
  [GROWL_MOVE_ID, { moveId: GROWL_MOVE_ID, archetype: "status", element: "normal", presetId: "growl", durationMs: 720 }],
  [SING_MOVE_ID, { moveId: SING_MOVE_ID, archetype: "status", element: "normal", presetId: "sing", durationMs: 900 }],
  [ABSORB_MOVE_ID, { moveId: ABSORB_MOVE_ID, archetype: "tether", element: "grass", presetId: "absorb", durationMs: 760 }],
  [MEGA_DRAIN_MOVE_ID, { moveId: MEGA_DRAIN_MOVE_ID, archetype: "tether", element: "grass", presetId: "mega-drain", durationMs: 900 }],
  [LEECH_SEED_MOVE_ID, { moveId: LEECH_SEED_MOVE_ID, archetype: "tether", element: "grass", presetId: "leech-seed", durationMs: 920 }],
  [POISON_POWDER_MOVE_ID, { moveId: POISON_POWDER_MOVE_ID, archetype: "status", element: "poison", presetId: "poison-powder", durationMs: 900 }],
  [STUN_SPORE_MOVE_ID, { moveId: STUN_SPORE_MOVE_ID, archetype: "status", element: "grass", presetId: "stun-spore", durationMs: 880 }],
  [SLEEP_POWDER_MOVE_ID, { moveId: SLEEP_POWDER_MOVE_ID, archetype: "status", element: "grass", presetId: "sleep-powder", durationMs: 920 }],
  [HYPNOSIS_MOVE_ID, { moveId: HYPNOSIS_MOVE_ID, archetype: "status", element: "psychic", presetId: "hypnosis", durationMs: 980 }],
  [AGILITY_MOVE_ID, { moveId: AGILITY_MOVE_ID, archetype: "support", element: "psychic", presetId: "agility", durationMs: 760 }],
  [DOUBLE_TEAM_MOVE_ID, { moveId: DOUBLE_TEAM_MOVE_ID, archetype: "support", element: "normal", presetId: "double-team", durationMs: 820 }],
  [RECOVER_MOVE_ID, { moveId: RECOVER_MOVE_ID, archetype: "support", element: "normal", presetId: "recover", durationMs: 900 }],
  [CONFUSE_RAY_MOVE_ID, { moveId: CONFUSE_RAY_MOVE_ID, archetype: "status", element: "ghost", presetId: "confuse-ray", durationMs: 900 }],
  [LIGHT_SCREEN_MOVE_ID, { moveId: LIGHT_SCREEN_MOVE_ID, archetype: "barrier", element: "psychic", presetId: "light-screen", durationMs: 920 }],
  [REFLECT_MOVE_ID, { moveId: REFLECT_MOVE_ID, archetype: "barrier", element: "psychic", presetId: "reflect", durationMs: 920 }],
  [FOCUS_ENERGY_MOVE_ID, { moveId: FOCUS_ENERGY_MOVE_ID, archetype: "support", element: "normal", presetId: "focus-energy", durationMs: 820 }],
  [REST_MOVE_ID, { moveId: REST_MOVE_ID, archetype: "support", element: "psychic", presetId: "rest", durationMs: 960 }],
  [GIGA_DRAIN_MOVE_ID, { moveId: GIGA_DRAIN_MOVE_ID, archetype: "tether", element: "grass", presetId: "giga-drain", durationMs: 1080 }],
  [SAFEGUARD_MOVE_ID, { moveId: SAFEGUARD_MOVE_ID, archetype: "barrier", element: "normal", presetId: "safeguard", durationMs: 980 }],
  [CHARGE_MOVE_ID, { moveId: CHARGE_MOVE_ID, archetype: "support", element: "electric", presetId: "charge", durationMs: 880 }],
  [INGRAIN_MOVE_ID, { moveId: INGRAIN_MOVE_ID, archetype: "tether", element: "grass", presetId: "ingrain", durationMs: 940 }],
  [REFRESH_MOVE_ID, { moveId: REFRESH_MOVE_ID, archetype: "support", element: "normal", presetId: "refresh", durationMs: 860 }],
  [BULK_UP_MOVE_ID, { moveId: BULK_UP_MOVE_ID, archetype: "support", element: "fighting", presetId: "bulk-up", durationMs: 900 }],
  [CALM_MIND_MOVE_ID, { moveId: CALM_MIND_MOVE_ID, archetype: "support", element: "psychic", presetId: "calm-mind", durationMs: 960 }],
  [DRAGON_DANCE_MOVE_ID, { moveId: DRAGON_DANCE_MOVE_ID, archetype: "support", element: "dragon", presetId: "dragon-dance", durationMs: 940 }],
  [ROOST_MOVE_ID, { moveId: ROOST_MOVE_ID, archetype: "support", element: "flying", presetId: "roost", durationMs: 900 }],
  [
    GUST_MOVE_ID,
    { moveId: GUST_MOVE_ID, archetype: "wave", element: "flying", presetId: "gust", durationMs: 700 },
  ],
  [
    SURF_MOVE_ID,
    { moveId: SURF_MOVE_ID, archetype: "wave", element: "water", presetId: "surf", durationMs: 1120 },
  ],
  [
    EARTHQUAKE_MOVE_ID,
    { moveId: EARTHQUAKE_MOVE_ID, archetype: "ground", element: "ground", presetId: "earthquake", durationMs: 1040 },
  ],
  [
    ROCK_SLIDE_MOVE_ID,
    { moveId: ROCK_SLIDE_MOVE_ID, archetype: "aoe", element: "rock", presetId: "rock-slide", durationMs: 1080 },
  ],
  [
    ICY_WIND_MOVE_ID,
    { moveId: ICY_WIND_MOVE_ID, archetype: "wave", element: "ice", presetId: "icy-wind", durationMs: 860 },
  ],
  [
    TWISTER_MOVE_ID,
    { moveId: TWISTER_MOVE_ID, archetype: "aoe", element: "dragon", presetId: "twister", durationMs: 980 },
  ],
  [
    HEAT_WAVE_MOVE_ID,
    { moveId: HEAT_WAVE_MOVE_ID, archetype: "wave", element: "fire", presetId: "heat-wave", durationMs: 960 },
  ],
  [
    HYPER_VOICE_MOVE_ID,
    { moveId: HYPER_VOICE_MOVE_ID, archetype: "wave", element: "normal", presetId: "hyper-voice", durationMs: 900 },
  ],
  [
    MUDDY_WATER_MOVE_ID,
    { moveId: MUDDY_WATER_MOVE_ID, archetype: "aoe", element: "water", presetId: "muddy-water", durationMs: 1040 },
  ],
  [
    BUG_BUZZ_MOVE_ID,
    { moveId: BUG_BUZZ_MOVE_ID, archetype: "wave", element: "bug", presetId: "bug-buzz", durationMs: 900 },
  ],
  [
    EARTH_POWER_MOVE_ID,
    { moveId: EARTH_POWER_MOVE_ID, archetype: "ground", element: "ground", presetId: "earth-power", durationMs: 980 },
  ],
  [
    MEGA_PUNCH_MOVE_ID,
    { moveId: MEGA_PUNCH_MOVE_ID, archetype: "melee", element: "normal", presetId: "mega-punch", durationMs: 720 },
  ],
  [
    FIRE_PUNCH_MOVE_ID,
    { moveId: FIRE_PUNCH_MOVE_ID, archetype: "melee", element: "fire", presetId: "fire-punch", durationMs: 740 },
  ],
  [
    ICE_PUNCH_MOVE_ID,
    { moveId: ICE_PUNCH_MOVE_ID, archetype: "melee", element: "ice", presetId: "ice-punch", durationMs: 740 },
  ],
  [
    THUNDER_PUNCH_MOVE_ID,
    { moveId: THUNDER_PUNCH_MOVE_ID, archetype: "melee", element: "electric", presetId: "thunder-punch", durationMs: 720 },
  ],
  [
    SCRATCH_MOVE_ID,
    { moveId: SCRATCH_MOVE_ID, archetype: "melee", element: "normal", presetId: "scratch", durationMs: 600 },
  ],
  [
    PIN_MISSILE_MOVE_ID,
    { moveId: PIN_MISSILE_MOVE_ID, archetype: "multi-projectile", element: "bug", presetId: "pin-missile", durationMs: 960 },
  ],
  [
    DOUBLE_KICK_MOVE_ID,
    { moveId: DOUBLE_KICK_MOVE_ID, archetype: "melee", element: "fighting", presetId: "double-kick", durationMs: 760 },
  ],
  [
    MEGA_KICK_MOVE_ID,
    { moveId: MEGA_KICK_MOVE_ID, archetype: "melee", element: "normal", presetId: "mega-kick", durationMs: 800 },
  ],
  [
    HEADBUTT_MOVE_ID,
    {
      moveId: HEADBUTT_MOVE_ID,
      archetype: "contact",
      element: "normal",
      presetId: "headbutt",
      durationMs: 680,
    },
  ],
  [
    TACKLE_MOVE_ID,
    {
      moveId: TACKLE_MOVE_ID,
      archetype: "contact",
      element: "normal",
      presetId: "tackle",
      durationMs: 620,
    },
  ],
  [
    BODY_SLAM_MOVE_ID,
    {
      moveId: BODY_SLAM_MOVE_ID,
      archetype: "contact",
      element: "normal",
      presetId: "body-slam",
      durationMs: 820,
    },
  ],
  [
    TAKE_DOWN_MOVE_ID,
    {
      moveId: TAKE_DOWN_MOVE_ID,
      archetype: "contact",
      element: "normal",
      presetId: "take-down",
      durationMs: 760,
    },
  ],
  [
    BITE_MOVE_ID,
    { moveId: BITE_MOVE_ID, archetype: "melee", element: "dark", presetId: "bite", durationMs: 660 },
  ],
  [
    EMBER_MOVE_ID,
    {
      moveId: EMBER_MOVE_ID,
      archetype: "projectile",
      element: "fire",
      presetId: "ember",
      durationMs: 620,
    },
  ],
  [
    FLAMETHROWER_MOVE_ID,
    {
      moveId: FLAMETHROWER_MOVE_ID,
      archetype: "stream",
      element: "fire",
      presetId: "flamethrower",
      durationMs: 1180,
    },
  ],
  [
    WATER_GUN_MOVE_ID,
    {
      moveId: WATER_GUN_MOVE_ID,
      archetype: "stream",
      element: "water",
      presetId: "water-gun",
      durationMs: 760,
    },
  ],
  [
    HYDRO_PUMP_MOVE_ID,
    {
      moveId: HYDRO_PUMP_MOVE_ID,
      archetype: "stream",
      element: "water",
      presetId: "hydro-pump",
      durationMs: 1080,
    },
  ],
  [
    ICE_BEAM_MOVE_ID,
    {
      moveId: ICE_BEAM_MOVE_ID,
      archetype: "beam",
      element: "ice",
      presetId: "ice-beam",
      durationMs: 900,
    },
  ],
  [
    AURORA_BEAM_MOVE_ID,
    {
      moveId: AURORA_BEAM_MOVE_ID,
      archetype: "beam",
      element: "ice",
      presetId: "aurora-beam",
      durationMs: 980,
    },
  ],
  [
    HYPER_BEAM_MOVE_ID,
    {
      moveId: HYPER_BEAM_MOVE_ID,
      archetype: "beam",
      element: "normal",
      presetId: "hyper-beam",
      durationMs: 1260,
    },
  ],
  [
    SOLAR_BEAM_MOVE_ID,
    {
      moveId: SOLAR_BEAM_MOVE_ID,
      archetype: "beam",
      element: "grass",
      presetId: "solar-beam",
      durationMs: 1320,
    },
  ],
  [
    SELF_DESTRUCT_MOVE_ID,
    { moveId: SELF_DESTRUCT_MOVE_ID, archetype: "burst", element: "normal", presetId: "self-destruct", durationMs: 920 },
  ],
  [
    FIRE_BLAST_MOVE_ID,
    { moveId: FIRE_BLAST_MOVE_ID, archetype: "burst", element: "fire", presetId: "fire-blast", durationMs: 1080 },
  ],
  [
    BARRAGE_MOVE_ID,
    { moveId: BARRAGE_MOVE_ID, archetype: "multi-projectile", element: "normal", presetId: "barrage", durationMs: 980 },
  ],
  [
    EXPLOSION_MOVE_ID,
    { moveId: EXPLOSION_MOVE_ID, archetype: "burst", element: "normal", presetId: "explosion", durationMs: 1040 },
  ],
  [
    SLASH_MOVE_ID,
    { moveId: SLASH_MOVE_ID, archetype: "melee", element: "normal", presetId: "slash", durationMs: 680 },
  ],
  [
    SLUDGE_BOMB_MOVE_ID,
    {
      moveId: SLUDGE_BOMB_MOVE_ID,
      archetype: "projectile",
      element: "poison",
      presetId: "sludge-bomb",
      durationMs: 820,
    },
  ],
  [
    CRUNCH_MOVE_ID,
    { moveId: CRUNCH_MOVE_ID, archetype: "melee", element: "dark", presetId: "crunch", durationMs: 740 },
  ],
  [
    SHADOW_BALL_MOVE_ID,
    {
      moveId: SHADOW_BALL_MOVE_ID,
      archetype: "projectile",
      element: "ghost",
      presetId: "shadow-ball",
      durationMs: 860,
    },
  ],
  [
    BULLET_SEED_MOVE_ID,
    { moveId: BULLET_SEED_MOVE_ID, archetype: "multi-projectile", element: "grass", presetId: "bullet-seed", durationMs: 920 },
  ],
  [
    DRAGON_CLAW_MOVE_ID,
    { moveId: DRAGON_CLAW_MOVE_ID, archetype: "melee", element: "dragon", presetId: "dragon-claw", durationMs: 760 },
  ],
  [
    ROCK_BLAST_MOVE_ID,
    { moveId: ROCK_BLAST_MOVE_ID, archetype: "multi-projectile", element: "rock", presetId: "rock-blast", durationMs: 1040 },
  ],
  [
    SEED_BOMB_MOVE_ID,
    {
      moveId: SEED_BOMB_MOVE_ID,
      archetype: "projectile",
      element: "grass",
      presetId: "seed-bomb",
      durationMs: 780,
    },
  ],
  [
    ENERGY_BALL_MOVE_ID,
    {
      moveId: ENERGY_BALL_MOVE_ID,
      archetype: "projectile",
      element: "grass",
      presetId: "energy-ball",
      durationMs: 840,
    },
  ],
  [
    SHADOW_CLAW_MOVE_ID,
    { moveId: SHADOW_CLAW_MOVE_ID, archetype: "melee", element: "ghost", presetId: "shadow-claw", durationMs: 760 },
  ],
  [
    THUNDER_FANG_MOVE_ID,
    { moveId: THUNDER_FANG_MOVE_ID, archetype: "melee", element: "electric", presetId: "thunder-fang", durationMs: 740 },
  ],
  [
    ICE_FANG_MOVE_ID,
    { moveId: ICE_FANG_MOVE_ID, archetype: "melee", element: "ice", presetId: "ice-fang", durationMs: 760 },
  ],
  [
    FIRE_FANG_MOVE_ID,
    { moveId: FIRE_FANG_MOVE_ID, archetype: "melee", element: "fire", presetId: "fire-fang", durationMs: 760 },
  ],
  [BLIZZARD_MOVE_ID, { moveId: BLIZZARD_MOVE_ID, archetype: "signature", element: "ice", presetId: "blizzard", durationMs: 1120 }],
  [THUNDERBOLT_MOVE_ID, { moveId: THUNDERBOLT_MOVE_ID, archetype: "signature", element: "electric", presetId: "thunderbolt", durationMs: 820 }],
  [THUNDER_MOVE_ID, { moveId: THUNDER_MOVE_ID, archetype: "signature", element: "electric", presetId: "thunder", durationMs: 1050 }],
  [PSYCHIC_MOVE_ID, { moveId: PSYCHIC_MOVE_ID, archetype: "signature", element: "psychic", presetId: "psychic", durationMs: 900 }],
  [CLOSE_COMBAT_MOVE_ID, { moveId: CLOSE_COMBAT_MOVE_ID, archetype: "signature", element: "fighting", presetId: "close-combat", durationMs: 900 }],
  [AURA_SPHERE_MOVE_ID, { moveId: AURA_SPHERE_MOVE_ID, archetype: "signature", element: "fighting", presetId: "aura-sphere", durationMs: 850 }],
  [DARK_PULSE_MOVE_ID, { moveId: DARK_PULSE_MOVE_ID, archetype: "signature", element: "dark", presetId: "dark-pulse", durationMs: 880 }],
  [AIR_SLASH_MOVE_ID, { moveId: AIR_SLASH_MOVE_ID, archetype: "signature", element: "flying", presetId: "air-slash", durationMs: 780 }],
  [DRAGON_PULSE_MOVE_ID, { moveId: DRAGON_PULSE_MOVE_ID, archetype: "signature", element: "dragon", presetId: "dragon-pulse", durationMs: 900 }],
  [FOCUS_BLAST_MOVE_ID, { moveId: FOCUS_BLAST_MOVE_ID, archetype: "signature", element: "fighting", presetId: "focus-blast", durationMs: 1050 }],
  [BRAVE_BIRD_MOVE_ID, { moveId: BRAVE_BIRD_MOVE_ID, archetype: "signature", element: "flying", presetId: "brave-bird", durationMs: 1000 }],
  [FLASH_CANNON_MOVE_ID, { moveId: FLASH_CANNON_MOVE_ID, archetype: "signature", element: "steel", presetId: "flash-cannon", durationMs: 900 }],
  [DRACO_METEOR_MOVE_ID, { moveId: DRACO_METEOR_MOVE_ID, archetype: "signature", element: "dragon", presetId: "draco-meteor", durationMs: 1250 }],
  [LEAF_STORM_MOVE_ID, { moveId: LEAF_STORM_MOVE_ID, archetype: "signature", element: "grass", presetId: "leaf-storm", durationMs: 1100 }],
  [STONE_EDGE_MOVE_ID, { moveId: STONE_EDGE_MOVE_ID, archetype: "signature", element: "rock", presetId: "stone-edge", durationMs: 980 }],
  [SHADOW_FORCE_MOVE_ID, { moveId: SHADOW_FORCE_MOVE_ID, archetype: "signature", element: "ghost", presetId: "shadow-force", durationMs: 1150 }],
]);

const SUPPORTED_ELEMENTS = new Set<BattleMoveVfxElement>([
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
  "steel", "fairy", "shadow",
]);

export function getBattleMoveVfxDefinition(
  moveId: number,
): BattleMoveVfxDefinition | undefined {
  const explicit = MOVE_VFX_REGISTRY.get(moveId);
  if (explicit) return explicit;

  const move = getPokemonMove(moveId);
  if (!move) return undefined;

  const presetId: BattleMoveVfxGenericPresetId = move.damageClass;
  const rawElement = String(move.type) as BattleMoveVfxElement;
  const element = SUPPORTED_ELEMENTS.has(rawElement) ? rawElement : "normal";

  return {
    moveId,
    archetype: "generic",
    element,
    presetId,
    durationMs: presetId === "status" ? 620 : presetId === "physical" ? 540 : 680,
  };
}

export function getExplicitBattleMoveVfxCount(): number {
  return MOVE_VFX_REGISTRY.size;
}

export function hasExplicitBattleMoveVfx(moveId: number): boolean {
  return MOVE_VFX_REGISTRY.has(moveId);
}
