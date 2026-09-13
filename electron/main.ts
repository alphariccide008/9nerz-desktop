import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import fs from "node:fs";

const isDev = !app.isPackaged;
const DATA_FILE = path.join(app.getPath("userData"), "nerz-store.json");
const API_BASE = "https://www.9nerz.com";
const PENDING_SIGNUP_COOKIE = "nerz_pending_signup";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Only one copy of 9nerz may run at a time — without this, every launch (and every
// auto-update relaunch) spawns a new background process instead of reusing the
// existing one, and the leftover processes eventually block reinstalling/updating
// because they keep the installed .exe file open.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

// ── File-backed key/value store (the desktop equivalent of AsyncStorage) ─────
function readStoreFile(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

let storeCache: Record<string, string> | null = null;
function getStore(): Record<string, string> {
  if (!storeCache) storeCache = readStoreFile();
  return storeCache;
}

let writeTimer: NodeJS.Timeout | null = null;
function persistStore() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(getStore()), "utf-8");
  }, 100);
}

ipcMain.handle("nerz:storage:get", (_e, key: string) => getStore()[key] ?? null);
ipcMain.handle("nerz:storage:set", (_e, key: string, value: string) => {
  getStore()[key] = value;
  persistStore();
});
ipcMain.handle("nerz:storage:remove", (_e, key: string) => {
  delete getStore()[key];
  persistStore();
});

ipcMain.handle("nerz:notify", (_e, title: string, body: string) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

ipcMain.handle("nerz:openExternal", (_e, url: string) => shell.openExternal(url));
ipcMain.handle("nerz:appVersion", () => app.getVersion());

// ── Real backend proxy (https://www.9nerz.com/api/*) ─────────────────────────
// Runs in the main process (Node), not the renderer, because the renderer loads
// over file:// in production and a browser fetch() from that origin can't clear
// the API's CORS preflight for authenticated (Bearer-header) requests — Node's
// fetch has no such restriction. The signup flow's short-lived pending-signup
// cookie is captured here and replayed on the matching verify/resend call since
// there is no browser cookie jar to do it automatically.
let pendingSignupCookie: string | null = null;

type ApiRequest = { method: string; path: string; body?: unknown; token?: string | null };
type ApiResult = { ok: boolean; status: number; data: unknown };

ipcMain.handle("nerz:api", async (_e, req: ApiRequest): Promise<ApiResult> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req.token) headers.Authorization = `Bearer ${req.token}`;
  if (pendingSignupCookie) headers.Cookie = pendingSignupCookie;

  try {
    const res = await fetch(`${API_BASE}${req.path}`, {
      method: req.method,
      headers,
      body: req.body !== undefined && req.body !== null ? JSON.stringify(req.body) : undefined,
    });

    const rawCookies =
      typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie") as string]
          : [];
    for (const c of rawCookies) {
      const pair = c.split(";")[0];
      if (!pair?.startsWith(`${PENDING_SIGNUP_COOKIE}=`)) continue;
      const value = pair.slice(PENDING_SIGNUP_COOKIE.length + 1);
      pendingSignupCookie = value ? pair : null;
    }

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // empty body (e.g. 204) — leave data null
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network request failed";
    return { ok: false, status: 0, data: { success: false, message } };
  }
});

ipcMain.handle("nerz:setBadge", (_e, dataUrl: string | null, description?: string) => {
  if (!mainWindow) return;
  if (!dataUrl) {
    mainWindow.setOverlayIcon(null, "");
    if (tray) tray.setToolTip("9nerz");
    return;
  }
  const img = nativeImage.createFromDataURL(dataUrl);
  mainWindow.setOverlayIcon(img, description ?? "Unread notifications");
  if (tray) tray.setToolTip(description ? `9nerz — ${description}` : "9nerz");
});

function iconPath() {
  // Dev: __dirname is dist/electron, so climb to the project root's build/ folder.
  // Packaged: build/icon.png is copied to the resources root via extraResources.
  if (isDev) return path.join(__dirname, "../../build/icon.png");
  return path.join(process.resourcesPath, "icon.png");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#F5F6F8",
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath());
  tray = new Tray(image.isEmpty() ? image : image.resize({ width: 16, height: 16 }));
  tray.setToolTip("9nerz");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open 9nerz", click: () => mainWindow?.show() },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => mainWindow?.show());
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    if (!isDev) {
      // The main window hides-to-tray on close instead of quitting (see createWindow),
      // so electron-updater's normal "install on quit" never fires and a downloaded
      // update sits there forever. Force the install explicitly once the download
      // completes instead of relying on app quit.
      autoUpdater.on("update-downloaded", () => {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      });
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Tray keeps the app alive on Windows by design; quitting is explicit (tray menu or Alt+F4 loop).
  }
});
