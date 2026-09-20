import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const movesPath = path.join(root, "packages/shared/src/pokemon/data/moves.json");
const registryPath = path.join(root, "apps/client/src/game/battle/vfx/move-vfx.registry.ts");

const moves = JSON.parse(fs.readFileSync(movesPath, "utf8"));
const source = fs.readFileSync(registryPath, "utf8");
const constants = new Map(
  [...source.matchAll(/const\s+([A-Z0-9_]+_MOVE_ID)\s*=\s*(\d+)\s*;/g)].map((match) => [match[1], Number(match[2])]),
);
const mapSource = source.split("new Map([")[1]?.split("]);\n\nconst SUPPORTED_ELEMENTS")[0] ?? "";
const entries = [...mapSource.matchAll(/\[\s*([A-Z0-9_]+_MOVE_ID)\s*,\s*\{[\s\S]*?archetype:\s*"([^"]+)"/g)]
  .map((match) => ({ constant: match[1], id: constants.get(match[1]), archetype: match[2] }))
  .filter((entry) => Number.isInteger(entry.id));

const explicitIds = new Set(entries.map((entry) => entry.id));
const moveIds = new Set(moves.map((move) => move.id));
const duplicateExplicitIds = entries
  .map((entry) => entry.id)
  .filter((id, index, all) => all.indexOf(id) !== index);
const unknownExplicitIds = [...explicitIds].filter((id) => !moveIds.has(id));
const fallbackMoves = moves.filter((move) => !explicitIds.has(move.id));
const missingCoverage = moves.filter((move) => !explicitIds.has(move.id) && !["physical", "special", "status"].includes(move.damageClass));

const byArchetype = Object.fromEntries(
  [...new Set(entries.map((entry) => entry.archetype))]
    .sort()
    .map((archetype) => [archetype, entries.filter((entry) => entry.archetype === archetype).length]),
);
const fallbackByClass = Object.fromEntries(
  ["physical", "special", "status"].map((damageClass) => [damageClass, fallbackMoves.filter((move) => move.damageClass === damageClass).length]),
);

const report = {
  totalMoves: moves.length,
  explicitPremiumMappings: explicitIds.size,
  genericFallbackMappings: fallbackMoves.length,
  totalCovered: moves.length - missingCoverage.length,
  coveragePercent: Number((((moves.length - missingCoverage.length) / moves.length) * 100).toFixed(2)),
  explicitByArchetype: byArchetype,
  fallbackByDamageClass: fallbackByClass,
  duplicateExplicitIds: [...new Set(duplicateExplicitIds)],
  unknownExplicitIds,
  missingCoverage: missingCoverage.map((move) => ({ id: move.id, name: move.name, damageClass: move.damageClass })),
};

console.log(JSON.stringify(report, null, 2));

if (
  moves.length !== 485 ||
  duplicateExplicitIds.length > 0 ||
  unknownExplicitIds.length > 0 ||
  missingCoverage.length > 0
) {
  process.exitCode = 1;
}
