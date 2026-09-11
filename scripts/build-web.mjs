// Exports the Expo web build from ../9Nerz-mobile and copies it into ./dist
// so Tauri's frontendDist has a stable, local folder to bundle.
import { execSync } from "node:child_process";
import { cpSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const mobileRepo = join(root, "..", "9Nerz-mobile");
const mobileDist = join(mobileRepo, "dist");
const localDist = join(root, "dist");

if (!existsSync(mobileRepo)) {
  console.error(`Expected sibling repo at ${mobileRepo} — not found.`);
  process.exit(1);
}

console.log("Exporting Expo web build from 9Nerz-mobile...");
execSync("npm run export:web", { cwd: mobileRepo, stdio: "inherit" });

if (!existsSync(mobileDist)) {
  console.error(`Export finished but ${mobileDist} does not exist.`);
  process.exit(1);
}

rmSync(localDist, { recursive: true, force: true });
cpSync(mobileDist, localDist, { recursive: true });
console.log(`Copied web build to ${localDist}`);
