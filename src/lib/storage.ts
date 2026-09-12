/**
 * Thin persistence wrapper — desktop port of the mobile lib/storage.ts.
 * There, AsyncStorage backed it (native store on device, localStorage on web).
 * Here, the preload bridge (electron/preload.ts) exposes `window.nerz.storage`,
 * backed by a JSON file in the OS user-data folder (see electron/main.ts) so data
 * survives reinstalls/updates the way a real app's local store should — falls
 * back to localStorage (e.g. running the renderer in a plain browser during dev)
 * and then an in-memory map if neither is available.
 */

type KV = {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
};

const mem = new Map<string, string>();
const memory: KV = {
  getItem: async (k) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k, v) => void mem.set(k, v),
  removeItem: async (k) => void mem.delete(k),
};

const localStorageBackend: KV | null =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined"
    ? {
        getItem: async (k) => window.localStorage.getItem(k),
        setItem: async (k, v) => void window.localStorage.setItem(k, v),
        removeItem: async (k) => void window.localStorage.removeItem(k),
      }
    : null;

let backend: KV | null =
  typeof window !== "undefined" && window.nerz?.storage ? window.nerz.storage : localStorageBackend;

/** Try the real backend; on any failure, drop to memory for the rest of the session. */
export const storage: KV = {
  async getItem(k) {
    if (!backend) return memory.getItem(k);
    try {
      return await backend.getItem(k);
    } catch {
      backend = null;
      return memory.getItem(k);
    }
  },
  async setItem(k, v) {
    memory.setItem(k, v);
    if (!backend) return;
    try {
      await backend.setItem(k, v);
    } catch {
      backend = null;
    }
  },
  async removeItem(k) {
    memory.removeItem(k);
    if (!backend) return;
    try {
      await backend.removeItem(k);
    } catch {
      backend = null;
    }
  },
};
