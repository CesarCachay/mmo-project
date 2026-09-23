import { readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = resolve(root, "apps/client/public/assets/maps/tilesets/production");
const manifestPath = resolve(base, "production-map-tilesets.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const pngSignature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
function readPngSize(buffer) {
  if (!buffer.subarray(0,8).equals(pngSignature)) throw new Error("not PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bitDepth: buffer[24], colorType: buffer[25] };
}

const errors=[];
for (const [key, entry] of Object.entries(manifest.tilesets)) {
  const png = resolve(base, entry.png);
  const tsx = resolve(base, entry.tsx);
  try { await access(png); await access(tsx); } catch { errors.push(`${key}: missing png/tsx`); continue; }
  const buf = await readFile(png);
  const info = readPngSize(buf);
  if (info.width % 16 !== 0 || info.height % 16 !== 0) errors.push(`${key}: ${info.width}x${info.height} is not divisible by 16`);
  if (![4,6].includes(info.colorType)) errors.push(`${key}: PNG colorType ${info.colorType} has no alpha channel`);
  const xml = await readFile(tsx,"utf8");
  if (!xml.includes('tilewidth="16"') || !xml.includes('tileheight="16"')) errors.push(`${key}: TSX is not 16x16`);
  if (!xml.includes('runtimeReady" type="bool" value="true"')) errors.push(`${key}: runtimeReady marker missing`);
}
if (manifest.tileSize !== 16) errors.push(`manifest tileSize=${manifest.tileSize}`);
const required=["Ground","GroundDetails","Buildings","AbovePlayer","Collision","Objects"];
if (JSON.stringify(manifest.layerContract)!==JSON.stringify(required)) errors.push("layer contract mismatch");

if (errors.length) {
  console.error("Production map tileset audit FAILED");
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`Production map tileset audit PASS: ${Object.keys(manifest.tilesets).length} tilesets, 16x16 grid, RGBA/runtime-ready contract.`);
