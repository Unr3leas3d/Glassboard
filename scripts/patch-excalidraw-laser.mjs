/**
 * Patches Excalidraw's laser trail decay to be 25% more persistent.
 * Default: DECAY_TIME=1000ms, DECAY_LENGTH=50
 * Patched: DECAY_TIME=1250ms, DECAY_LENGTH=63
 *
 * Run automatically via the "postinstall" npm script.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const patches = [
  {
    file: join(root, "node_modules/@excalidraw/excalidraw/dist/dev/index.js"),
    from: "const DECAY_TIME = 1e3;\n        const DECAY_LENGTH = 50;",
    to:   "const DECAY_TIME = 1250;\n        const DECAY_LENGTH = 63;",
  },
  {
    file: join(root, "node_modules/@excalidraw/excalidraw/dist/prod/index.js"),
    from: "let n=Math.max(0,1-(performance.now()-o.pressure)/1e3),i=(50-Math.min(50,o.totalLength-o.currentIndex))/50",
    to:   "let n=Math.max(0,1-(performance.now()-o.pressure)/1250),i=(63-Math.min(63,o.totalLength-o.currentIndex))/63",
  },
];

for (const { file, from, to } of patches) {
  try {
    const content = readFileSync(file, "utf8");
    if (content.includes(to)) {
      console.log(`[laser-patch] Already patched: ${file}`);
      continue;
    }
    if (!content.includes(from)) {
      console.warn(`[laser-patch] Pattern not found (version mismatch?): ${file}`);
      continue;
    }
    writeFileSync(file, content.replace(from, to), "utf8");
    console.log(`[laser-patch] Patched: ${file}`);
  } catch (err) {
    console.warn(`[laser-patch] Skipped ${file}: ${err.message}`);
  }
}
