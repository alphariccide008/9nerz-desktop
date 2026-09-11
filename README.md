# 9nerz-desktop

Tauri (Rust) desktop shell for **9nerz**, replacing the old Electron `desktop/`
folder that lived inside `9Nerz-mobile`. It wraps the same Expo web export
(`../9Nerz-mobile` → `npm run export:web`) in a native Windows window, and
supports auto-update via Tauri's updater plugin.

This folder must stay a **sibling** of `9Nerz-mobile` on disk (both under
`Desktop/`) — `scripts/build-web.mjs` reaches into `../9Nerz-mobile` to export
the web build before every `dev`/`build`.

## One-time machine setup

- Rust (`rustup`) — https://rustup.rs
- Microsoft C++ Build Tools (Desktop development with C++ workload) — required
  by the Rust MSVC linker on Windows
- WebView2 Runtime — already ships with Windows 11, so usually nothing to do
- Node.js (already have it, since 9Nerz-mobile needs it)

Then in this folder:

```bash
npm install
```

## Before your first real build — things I need from you

1. **GitHub repo for releases.** `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`
   currently has a placeholder:
   `https://github.com/REPLACE_OWNER/REPLACE_REPO/releases/latest/download/latest.json`
   Replace `REPLACE_OWNER/REPLACE_REPO` with the actual GitHub repo you'll
   publish releases to (can be a new repo just for this, or reuse an existing
   one — it doesn't have to contain code, releases just need to live there).

2. **Signing keypair.** The updater requires every release to be signed.
   Generate it once:

   ```bash
   npm run signer:generate
   ```

   This writes `9nerz-updater.key` (private — **never commit or share this**,
   it's already gitignored) and prints a public key. Copy that public key into
   `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

   When building, point Tauri at the private key so it signs the build:

   ```bash
   # PowerShell
   $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content .\9nerz-updater.key -Raw)
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""   # set if you passworded the key
   ```

   Keep `9nerz-updater.key` somewhere safe outside git (a password manager or
   private note) — if you lose it you can't ship updates that existing installs
   will trust; you'd have to ship a new pubkey and users would need to
   reinstall manually once.

3. **App icons.** Right now `src-tauri/icons/` is empty. Generate them from the
   existing mobile app icon:

   ```bash
   npm run icons
   ```

## Building

```bash
npm run build
```

This runs `build:web` (exports `9Nerz-mobile` → copies into `./dist`), then
`tauri build`, which produces in `src-tauri/target/release/bundle/`:

- `nsis/9nerz_<version>_x64-setup.exe` — the installer
- `nsis/9nerz_<version>_x64-setup.exe.sig` — signature over the installer
- `msi/...` (also built, since `targets` includes `msi`)

`tauri build` with `createUpdaterArtifacts: true` also emits a `latest.json`
next to the bundles (or use `tauri` CLI's updater artifact output — check the
build log for the exact path if it's not there, this varies slightly by CLI
version).

## Publishing a release (same flow you already used once)

1. GitHub → your repo → **Releases** → **New release**
2. Tag it (e.g. `v0.1.0`)
3. Upload the `.exe`, `.sig`, and `latest.json`
4. Publish

Anyone running an older installed build will have it check
`plugins.updater.endpoints` (pointed at
`.../releases/latest/download/latest.json`) and prompt to update.

## Dev loop

```bash
npm run dev
```

## What changed vs. the old Electron setup

- `9Nerz-mobile/desktop/` (Electron) has been removed.
- This is a separate top-level folder/repo, not nested inside `9Nerz-mobile`,
  so it can have its own git history / releases independent of the mobile
  app's repo.
- Auto-update is new — Electron's `desktop/` had none.
