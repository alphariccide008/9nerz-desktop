import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import fs from "node:fs";

const isDev = !app.isPackaged;
const DATA_FILE = path.join(app.getPath("userData"), "nerz-store.json");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

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

app.whenReady().then(() => {
  createWindow();
  createTray();
  if (!isDev) autoUpdater.checkForUpdatesAndNotify().catch(() => {});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Tray keeps the app alive on Windows by design; quitting is explicit (tray menu or Alt+F4 loop).
  }
});
