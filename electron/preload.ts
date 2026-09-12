import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("nerz", {
  storage: {
    getItem: (key: string) => ipcRenderer.invoke("nerz:storage:get", key),
    setItem: (key: string, value: string) => ipcRenderer.invoke("nerz:storage:set", key, value),
    removeItem: (key: string) => ipcRenderer.invoke("nerz:storage:remove", key),
  },
  notify: (title: string, body: string) => ipcRenderer.invoke("nerz:notify", title, body),
  openExternal: (url: string) => ipcRenderer.invoke("nerz:openExternal", url),
  appVersion: () => ipcRenderer.invoke("nerz:appVersion"),
  setBadge: (dataUrl: string | null, description?: string) => ipcRenderer.invoke("nerz:setBadge", dataUrl, description),
});
