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
    return true;
  }

  fail(`missing: ${relativePath}`);
  return false;
}

function checkText(relativePath, pattern, description) {
  if (!exists(relativePath)) {
    fail(`${description}: file missing (${relativePath})`);
    return false;
  }

  const text = read(relativePath);

  if (pattern.test(text)) {
    ok(description);
    return true;
  }

  fail(description);
  return false;
}

function checkAbsent(relativePath, pattern, description) {
  if (!exists(relativePath)) {
    fail(`${description}: file missing (${relativePath})`);
    return false;
  }

  const text = read(relativePath);

  if (!pattern.test(text)) {
    ok(description);
    return true;
  }

  fail(description);
  return false;
}

function walkFiles(directory) {
  const absolute = resolveRepo(directory);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  const result = [];

  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".git" ||
        entry.name === ".vite"
      ) {
        continue;
      }

      const full = path.join(current, entry.name);

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

function findPatternInFiles(files, pattern) {
  const matches = [];

  for (const absolutePath of files) {
    const text = fs.readFileSync(absolutePath, "utf8");

    pattern.lastIndex = 0;

    if (pattern.test(text)) {
      matches.push(path.relative(repoRoot, absolutePath));
    }
  }

  return matches;
}

function heading(title) {
  console.log(`\n${title}`);
}

console.log("\nMilestone 1.32 Mobile Gameplay V1 — closure audit\n");

/* ---------------------------------------------------------
 * Repository root sanity
 * ------------------------------------------------------ */

if (!exists("package.json") || !exists("apps/client/package.json")) {
  fail(
    "run this audit from the monorepo root (expected package.json and apps/client/package.json)"
  );
} else {
  ok("running from monorepo root");
}

/* ---------------------------------------------------------
 * Required Milestone 1.32 files
 * ------------------------------------------------------ */

heading("[1/10] Required mobile files");

[
  "apps/client/src/game/input/MovementInputSource.ts",
  "apps/client/src/game/input/KeyboardMovementInputSource.ts",
  "apps/client/src/game/input/TouchMovementInputSource.ts",
  "apps/client/src/game/input/CompositeMovementInputSource.ts",
  "apps/client/src/game/input/GameActionInputSource.ts",
  "apps/client/src/game/input/KeyboardActionInputSource.ts",
  "apps/client/src/game/input/TouchActionInputSource.ts",
  "apps/client/src/game/input/CompositeActionInputSource.ts",
  "apps/client/src/game/input/MobileActionButton.ts",
  "apps/client/src/game/mobile/VirtualJoystick.ts",
  "apps/client/src/game/mobile/virtual-joystick.css",
  "apps/client/src/game/mobile/mobile-action-button.css",
  "apps/client/src/game/mobile/MobileGameplayUxController.ts",
  "apps/client/src/game/mobile/MobileOrientationHint.ts",
  "apps/client/src/game/mobile/mobile-orientation-hint.css",
  "apps/client/src/game/mobile/MobileVisualViewportController.ts",
  "apps/client/src/game/interaction/WorldInteractionControlsController.ts",
  "apps/client/src/game/ui/MobileTrainerHudDock.ts",
  "apps/client/src/game/ui/mobile-trainer-hud-dock.css",
  "apps/client/src/game/ui/TrainerHudNavigationController.ts",
  "apps/client/src/styles/mobile-gameplay-ux.css",
  "apps/client/src/styles/mobile-trainer-sheets.css",
  "apps/client/src/styles/game-stage-widescreen.css",
  "apps/client/src/game/battle/ui/modern/mobile-battle-ui.css",
  "apps/client/src/game/camera/OverworldCameraController.ts",
  "apps/client/src/game/camera/overworldCameraProfiles.ts",
].forEach(requireFile);

/* ---------------------------------------------------------
 * Fixed logical viewport + Phaser scale
 * ------------------------------------------------------ */

heading("[2/10] Phaser mobile foundation");

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

checkText(
  "apps/client/src/main.ts",
  /mode\s*:\s*Phaser\.Scale\.FIT/,
  "Phaser uses Scale.FIT"
);

checkText(
  "apps/client/src/main.ts",
  /autoCenter\s*:\s*Phaser\.Scale\.CENTER_BOTH/,
  "Phaser uses CENTER_BOTH"
);

checkText(
  "apps/client/src/main.ts",
  /styles\/mobile-gameplay-ux\.css/,
  "main imports mobile gameplay UX stylesheet"
);

checkText(
  "apps/client/src/main.ts",
  /styles\/mobile-trainer-sheets\.css/,
  "main imports mobile trainer sheet stylesheet"
);

checkText(
  "apps/client/src/main.ts",
  /game\/battle\/ui\/modern\/mobile-battle-ui\.css/,
  "main imports the canonical mobile battle stylesheet"
);

checkText(
  "apps/client/src/styles/mobile-gameplay-ux.css",
  /#app\s+canvas\s*\{[\s\S]*?touch-action\s*:\s*none/,
  "touch gestures are disabled on Phaser canvas"
);

checkText(
  "apps/client/src/styles/mobile-gameplay-ux.css",
  /--game-safe-top\s*:\s*env\(safe-area-inset-top/,
  "safe-area variables are defined"
);

/* ---------------------------------------------------------
 * Trainer selection -> world entry
 * ------------------------------------------------------ */

heading("[3/10] Trainer selection → GameScene");

checkText(
  "apps/client/src/game/TrainerSelectionScene.ts",
  /querySelectorAll<HTMLButtonElement>\("\[data-trainer-id\]"\)[\s\S]*?addEventListener\("click"[\s\S]*?this\.selectTrainer\(trainerId\)/,
  "Trainer cards bind click/tap selection"
);

checkText(
  "apps/client/src/game/TrainerSelectionScene.ts",
  /private\s+enterWorld\([\s\S]*?selectedTrainerStore\.select\(trainer\)[\s\S]*?this\.scene\.start\("GameScene"/,
  "selected Trainer is stored before entering GameScene"
);

checkAbsent(
  "apps/client/src/game/TrainerSelectionScene.ts",
  /matchMedia\([\s\S]{0,120}(?:GameScene|enterWorld)|(?:mobile|touch)[\s\S]{0,120}return[\s\S]{0,120}GameScene/i,
  "Trainer selection has no mobile-only block preventing GameScene entry"
);

/* ---------------------------------------------------------
 * Movement input architecture + GameScene wiring
 * ------------------------------------------------------ */

heading("[4/10] Shared movement input pipeline");

checkText(
  "apps/client/src/game/GameScene.ts",
  /new\s+KeyboardMovementInputSource\(keyboard\)/,
  "GameScene creates keyboard movement source"
);

checkText(
  "apps/client/src/game/GameScene.ts",
  /new\s+TouchMovementInputSource\(\)/,
  "GameScene creates touch movement source"
);

checkText(
  "apps/client/src/game/GameScene.ts",
  /new\s+CompositeMovementInputSource\(\s*\[[\s\S]*?keyboardMovementInputSource[\s\S]*?this\.touchMovementInputSource[\s\S]*?\]\s*\)/,
  "keyboard and touch feed one composite movement source"
);

checkText(
  "apps/client/src/game/GameScene.ts",
  /new\s+MovementInputController\(\s*compositeMovementInputSource\s*\)/,
  "composite movement feeds the existing MovementInputController"
);

checkText(
  "apps/client/src/game/GameScene.ts",
  /new\s+VirtualJoystick\([\s\S]*?onChange\s*:\s*\(state\)[\s\S]*?this\.touchMovementInputSource\.setState\(state\)/,
  "VirtualJoystick feeds TouchMovementInputSource instead of player coordinates"
);

checkAbsent(
  "apps/client/src/game/mobile/VirtualJoystick.ts",
  /\bplayer\.(?:x|y)\s*=|setPosition\s*\(/,
  "VirtualJoystick does not directly mutate player position"
);

/* ---------------------------------------------------------
 * VirtualJoystick production behavior
 * ------------------------------------------------------ */

heading("[5/10] VirtualJoystick production safeguards");

const joystickChecks = [
  [/setPointerCapture\s*\(/, "joystick uses pointer capture"],
  [/releasePointerCapture\s*\(/, "joystick releases pointer capture safely"],
  [/"pointercancel"/, "joystick handles pointercancel"],
  [/"lostpointercapture"/, "joystick handles lostpointercapture"],
  [/window\.addEventListener\("blur"/, "joystick resets on window blur"],
  [/matchMedia\("\(orientation: portrait\)"\)/, "joystick tracks orientation changes"],
  [/document\.addEventListener\("visibilitychange"/, "joystick resets on document visibility changes"],
  [/document\.visibilityState\s*===\s*"visible"/, "joystick ignores visible-state reset and resets when hidden"],
  [/getBoundingClientRect\s*\(\)/, "joystick derives runtime geometry from DOM dimensions"],
  [/requestAnimationFrame\s*\(/, "pointermove work is requestAnimationFrame-batched"],
  [/getCoalescedEvents\?\.\(\)/, "joystick consumes latest coalesced pointer event when available"],
  [/translate3d\(/, "joystick knob uses translate3d"],
  [/state\.up\s*===\s*this\.lastMovementState\.up[\s\S]*?return;/, "duplicate movement states are suppressed"],
];

for (const [pattern, description] of joystickChecks) {
  checkText("apps/client/src/game/mobile/VirtualJoystick.ts", pattern, description);
}

checkText(
  "apps/client/src/game/mobile/virtual-joystick.css",
  /\.virtual-joystick__base\s*\{[\s\S]*?width\s*:\s*112px[\s\S]*?height\s*:\s*112px/,
  "joystick base remains 112×112"
);

checkText(
  "apps/client/src/game/mobile/virtual-joystick.css",
  /\.virtual-joystick__knob\s*\{[\s\S]*?width\s*:\s*48px[\s\S]*?height\s*:\s*48px/,
  "joystick knob remains 48×48"
);

checkAbsent(
  "apps/client/src/game/mobile/virtual-joystick.css",
  /\.virtual-joystick__knob\s*\{[\s\S]*?backdrop-filter\s*:/,
  "moving joystick knob has no backdrop-filter"
);

/* ---------------------------------------------------------
 * Shared world action input
 * ------------------------------------------------------ */

heading("[6/10] Shared world action input");

checkText(
  "apps/client/src/game/interaction/WorldInteractionControlsController.ts",
  /new\s+CompositeActionInputSource\(\s*\[[\s\S]*?keyboardActionInputSource[\s\S]*?this\.touchActionInputSource[\s\S]*?\]\s*\)/,
  "keyboard E and touch A share CompositeActionInputSource"
);

checkText(
  "apps/client/src/game/interaction/WorldInteractionControlsController.ts",
  /this\.touchActionInputSource\.trigger\("interact"\)/,
  "mobile A button triggers shared interact action"
);

checkText(
  "apps/client/src/game/GameScene.ts",
  /this\.worldInteractionControls\.consumeInteract\(\)/,
  "GameScene consumes the shared world interaction action"
);

checkText(
  "apps/client/src/game/GameScene.ts",
  /this\.battleController\?\.isBlockingGameplay[\s\S]*?this\.worldInteractionControls\.hide\(\)/,
  "world action presentation is hidden while Battle blocks gameplay"
);

/* ---------------------------------------------------------
 * Mobile HUD + keyboard/viewport UX
 * ------------------------------------------------------ */

heading("[7/10] Mobile HUD, sheets and virtual keyboard");

checkText(
  "apps/client/src/game/ui/TrainerHudNavigationController.ts",
  /new\s+RightHudRail\(/,
  "desktop RightHudRail is preserved"
);

checkText(
  "apps/client/src/game/ui/TrainerHudNavigationController.ts",
  /new\s+MobileTrainerHudDock\(/,
  "mobile HUD dock shares TrainerHudNavigationController"
);

checkText(
  "apps/client/src/game/ui/TrainerHudNavigationController.ts",
  /this\.rightHudRail\.setActivePanel\(activePanel\)[\s\S]*?this\.mobileDock\.setActivePanel\(activePanel\)/,
  "desktop and mobile HUD reflect the same active trainer panel"
);

checkText(
  "apps/client/src/styles/mobile-trainer-sheets.css",
  /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)/,
  "trainer drawers have touch-specific sheet styles"
);

checkText(
  "apps/client/src/game/mobile/MobileVisualViewportController.ts",
  /window\.visualViewport/,
  "VisualViewport API is used for mobile keyboard handling"
);

checkText(
  "apps/client/src/game/mobile/MobileVisualViewportController.ts",
  /game-viewport--keyboard-open/,
  "virtual keyboard toggles game-viewport--keyboard-open state"
);

checkText(
  "apps/client/src/styles/mobile-gameplay-ux.css",
  /#app\.game-viewport--keyboard-open\s+\.virtual-joystick[\s\S]*?\.mobile-action-control[\s\S]*?\.mobile-trainer-hud-dock/,
  "gameplay controls hide while the virtual keyboard is open"
);

checkText(
  "apps/client/src/game/mobile/mobile-orientation-hint.css",
  /orientation:\s*portrait/,
  "portrait gameplay exposes a landscape orientation hint"
);

/* ---------------------------------------------------------
 * Battle touch UI
 * ------------------------------------------------------ */

heading("[8/10] Battle touch integration");

checkText(
  "apps/client/src/game/battle/ui/modern/mobile-battle-ui.css",
  /#app:has\(\.battle-ui-modern:not\(\[hidden\]\)\)[\s\S]*?\.virtual-joystick/,
  "active Battle hides overworld joystick on touch devices"
);

checkText(
  "apps/client/src/game/battle/ui/modern/mobile-battle-ui.css",
  /\.battle-action-menu__button\s*\{[\s\S]*?min-height\s*:\s*48px/,
  "battle Action Menu has touch-sized buttons"
);

checkText(
  "apps/client/src/game/battle/ui/modern/mobile-battle-ui.css",
  /\.battle-modern-move-card\s*\{[\s\S]*?touch-action\s*:\s*manipulation/,
  "battle move cards are touch-optimized"
);

checkText(
  "apps/client/src/game/battle/ui/modern/mobile-battle-ui.css",
  /\.battle-modern-replacement__grid\s*\{[\s\S]*?repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  "battle party/replacement uses mobile landscape grid"
);

const clientSourceFiles = walkFiles("apps/client/src");
const mobileBattleControllerMatches = findPatternInFiles(
  clientSourceFiles,
  /\bMobileBattleController\b/
);

if (mobileBattleControllerMatches.length === 0) {
  ok("no duplicated MobileBattleController exists");
} else {
  fail(`duplicated MobileBattleController reference: ${mobileBattleControllerMatches.join(", ")}`);
}

/* ---------------------------------------------------------
 * Responsive camera + map transition invariant
 * ------------------------------------------------------ */

heading("[9/10] Responsive camera and map bounds");

checkText(
  "apps/client/src/game/camera/overworldCameraProfiles.ts",
  /OUTDOOR_CAMERA_PROFILE[\s\S]*?zoom\s*:\s*1\.5\b/,
  "outdoor base zoom = 1.5"
);

checkText(
  "apps/client/src/game/camera/overworldCameraProfiles.ts",
  /INTERIOR_CAMERA_PROFILE[\s\S]*?zoom\s*:\s*1\.75\b/,
  "interior base zoom = 1.75"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /TOUCH_PRIMARY_QUERY\s*=\s*"\(hover: none\) and \(pointer: coarse\)"/,
  "camera detects touch-primary presentation"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /return\s+profile\.zoom\s*\*\s*TOUCH_CAMERA_ZOOM_MULTIPLIER/,
  "touch camera zoom is derived from the map profile"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /public\s+applyMap\([\s\S]*?this\.camera\.setZoom\(zoom\)[\s\S]*?this\.updateBounds\(map\)/,
  "applyMap always reaches updateBounds after responsive zoom resolution"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /const\s+viewportWidth\s*=\s*this\.camera\.width\s*\/\s*this\.camera\.zoom/,
  "camera bounds account for zoomed viewport width"
);

checkText(
  "apps/client/src/game/camera/OverworldCameraController.ts",
  /const\s+viewportHeight\s*=\s*this\.camera\.height\s*\/\s*this\.camera\.zoom/,
  "camera bounds account for zoomed viewport height"
);

checkAbsent(
  "apps/client/src/game/GameScene.ts",
  /this\.cameras\.main\.setZoom\s*\(/,
  "GameScene does not bypass OverworldCameraController zoom ownership"
);

/* ---------------------------------------------------------
 * Architecture invariants / closure notes
 * ------------------------------------------------------ */

heading("[10/10] Architecture invariants");

const allSourceFiles = [
  ...walkFiles("apps/client/src"),
  ...walkFiles("apps/server/src"),
  ...walkFiles("packages/shared/src"),
];

const mobileProtocolMatches = findPatternInFiles(
  allSourceFiles,
  /\b(?:MobileMovementProtocol|MobilePlayerInput|MobileBattleState|MobileBattleDomain)\b/
);

if (mobileProtocolMatches.length === 0) {
  ok("no mobile-only movement/battle protocol or domain types detected");
} else {
  fail(`mobile-only gameplay protocol/domain detected: ${mobileProtocolMatches.join(", ")}`);
}

checkText(
  "apps/client/src/game/GameScene.ts",
  /this\.virtualJoystick\?\.setEnabled\(!movementInputBlocked\)/,
  "joystick follows the same gameplay blockers as desktop movement"
);

checkText(
  "apps/client/src/game/GameScene.ts",
  /this\.localPlayerController\.predictMovement\([\s\S]*?this\.sendInputIfChanged\(input\)|this\.sendInputIfChanged\(input\)[\s\S]*?this\.localPlayerController\.predictMovement\(/,
  "touch movement continues through prediction/network input flow"
);

if (exists("apps/client/src/game/game.constants.ts")) {
  const constants = read("apps/client/src/game/game.constants.ts");

  if (/OVERWORLD_CAMERA_ZOOM\s*=/.test(constants)) {
    warn(
      "legacy OVERWORLD_CAMERA_ZOOM constant still exists in game.constants.ts; verify it is unused and remove in later cleanup if safe"
    );
  }
}

if (!exists("scripts/audit-milestone-1.32-mobile-gameplay.mjs")) {
  warn(
    "audit file is not yet installed under scripts/. Copy this file to scripts/audit-milestone-1.32-mobile-gameplay.mjs before committing Milestone 1.32 closure"
  );
} else {
  ok("Milestone 1.32 audit is installed under scripts/");
}

warn(
  "this is a structural audit; it does not replace the required real-device regression smoke on iOS/Android"
);

/* ---------------------------------------------------------
 * Output
 * ------------------------------------------------------ */

console.log("\nPASS");
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

  console.log(`\nMilestone 1.32 closure audit failed: ${failures.length} issue(s).\n`);

  process.exitCode = 1;
} else {
  console.log(
    "\nMilestone 1.32 Mobile Gameplay structure passes the closure audit.\n" +
      "Next: run the client build and complete the real-device regression checklist.\n"
  );
}
