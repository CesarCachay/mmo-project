import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const pass = [];
const warnings = [];
const failures = [];

function resolveRepo(relativePath) {
  return path.join(repoRoot, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(resolveRepo(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(resolveRepo(relativePath), "utf8");
}

function ok(message) {
  pass.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fail(message) {
  failures.push(message);
}

function requireFile(relativePath) {
  if (exists(relativePath)) {
    ok(`exists: ${relativePath}`);
    return;
  }

  fail(`missing: ${relativePath}`);
}

function checkText(relativePath, pattern, description) {
  if (!exists(relativePath)) {
    fail(`${description}: file missing (${relativePath})`);
    return;
  }

  const text = read(relativePath);

  if (pattern.test(text)) {
    ok(description);
    return;
  }

  fail(description);
}

function walkFiles(directory) {
  const absolute = resolveRepo(directory);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  const result = [];

  const visit = (current) => {
    for (const entry of fs.readdirSync(current, {
      withFileTypes: true,
    })) {
      const full = path.join(current, entry.name);

      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".git"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        visit(full);
        continue;
      }

      if (/\.(ts|tsx|js|mjs|css)$/.test(entry.name)) {
        result.push(full);
      }
    }
  };

  visit(absolute);

  return result;
}

console.log("\nMilestone 1.31 UI Shell audit\n");

/* ---------------------------------------------------------
 * Required UI Shell files
 * ------------------------------------------------------ */

[
  "apps/client/src/shell/GameShellController.ts",
  "apps/client/src/shell/GameTopBarController.ts",

  "apps/client/src/game/ui/ChatDock.ts",
  "apps/client/src/game/ui/RightHudRail.ts",

  "apps/client/src/game/ui/PartyDrawer.ts",
  "apps/client/src/game/ui/party-drawer.css",

  "apps/client/src/game/ui/InventoryDrawer.ts",
  "apps/client/src/game/ui/inventory-drawer.css",

  "apps/client/src/game/ui/TrainerDrawer.ts",
  "apps/client/src/game/ui/trainer-drawer.css",

  "apps/client/src/game/ui/InteractionPrompt.ts",
  "apps/client/src/game/ui/interaction-prompt.css",

  "apps/client/src/styles/game-ui-responsive.css",
  "apps/client/src/styles/game-stage-widescreen.css",

  "apps/client/src/game/camera/OverworldCameraController.ts",
  "apps/client/src/game/camera/overworldCameraProfiles.ts",
].forEach(requireFile);

/* ---------------------------------------------------------
 * Logical viewport
 * ------------------------------------------------------ */

checkText(
  "apps/client/src/game/game.constants.ts",
  /VIEWPORT_WIDTH\s*=\s*960\b/,
  "logical viewport width = 960"
);

checkText(
  "apps/client/src/game/game.constants.ts",
  /VIEWPORT_HEIGHT\s*=\s*540\b/,
  "logical viewport height = 540"
);

/* ---------------------------------------------------------
 * Camera ownership + profiles
 * ------------------------------------------------------ */

checkText(
  "apps/client/src/game/camera/overworldCameraProfiles.ts",
  /OUTDOOR_CAMERA_PROFILE[\s\S]*?zoom\s*:\s*1\.5\b/,
  "outdoor camera zoom = 1.5"
);

checkText(
  "apps/client/src/game/camera/overworldCameraProfiles.ts",
  /INTERIOR_CAMERA_PROFILE[\s\S]*?zoom\s*:\s*1\.75\b/,
  "interior camera zoom = 1.75"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /setZoom\s*\(\s*profile\.zoom\s*\)/,
  "OverworldCameraController owns map zoom"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /camera\.width\s*\/\s*this\.camera\.zoom/,
  "camera bounds account for zoom width"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /camera\.height\s*\/\s*this\.camera\.zoom/,
  "camera bounds account for zoom height"
);

/* ---------------------------------------------------------
 * Stylesheet integration
 * ------------------------------------------------------ */

checkText(
  "apps/client/src/main.ts",
  /styles\/game-ui-responsive\.css/,
  "main imports responsive foundations"
);

checkText(
  "apps/client/src/main.ts",
  /styles\/game-stage-widescreen\.css/,
  "main imports widescreen stage stylesheet"
);

/* ---------------------------------------------------------
 * Check GameScene does not bypass camera controller.
 * ------------------------------------------------------ */

if (exists("apps/client/src/game/GameScene.ts")) {
  const gameScene = read("apps/client/src/game/GameScene.ts");

  if (/OVERWORLD_CAMERA_ZOOM/.test(gameScene)) {
    fail(
      "GameScene still references OVERWORLD_CAMERA_ZOOM; zoom should belong to OverworldCameraController profiles"
    );
  } else {
    ok("GameScene has no global OVERWORLD_CAMERA_ZOOM");
  }

  if (/cameras\.main\.setZoom\s*\(/.test(gameScene)) {
    fail(
      "GameScene directly sets camera zoom; keep map zoom in OverworldCameraController"
    );
  } else {
    ok("GameScene does not bypass camera zoom ownership");
  }
} else {
  fail("missing: apps/client/src/game/GameScene.ts");
}

/* ---------------------------------------------------------
 * Legacy Trainer UI references
 * ------------------------------------------------------ */

const sourceFiles = walkFiles("apps/client/src");

const legacyPatterns = [
  {
    label: "ChatBox",
    regex: /\bChatBox\b/,
  },
  {
    label: "PartyPanel",
    regex: /\bPartyPanel\b/,
  },
  {
    label: "InventoryPanel",
    regex: /\bInventoryPanel\b/,
  },
  {
    label: "trainerPanelStyles",
    regex: /\btrainerPanelStyles\b/,
  },
  {
    label: "ActivePokemonHud",
    regex: /\bActivePokemonHud\b/,
  },
];

for (const legacy of legacyPatterns) {
  const matches = [];

  for (const absolute of sourceFiles) {
    const relative = path.relative(repoRoot, absolute);

    /*
     * Ignore the legacy file itself when checking stale references.
     * A leftover unreferenced file is handled separately as cleanup.
     */
    if (relative.endsWith(`${legacy.label}.ts`)) {
      continue;
    }

    const text = fs.readFileSync(absolute, "utf8");

    if (legacy.regex.test(text)) {
      matches.push(relative);
    }
  }

  if (matches.length > 0) {
    fail(`legacy reference ${legacy.label}: ${matches.join(", ")}`);
  } else {
    ok(`no active ${legacy.label} references`);
  }
}

/* ---------------------------------------------------------
 * Optional cleanup files.
 * Leftovers are warnings, not build blockers.
 * ------------------------------------------------------ */

[
  "apps/client/src/game/ui/ChatBox.ts",
  "apps/client/src/game/ui/PartyPanel.ts",
  "apps/client/src/game/ui/InventoryPanel.ts",
  "apps/client/src/game/ui/trainerPanelStyles.ts",
  "apps/client/src/game/ui/ActivePokemonHud.ts",
  "apps/client/src/game/ui/active-pokemon-hud.css",
].forEach((relativePath) => {
  if (exists(relativePath)) {
    warn(`legacy file can be deleted after confirming no imports: ${relativePath}`);
  }
});

/* ---------------------------------------------------------
 * Global CSS size informational check.
 * ------------------------------------------------------ */

const stylePath = "apps/client/src/style.css";

if (exists(stylePath)) {
  const lines = read(stylePath).split(/\r?\n/).length;

  if (lines > 600) {
    warn(`style.css is ${lines} lines; consider extracting more feature styles`);
  } else {
    ok(`style.css remains manageable (${lines} lines)`);
  }
}

/* ---------------------------------------------------------
 * Output
 * ------------------------------------------------------ */

console.log("PASS");
for (const message of pass) {
  console.log(`  ✓ ${message}`);
}

if (warnings.length > 0) {
  console.log("\nWARNINGS");

  for (const message of warnings) {
    console.log(`  ! ${message}`);
  }
}

if (failures.length > 0) {
  console.log("\nFAILURES");

  for (const message of failures) {
    console.log(`  ✗ ${message}`);
  }

  console.log(`\nAudit failed: ${failures.length} issue(s).\n`);

  process.exitCode = 1;
} else {
  console.log("\nMilestone 1.31 UI Shell structure looks clean.\n");
}
