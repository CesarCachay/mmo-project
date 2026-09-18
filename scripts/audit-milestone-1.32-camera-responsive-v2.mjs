import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failures = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\nMilestone 1.32 — Camera Responsive V2 audit\n");

const controllerPath = "apps/client/src/game/camera/OverworldCameraController.ts";
const profilesPath = "apps/client/src/game/camera/overworldCameraProfiles.ts";
const mainPath = "apps/client/src/main.ts";

const controller = read(controllerPath);
const profiles = read(profilesPath);
const main = read(mainPath);

check(
  /mode\s*:\s*Phaser\.Scale\.EXPAND/.test(main),
  "Phaser Scale.EXPAND remains enabled"
);
check(/zoom:\s*1\.5\b/.test(profiles), "outdoor desktop zoom remains 1.5");
check(/zoom:\s*1\.75\b/.test(profiles), "interior desktop zoom remains 1.75");
check(
  /touchLandscapeMinZoom:\s*1\.2\b/.test(profiles),
  "outdoor touch-landscape floor = 1.2"
);
check(
  /touchLandscapeMinZoom:\s*1\.4\b/.test(profiles),
  "interior touch-landscape floor = 1.4"
);

check(
  /REFERENCE_LANDSCAPE_ASPECT\s*=\s*16\s*\/\s*9/.test(controller),
  "16:9 is the responsive camera reference aspect"
);
check(
  /REFERENCE_LANDSCAPE_ASPECT\s*\/\s*viewportAspect/.test(controller),
  "wide touch landscapes derive zoom from viewport aspect"
);
check(
  /profile\.touchLandscapeMinZoom/.test(controller),
  "responsive zoom is clamped by the map profile floor"
);
check(
  !/TOUCH_CAMERA_ZOOM_MULTIPLIER/.test(controller),
  "legacy fixed touch zoom multiplier is removed"
);

check(
  /TOUCH_SAFE_DEADZONE_WIDTH_RATIO/.test(controller) &&
    /TOUCH_SAFE_DEADZONE_HEIGHT_RATIO/.test(controller),
  "touch safe-frame deadzone is viewport-aware"
);
check(
  /private\s+applySafePlayerFraming\(\)/.test(controller),
  "safe player framing uses Phaser's native deadzone"
);
check(
  /this\.camera\.setDeadzone\(deadzoneWidth,\s*deadzoneHeight\)/.test(controller),
  "touch safe framing is applied to the camera follow system"
);
check(
  /TOUCH_LANDSCAPE_LOOK_AHEAD_SCALE\s*=\s*0\.5/.test(controller),
  "touch landscape look-ahead is reduced"
);
check(
  !/this\.camera\.setScroll\(/.test(controller),
  "safe framing does not fight startFollow with manual scroll writes"
);

check(
  /const\s+viewportWidth\s*=\s*this\.camera\.width\s*\/\s*this\.camera\.zoom/.test(
    controller
  ) &&
    /const\s+viewportHeight\s*=\s*this\.camera\.height\s*\/\s*this\.camera\.zoom/.test(
      controller
    ),
  "camera bounds still use zoomed viewport dimensions"
);
check(
  /this\.scale\.on\("resize",\s*this\.handleScaleResize,\s*this\)/.test(controller),
  "ScaleManager resize listener remains installed"
);
check(
  /this\.scale\.off\("resize",\s*this\.handleScaleResize,\s*this\)/.test(controller),
  "ScaleManager resize listener is cleaned up"
);
check(
  /handleScaleResize\(\)[\s\S]*?this\.updateBounds\(map\)[\s\S]*?this\.applySafePlayerFraming\(\)[\s\S]*?this\.camera\.centerOn\(this\.player\.x,\s*this\.player\.y\)/.test(
    controller
  ),
  "resize recalculates bounds, restores safe framing and recenters the player"
);

const referenceAspect = 16 / 9;
const iphoneAspect = 956 / 440;
const outdoorZoom = Math.max(1.2, Math.min(1.5, 1.5 * (referenceAspect / iphoneAspect)));
const interiorZoom = Math.max(
  1.4,
  Math.min(1.75, 1.75 * (referenceAspect / iphoneAspect))
);

console.log("\nReference calculation for a 956×440 touch landscape viewport:");
console.log(`  outdoor  ≈ ${outdoorZoom.toFixed(3)}x`);
console.log(`  interior ≈ ${interiorZoom.toFixed(3)}x`);

check(
  outdoorZoom < 1.5 && outdoorZoom >= 1.2,
  "outdoor example zooms out but respects its floor"
);
check(
  interiorZoom < 1.75 && interiorZoom >= 1.4,
  "interior example zooms out but respects its floor"
);

if (failures > 0) {
  console.error(`\nCamera Responsive V2 audit failed: ${failures} issue(s).`);
  process.exit(1);
}

console.log(
  "\nPASS — Camera Responsive V2 structure is ready for real-device regression.\n"
);
