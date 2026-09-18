import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const controllerPath = path.join(root, "apps/client/src/game/camera/OverworldCameraController.ts");
const profilesPath = path.join(root, "apps/client/src/game/camera/overworldCameraProfiles.ts");
const stylePath = path.join(root, "apps/client/src/style.css");

const failures = [];
const pass = (label) => console.log(`  ✓ ${label}`);
const fail = (label) => { failures.push(label); console.log(`  ✗ ${label}`); };
const expect = (condition, label) => condition ? pass(label) : fail(label);
const read = (file) => fs.readFileSync(file, "utf8");

console.log("Milestone 1.32 Camera Responsive V2.4 — cover-biased framing audit\n");

for (const file of [controllerPath, profilesPath, stylePath]) {
  expect(fs.existsSync(file), `exists: ${path.relative(root, file)}`);
}

if (failures.length === 0) {
  const controller = read(controllerPath);
  const profiles = read(profilesPath);
  const style = read(stylePath);

  console.log("\n[1/3] Minimal sprite-aware edge framing");
  expect(controller.includes("playerHalfHeightScreen"), "edge padding uses the real player sprite height");
  expect(controller.includes("TOUCH_EDGE_TOP_CLEARANCE_SCREEN = 6"), "top comfort clearance = 6px");
  expect(controller.includes("TOUCH_EDGE_BOTTOM_CLEARANCE_SCREEN = 12"), "bottom comfort clearance = 12px");
  expect(controller.includes("TOUCH_EDGE_BOTTOM_SCREEN_MAX = 42"), "bottom overscan is capped at 42px");
  expect(controller.includes("this.camera.centerOn"), "camera still recenters on resize/map transition");
  expect(controller.includes("this.camera.setDeadzone"), "safe follow deadzone remains active");

  console.log("\n[2/3] Cover-biased mobile zoom");
  expect(controller.includes("TOUCH_LANDSCAPE_COMFORT_ZOOM_MULTIPLIER = 1.08"), "mobile comfort zoom = +8%");
  expect(controller.includes("profile.touchLandscapeMaxZoom"), "mobile zoom has a profile-controlled upper bound");
  expect(profiles.includes("touchLandscapeMaxZoom: 1.58"), "outdoor mobile max zoom = 1.58");
  expect(profiles.includes("touchLandscapeMaxZoom: 1.84"), "interior mobile max zoom = 1.84");
  expect(profiles.includes("touchLandscapeMaxMapFillAdjustment: 0.35"), "outdoor map-fill budget = 35%");
  expect(profiles.includes("touchLandscapeMaxMapFillAdjustment: 0.30"), "interior map-fill budget = 30%");

  console.log("\n[3/3] Compact header preserved");
  expect(style.includes("--game-topbar-height: 32px;"), "touch landscape header remains 32px");
  expect(style.includes("--game-topbar-height: 30px;"), "short touch landscape header remains 30px");
}

console.log();
if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} issue(s) found.`);
  process.exit(1);
}
console.log("PASS — V2.4 prioritizes player visibility and minimal empty gutters with a closer mobile camera.");
