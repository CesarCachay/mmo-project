import { dirname, resolve } from "node:path";
import { access, readFile, mkdir, writeFile } from "node:fs/promises";

const MAPS = [
  {
    name: "town-01",
    exportName: "TOWN_01_MAP",
  },
  {
    name: "house-01",
    exportName: "HOUSE_01_MAP",
  },
];

const availableMapIds = new Set(MAPS.map((mapDefinition) => mapDefinition.name));

function getRequiredStringProperty(object, propertyName) {
  const property = object.properties?.find(
    (candidate) => candidate.name === propertyName
  );

  if (
    !property ||
    typeof property.value !== "string" ||
    property.value.trim().length === 0
  ) {
    throw new Error(`Object "${object.name}" requires string property "${propertyName}"`);
  }

  return property.value.trim();
}

function parseMapSpawn(object, mapName) {
  if (typeof object.name !== "string" || object.name.trim().length === 0) {
    throw new Error(`Map "${mapName}" contains a mapSpawn without a name`);
  }

  if (typeof object.x !== "number" || typeof object.y !== "number") {
    throw new Error(
      `Invalid coordinates for mapSpawn "${object.name}" in map "${mapName}"`
    );
  }

  return {
    id: object.name.trim(),
    x: object.x,
    y: object.y,
  };
}

function parseMapTransition(object, mapName) {
  if (typeof object.name !== "string" || object.name.trim().length === 0) {
    throw new Error(`Map "${mapName}" contains a mapExit without a name`);
  }

  if (
    typeof object.x !== "number" ||
    typeof object.y !== "number" ||
    typeof object.width !== "number" ||
    typeof object.height !== "number"
  ) {
    throw new Error(`Invalid rectangle for mapExit "${object.name}" in map "${mapName}"`);
  }

  if (object.width <= 0 || object.height <= 0) {
    throw new Error(
      `mapExit "${object.name}" in map "${mapName}" must have width and height greater than zero`
    );
  }

  const targetMapId = getRequiredStringProperty(object, "targetMapId");

  const targetSpawn = getRequiredStringProperty(object, "targetSpawn");

  if (!availableMapIds.has(targetMapId)) {
    throw new Error(
      `mapExit "${object.name}" in map "${mapName}" targets unknown map "${targetMapId}"`
    );
  }

  return {
    id: object.name.trim(),

    targetMapId,
    targetSpawn,

    trigger: {
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
    },
  };
}

function ensureUniqueIds(items, kind, mapName) {
  const ids = new Set();

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate ${kind} "${item.id}" in map "${mapName}"`);
    }

    ids.add(item.id);
  }
}

function formatSpawns(spawns) {
  if (spawns.length === 0) {
    return `  spawns: {},`;
  }

  const entries = spawns.map(
    (spawn) => `    ${JSON.stringify(spawn.id)}: {
      x: ${spawn.x},
      y: ${spawn.y},
    },`
  );

  return `  spawns: {
${entries.join("\n")}
  },`;
}

function formatTransitions(transitions) {
  if (transitions.length === 0) {
    return `  transitions: {},`;
  }

  const entries = transitions.map(
    (transition) => `    ${JSON.stringify(transition.id)}: {
      targetMapId: ${JSON.stringify(transition.targetMapId)},
      targetSpawn: ${JSON.stringify(transition.targetSpawn)},
      trigger: {
        x: ${transition.trigger.x},
        y: ${transition.trigger.y},
        width: ${transition.trigger.width},
        height: ${transition.trigger.height},
      },
    },`
  );

  return `  transitions: {
${entries.join("\n")}
  },`;
}

const parsedMaps = [];

for (const mapDefinition of MAPS) {
  const { name, exportName } = mapDefinition;

  const sourcePath = resolve(`apps/client/public/assets/maps/${name}/${name}.json`);

  const outputPath = resolve(`packages/shared/src/maps/generated/${name}.ts`);

  try {
    await access(sourcePath);
  } catch {
    throw new Error(`Map file not found:\n${sourcePath}`);
  }

  const rawMap = await readFile(sourcePath, "utf8");

  const map = JSON.parse(rawMap);

  const collisionLayer = map.layers.find(
    (layer) => layer.name === "Collision" && layer.type === "tilelayer"
  );

  if (!collisionLayer) {
    throw new Error(`Layer "Collision" was not found in map "${name}"`);
  }

  const objectsLayer = map.layers.find(
    (layer) => layer.name === "Objects" && layer.type === "objectgroup"
  );

  if (!objectsLayer) {
    throw new Error(`Layer "Objects" was not found in map "${name}"`);
  }

  const playerSpawn = objectsLayer.objects.find(
    (object) => object.name === "playerSpawn"
  );

  if (!playerSpawn) {
    throw new Error(`Object "playerSpawn" was not found in map "${name}"`);
  }

  if (typeof playerSpawn.x !== "number" || typeof playerSpawn.y !== "number") {
    throw new Error(`Invalid playerSpawn coordinates in map "${name}"`);
  }

  const expectedCollisionCells = map.width * map.height;

  if (collisionLayer.data.length !== expectedCollisionCells) {
    throw new Error(
      `Map "${name}" expected ${expectedCollisionCells} collision cells, received ${collisionLayer.data.length}`
    );
  }

  const collision = collisionLayer.data.map((tileId) => (tileId === 0 ? 0 : 1));

  const collisionRows = [];

  for (let y = 0; y < map.height; y++) {
    const start = y * map.width;

    const end = start + map.width;

    collisionRows.push(`    ${collision.slice(start, end).join(", ")},`);
  }

  const spawns = objectsLayer.objects
    .filter((object) => object.type === "mapSpawn")
    .map((object) => parseMapSpawn(object, name));

  const transitions = objectsLayer.objects
    .filter((object) => object.type === "mapExit")
    .map((object) => parseMapTransition(object, name));

  ensureUniqueIds(spawns, "mapSpawn", name);

  ensureUniqueIds(transitions, "mapExit", name);

  parsedMaps.push({
    name,
    exportName,
    outputPath,
    map,
    playerSpawn,
    collision,
    collisionRows,
    spawns,
    transitions,
  });
}

for (const parsedMap of parsedMaps) {
  for (const transition of parsedMap.transitions) {
    const targetMap = parsedMaps.find(
      (candidate) => candidate.name === transition.targetMapId
    );

    if (!targetMap) {
      throw new Error(
        `Transition "${transition.id}" targets unknown map "${transition.targetMapId}"`
      );
    }

    const targetSpawnExists = targetMap.spawns.some(
      (spawn) => spawn.id === transition.targetSpawn
    );

    if (!targetSpawnExists) {
      throw new Error(
        `Transition "${transition.id}" in map "${parsedMap.name}" targets missing spawn "${transition.targetSpawn}" in map "${transition.targetMapId}"`
      );
    }
  }
}

for (const parsedMap of parsedMaps) {
  const {
    name,
    exportName,
    outputPath,
    map,
    playerSpawn,
    collision,
    collisionRows,
    spawns,
    transitions,
  } = parsedMap;

  const generatedFile = `// AUTO-GENERATED FILE.
// Do not edit manually.
// Source: client/public/assets/maps/${name}/${name}.json

export const ${exportName} = {
  id: "${name}",

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

${formatSpawns(spawns)}

${formatTransitions(transitions)}

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

  console.log(`Map spawns: ${spawns.length}`);

  console.log(`Map transitions: ${transitions.length}`);

  console.log(`Blocked cells: ${collision.filter(Boolean).length}`);

  console.log("");
}
