# 9nerz-desktop

Electron + React (Vite) desktop shell for **9nerz**, replacing the earlier Tauri
scaffold that lived in this repo. It ports `../9Nerz-mobile`'s screens and reuses
its entire business-logic layer (`lib/db`, `lib/services/*`, `lib/session.ts`,
`lib/util.ts`) verbatim — that code has no React Native dependency, so it's
copied as-is rather than rewritten.

## One-time machine setup

- Node.js (already installed, since 9Nerz-mobile needs it)
- Google Chrome or Edge, only if you regenerate the app icon (`npm run icons`)
  uses it headlessly to rasterize `build/logo.svg`
- **Windows Developer Mode** (Settings → Privacy & security → For developers),
  or an elevated (Run as Administrator) terminal — `electron-builder` needs
  permission to create symlinks while unpacking one of its helper packages.
  Without this, `npm run dist` fails with `Cannot create symbolic link: A
  required privilege is not held by the client.`

Then:

```bash
npm install
```

## Run it (dev mode)

```bash
npm run dev
```

Starts the Vite dev server on `http://localhost:5173` and launches Electron
pointed at it, with hot reload for the renderer.

## Build the installer

```bash
npm run dist:win
```

Produces, in `release/`:

- `9nerz Setup <version>.exe` — the NSIS installer (Start Menu shortcut,
  desktop shortcut, uninstaller)
- `latest.yml` + block-map files, used by `electron-updater`

`npm run build` alone just compiles the renderer + main/preload without
packaging, if you want to sanity-check a build.

## Auto-updates

`electron-builder.yml` points `publish` at
`github.com/alphariccide008/9nerz-desktop` (this repo). To ship an update:

1. Bump `version` in `package.json`
2. `npm run dist:win`
3. Create a GitHub release tagged `v<version>` and upload everything in
   `release/` (the `.exe`, `.blockmap`, and `latest.yml`)

Installed copies check that endpoint on launch (`electron-updater` in
`electron/main.ts`) and prompt to update.

## Regenerating the icon

```bash
npm run icons
```

Renders `build/logo.svg` (the real 9nerz mark, ported from mobile's
`LogoMark`) to `build/icon.png` and `build/icon.ico` via a headless Chrome
screenshot. Set `CHROME_PATH` if Chrome isn't at the default Windows location.

## What's ported vs. rebuilt vs. skipped

See the project chat history / PR description for the full breakdown. Short
version: all business logic is verbatim from `9Nerz-mobile/lib`; all UI is
rebuilt in plain React + Tailwind (same color tokens, same component API
surface); the animated 3D welcome-screen background and the ticket
"simulate inbound" dev tool were skipped as out-of-scope decoration/dev-only
utilities.
