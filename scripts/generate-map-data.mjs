import { access, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MAP_NAME = "town-01";

const sourcePath = resolve(
  "apps/client/public/assets/maps/town-01/town-01.json",
);

const outputPath = resolve("packages/shared/src/maps/generated/town-01.ts");

try {
  await access(sourcePath);
} catch {
  throw new Error(
    `Map file not found:\n${sourcePath}\n\nCheck the sourcePath in generate-map-data.mjs.`,
  );
}

const rawMap = await readFile(sourcePath, "utf8");
const map = JSON.parse(rawMap);

const collisionLayer = map.layers.find(
  (layer) => layer.name === "Collision" && layer.type === "tilelayer",
);

if (!collisionLayer) {
  throw new Error('Layer "Collision" was not found');
}

const objectsLayer = map.layers.find(
  (layer) => layer.name === "Objects" && layer.type === "objectgroup",
);

if (!objectsLayer) {
  throw new Error('Layer "Objects" was not found');
}

const playerSpawn = objectsLayer.objects.find(
  (object) => object.name === "playerSpawn",
);

if (!playerSpawn) {
  throw new Error('Object "playerSpawn" was not found');
}

const expectedCollisionCells = map.width * map.height;

if (collisionLayer.data.length !== expectedCollisionCells) {
  throw new Error(
    `Expected ${expectedCollisionCells} collision cells, received ${collisionLayer.data.length}`,
  );
}

const collision = collisionLayer.data.map((tileId) => (tileId === 0 ? 0 : 1));

const collisionRows = [];

for (let y = 0; y < map.height; y++) {
  const start = y * map.width;
  const end = start + map.width;

  collisionRows.push(`    ${collision.slice(start, end).join(", ")},`);
}

const generatedFile = `// AUTO-GENERATED FILE.
// Do not edit manually.
// Source: client/public/assets/maps/${MAP_NAME}/${MAP_NAME}.json

export const TOWN_01_MAP = {
  id: "${MAP_NAME}",

  width: ${map.width},
  height: ${map.height},

  tileWidth: ${map.tilewidth},
  tileHeight: ${map.tileheight},

  widthInPixels: ${map.width * map.tilewidth},
  heightInPixels: ${map.height * map.tileheight},

  spawn: {
    x: ${playerSpawn.x},
    y: ${playerSpawn.y},
  },

  collision: [
${collisionRows.join("\n")}
  ],
} as const;
`;

await mkdir(dirname(outputPath), {
  recursive: true,
});

await writeFile(outputPath, generatedFile, "utf8");

console.log(`Generated ${outputPath}`);

console.log(`Map: ${map.width}x${map.height} tiles`);

console.log(`Spawn: (${playerSpawn.x}, ${playerSpawn.y})`);

console.log(`Blocked cells: ${collision.filter(Boolean).length}`);
