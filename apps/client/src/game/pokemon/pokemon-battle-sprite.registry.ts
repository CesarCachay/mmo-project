import { getPokemonSpriteAsset } from "./pokemon-sprite.registry";

export type PokemonBattleSpriteSide = "front" | "back";

export interface PokemonBattleSpriteAsset {
  spriteKey: string;
  path: string;
}

const BATTLE_SPRITE_BASE_PATH = "/assets/pokemon/battle/gen5";

function extractSpriteKeyFromPath(assetPath: string): string | undefined {
  const normalized = assetPath.split("?")[0];

  if (!normalized) {
    return undefined;
  }

  const filename = normalized.split("/").pop();

  if (!filename) {
    return undefined;
  }

  if (!filename.endsWith(".png")) {
    return undefined;
  }

  return filename.replace(/\.png$/i, "");
}

/*
 * Resuelve automáticamente el mismo spriteKey
 * que ya usa el sistema actual de Party/icons.
 *
 * Ejemplos:
 * 25                -> "25"
 * 201 + form A      -> "201-a"
 * 386 + attack form -> "386-attack"
 */
export function getPokemonBattleSpriteAsset(
  speciesId: number,
  formId: number,
  side: PokemonBattleSpriteSide
): PokemonBattleSpriteAsset {
  const currentAsset = getPokemonSpriteAsset(speciesId, formId);
  const spriteKey = extractSpriteKeyFromPath(currentAsset.path) ?? String(speciesId);

  return {
    spriteKey,
    path: `${BATTLE_SPRITE_BASE_PATH}` + `/${side}/${spriteKey}.png`,
  };
}
