import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

const style = read("apps/client/src/style.css");
const camera = read("apps/client/src/game/camera/OverworldCameraController.ts");
const profiles = read("apps/client/src/game/camera/overworldCameraProfiles.ts");

assert(style.includes("--game-topbar-height: 32px"), "touch landscape TopBar is ~20% shorter (32px)");
assert(style.includes("--game-topbar-height: 30px"), "short landscape TopBar is 30px");
assert(style.includes("height: 28px"), "mobile account trigger is visually compact");
assert(style.includes("width: 20px") && style.includes("height: 20px"), "mobile account avatar is compact");

assert(profiles.includes("touchLandscapeMinZoom: 1.26"), "outdoor mobile zoom floor increased to 1.26");
assert(profiles.includes("touchLandscapeMinZoom: 1.47"), "interior mobile zoom floor increased to 1.47");
assert(profiles.includes("touchLandscapeMaxMapFillAdjustment: 0.12"), "map-fill safety budget remains unchanged");

assert(camera.includes("TOUCH_EDGE_BOTTOM_SCREEN_RATIO = 0.085"), "bottom overscan reduced to 8.5% of screen height");
assert(camera.includes("TOUCH_EDGE_BOTTOM_SCREEN_MIN = 28"), "bottom overscan minimum reduced");
assert(camera.includes("TOUCH_EDGE_BOTTOM_SCREEN_MAX = 44"), "bottom overscan maximum reduced");
assert(camera.includes("TOUCH_EDGE_TOP_SCREEN_RATIO = 0.045"), "top overscan reduced proportionally");
assert(camera.includes("this.applySafePlayerFraming()"), "safe framing remains active");
assert(camera.includes("this.resolveZoom(mapId, map)"), "responsive map-aware zoom remains active");

if (!process.exitCode) {
  console.log("\nPASS — Camera Responsive V2.3 compact header + comfort zoom is ready for device regression.");
}
