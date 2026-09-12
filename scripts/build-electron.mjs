/* Bundles electron/main.ts + electron/preload.ts into dist/electron/*.js
   (CommonJS, node platform, electron externalized). Pass --watch to rebuild
   on change during `npm run dev`. */
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron", "electron-updater"],
  outdir: "dist/electron",
  sourcemap: true,
};

const ctxMain = await esbuild.context({ ...common, entryPoints: ["electron/main.ts"] });
const ctxPreload = await esbuild.context({ ...common, entryPoints: ["electron/preload.ts"] });

if (watch) {
  await Promise.all([ctxMain.watch(), ctxPreload.watch()]);
  console.log("watching electron/main.ts + electron/preload.ts ...");
} else {
  await ctxMain.rebuild();
  await ctxPreload.rebuild();
  await ctxMain.dispose();
  await ctxPreload.dispose();
  console.log("built dist/electron/{main,preload}.js");
}
