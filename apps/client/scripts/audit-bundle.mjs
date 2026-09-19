import { readFile, stat, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const clientRoot = process.cwd();
const distDir = path.join(clientRoot, "dist");
const manifestPath = path.join(distDir, ".vite", "manifest.json");
const reportPath = path.join(distDir, "bundle-audit.json");

const KB = 1024;

function formatKb(bytes) {
  return `${(bytes / KB).toFixed(2)} kB`;
}

async function measureFile(relativePath) {
  const absolutePath = path.join(distDir, relativePath);
  const fileStat = await stat(absolutePath);
  const bytes = await readFile(absolutePath);

  return {
    file: relativePath,
    rawBytes: fileStat.size,
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
  };
}

function collectStaticGraph(manifest, rootKey) {
  const visited = new Set();

  function visit(key) {
    if (!key || visited.has(key)) {
      return;
    }

    const chunk = manifest[key];
    if (!chunk) {
      return;
    }

    visited.add(key);

    for (const importedKey of chunk.imports ?? []) {
      visit(importedKey);
    }
  }

  visit(rootKey);
  return visited;
}

function getChunkKind(chunk) {
  if (chunk.isEntry) {
    return "entry";
  }

  if (chunk.isDynamicEntry) {
    return "dynamic";
  }

  return "shared";
}

async function measureGraph(manifest, keys) {
  const files = new Set();

  for (const key of keys) {
    const chunk = manifest[key];
    if (!chunk) {
      continue;
    }

    if (chunk.file?.endsWith(".js")) {
      files.add(chunk.file);
    }

    for (const cssFile of chunk.css ?? []) {
      files.add(cssFile);
    }
  }

  const measured = [];
  for (const file of files) {
    measured.push(await measureFile(file));
  }

  return measured;
}

function sumMeasurements(measurements) {
  return measurements.reduce(
    (total, item) => ({
      rawBytes: total.rawBytes + item.rawBytes,
      gzipBytes: total.gzipBytes + item.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 }
  );
}

function printTable(rows) {
  const headers = ["kind", "raw", "gzip", "file"];
  const normalized = rows.map((row) => [
    row.kind,
    formatKb(row.rawBytes),
    formatKb(row.gzipBytes),
    row.file,
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...normalized.map((row) => row[index].length))
  );

  const formatRow = (row) =>
    row
      .map((cell, index) => cell.padEnd(widths[index]))
      .join("  ");

  console.log(formatRow(headers));
  console.log(formatRow(widths.map((width) => "-".repeat(width))));

  for (const row of normalized) {
    console.log(formatRow(row));
  }
}

let manifest;

try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(
    `[bundle:audit] Could not read ${manifestPath}. Run the client build first.`,
    error
  );
  process.exitCode = 1;
  process.exit();
}

const jsChunks = [];

for (const [key, chunk] of Object.entries(manifest)) {
  if (!chunk.file?.endsWith(".js")) {
    continue;
  }

  const measured = await measureFile(chunk.file);

  jsChunks.push({
    key,
    kind: getChunkKind(chunk),
    ...measured,
  });
}

jsChunks.sort((a, b) => b.rawBytes - a.rawBytes);

console.log("\n=== JavaScript chunks ===\n");
printTable(jsChunks);

const entryKeys = Object.entries(manifest)
  .filter(([, chunk]) => chunk.isEntry)
  .map(([key]) => key);

const dynamicEntryKeys = Object.entries(manifest)
  .filter(([, chunk]) => chunk.isDynamicEntry)
  .map(([key]) => key);

const initialGraphKeys = new Set();
for (const entryKey of entryKeys) {
  for (const key of collectStaticGraph(manifest, entryKey)) {
    initialGraphKeys.add(key);
  }
}

const initialMeasurements = await measureGraph(manifest, initialGraphKeys);
const initialTotals = sumMeasurements(initialMeasurements);

console.log("\n=== Initial static graph (JS + CSS) ===\n");
console.log(`Raw : ${formatKb(initialTotals.rawBytes)}`);
console.log(`Gzip: ${formatKb(initialTotals.gzipBytes)}`);

const dynamicEntries = [];

for (const dynamicEntryKey of dynamicEntryKeys) {
  const chunk = manifest[dynamicEntryKey];
  const graphKeys = collectStaticGraph(manifest, dynamicEntryKey);

  // The browser already has these after loading the application entry.
  for (const initialKey of initialGraphKeys) {
    graphKeys.delete(initialKey);
  }

  const measurements = await measureGraph(manifest, graphKeys);
  const totals = sumMeasurements(measurements);

  dynamicEntries.push({
    key: dynamicEntryKey,
    file: chunk.file,
    rawBytes: totals.rawBytes,
    gzipBytes: totals.gzipBytes,
  });
}

dynamicEntries.sort((a, b) => b.rawBytes - a.rawBytes);

console.log("\n=== Incremental cost by dynamic entry (JS + CSS) ===\n");

if (dynamicEntries.length === 0) {
  console.log("No dynamic entries found.");
} else {
  printTable(
    dynamicEntries.map((entry) => ({
      kind: "dynamic+deps",
      rawBytes: entry.rawBytes,
      gzipBytes: entry.gzipBytes,
      file: `${entry.key} -> ${entry.file}`,
    }))
  );
}

const largestNonPhaserChunk = jsChunks.find(
  (chunk) => !chunk.file.includes("phaser-vendor")
);

const report = {
  generatedAt: new Date().toISOString(),
  initial: initialTotals,
  chunks: jsChunks,
  dynamicEntries,
  observations: {
    largestNonPhaserChunk: largestNonPhaserChunk
      ? {
          file: largestNonPhaserChunk.file,
          rawBytes: largestNonPhaserChunk.rawBytes,
          gzipBytes: largestNonPhaserChunk.gzipBytes,
        }
      : null,
  },
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`\n[bundle:audit] Report written to ${reportPath}\n`);
