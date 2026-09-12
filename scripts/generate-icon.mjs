/* Renders build/logo.svg (the real 9nerz mark, ported from mobile's LogoMark)
   to build/icon.png (512, for tray/Linux/mac later) and build/icon.ico
   (multi-size, for the Windows installer + app icon).
   Uses puppeteer-core + a local Chrome, same pattern as 9Nerz-mobile's
   scripts/render-check.mjs. Set CHROME_PATH if Chrome isn't at the default
   Windows location. Run: npm run icons */
import puppeteer from "puppeteer-core";
import pngToIco from "png-to-ico";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, "..", "build");
const SVG = fs.readFileSync(path.join(BUILD_DIR, "logo.svg"), "utf-8");
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// The SVG has fixed width="200" height="200" attributes, so without overriding
// them it always renders at 200x200 regardless of viewport — at any screenshot
// size smaller than 200 that means the shot only captures a cropped top-left
// corner of the badge, and at larger sizes it leaves it small with blank space
// around it. Forcing width/height via CSS makes it scale to fill the viewport.
// Padded so the badge's own rounded corners sit inset from the icon's square
// canvas, instead of touching it edge-to-edge (which visually clashes with
// Windows' own icon-corner rounding). Background stays transparent.
const html = `<!doctype html><html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body { display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; }
  svg { display: block; width: 82%; height: 82%; }
</style></head><body>${SVG}</body></html>`;

async function renderAt(page, size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(html);

const sizes = [16, 32, 48, 64, 128, 256, 512];
const buffers = {};
for (const s of sizes) buffers[s] = await renderAt(page, s);
await browser.close();

fs.writeFileSync(path.join(BUILD_DIR, "icon.png"), buffers[512]);

const icoBuffer = await pngToIco([buffers[16], buffers[32], buffers[48], buffers[64], buffers[128], buffers[256]]);
fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), icoBuffer);

console.log("Wrote build/icon.png and build/icon.ico");
