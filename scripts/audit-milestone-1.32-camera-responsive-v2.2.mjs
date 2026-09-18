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

const camera = read("apps/client/src/game/camera/OverworldCameraController.ts");
const style = read("apps/client/src/style.css");

assert(style.includes("Touch landscape — compact TopBar"), "touch-landscape compact TopBar is installed");
assert(style.includes("--game-topbar-height: 40px"), "mobile landscape TopBar baseline is 40px");
assert(style.includes("--game-topbar-height: 38px"), "short mobile landscape TopBar is 38px");
assert(style.includes("(hover: none) and (pointer: coarse) and (orientation: landscape)"), "TopBar compaction is device/orientation based, not width-only");

assert(camera.includes("TOUCH_EDGE_TOP_SCREEN_RATIO"), "touch top-edge camera overscan is configured");
assert(camera.includes("TOUCH_EDGE_BOTTOM_SCREEN_RATIO"), "touch bottom-edge camera overscan is configured");
assert(camera.includes("bottomScreenPadding / this.camera.zoom"), "screen-space bottom safety converts to world units");
assert(camera.includes("mapHeight + topPadding + bottomPadding"), "camera bounds include asymmetric vertical edge padding");
assert(camera.includes("TOUCH_LANDSCAPE_LOOK_AHEAD_Y_SCALE = 0"), "vertical look-ahead is disabled on touch landscape");
assert(camera.includes("this.applySafePlayerFraming()"), "safe framing remains active");
assert(camera.includes("this.resolveZoom(mapId, map)"), "responsive V2.1 zoom/map-fill logic remains active");

if (!process.exitCode) {
  console.log("\nPASS — Camera Responsive V2.2 edge framing is ready for device regression.");
}
