import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LEADER_IDS = ["brock", "misty", "surge", "erika", "koga", "sabrina", "giovanni"];

function readPngHeader(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length < 26 || buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${filePath} is not a valid PNG`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25),
  };
}

function assertFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required Gym Leader asset: ${relativePath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Gym Leader asset is empty or invalid: ${relativePath}`);
  }

  return absolutePath;
}

for (const leaderId of LEADER_IDS) {
  const introRelative = `apps/client/public/assets/characters/leaders/${leaderId}/leader-intro.png`;
  const walkRelative = `apps/client/public/assets/characters/leaders/${leaderId}/walk-down.png`;

  const intro = readPngHeader(assertFile(introRelative));
  const walk = readPngHeader(assertFile(walkRelative));

  if (intro.width !== 128 || intro.height !== 128 || intro.colorType !== 6) {
    throw new Error(
      `${introRelative} must be 128x128 PNG RGBA (color type 6); got ${intro.width}x${intro.height}, color type ${intro.colorType}`
    );
  }

  if (walk.width !== 288 || walk.height !== 24 || walk.colorType !== 6) {
    throw new Error(
      `${walkRelative} must be 288x24 PNG RGBA (12x 24x24 frames); got ${walk.width}x${walk.height}, color type ${walk.colorType}`
    );
  }
}

for (const relativePath of [
  "apps/client/public/assets/audio/battle/gym-leader-battle-theme.wav",
  "apps/client/public/assets/audio/battle/gym-leader-battle-victory.wav",
]) {
  assertFile(relativePath);
}

console.log(
  `Gym Leader V1 audit PASS: ${LEADER_IDS.length} presentation sets + dedicated battle audio`
);
