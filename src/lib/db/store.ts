/**
 * In-memory DB + AsyncStorage persistence, exposed through React's
 * useSyncExternalStore. This is the local stand-in for the Supabase backend:
 * services mutate it, screens read it via `useDB(selector)`.
 *
 * Swap seam: nothing outside lib/services/* and lib/db/* touches this directly.
 */

import { useRef, useSyncExternalStore } from "react";
import { storage } from "../storage";
import { DB, EMPTY_DB } from "./schema";
import { migrateRowShapes } from "./migrate";
import { buildSeed } from "./seed";

const STORAGE_KEY = "nerz:db:v1";

let db: DB = EMPTY_DB;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    storage.setItem(STORAGE_KEY, JSON.stringify(db)).catch((e) =>
      console.warn("[db] persist failed", e),
    );
  }, 120);
}

// ── Public snapshot access ──────────────────────────────────────────────────

export function getDB(): DB {
  return db;
}

export function isHydrated(): boolean {
  return hydrated;
}

/** Apply a mutation to the DB. The recipe receives a shallow-cloned draft it may
 *  freely mutate; arrays are replaced wholesale so identity changes and React
 *  re-renders. Returns whatever the recipe returns. */
export function mutate<T = void>(recipe: (draft: DB) => T): T {
  const draft = { ...db } as Record<string, unknown>;
  // Give the recipe fresh array references so it can push/filter/map in place.
  for (const key of Object.keys(draft)) {
    const v = draft[key];
    if (Array.isArray(v)) draft[key] = [...v];
  }
  const typedDraft = draft as unknown as DB;
  const result = recipe(typedDraft);
  db = typedDraft;
  schedulePersist();
  emit();
  return result;
}

// ── Hydration ───────────────────────────────────────────────────────────────

export async function hydrate(): Promise<void> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DB>;
      db = { ...EMPTY_DB, ...parsed };
      // Backfill any table added since the stored version was written.
      const rec = db as unknown as Record<string, unknown>;
      for (const key of Object.keys(EMPTY_DB)) {
        if (rec[key] === undefined) rec[key] = (EMPTY_DB as unknown as Record<string, unknown>)[key];
      }
      migrateRowShapes(db);
    }
    if (!db.seededAt) {
      db = buildSeed();
      schedulePersist();
    }
  } catch (e) {
    console.warn("[db] hydrate failed, seeding fresh", e);
    db = buildSeed();
    schedulePersist();
  } finally {
    hydrated = true;
    emit();
  }
}

/** Wipe local data and re-seed the demo company. */
export async function resetToSeed(): Promise<void> {
  db = buildSeed();
  await storage.setItem(STORAGE_KEY, JSON.stringify(db));
  emit();
}

// ── React binding ───────────────────────────────────────────────────────────

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Read a slice of the DB. The selector is re-run only when the DB reference
 *  changes (i.e. after a mutation), so returning fresh objects/arrays is safe. */
export function useDB<T>(selector: (db: DB) => T): T {
  const cache = useRef<{ db: DB; value: T } | null>(null);
  const getSnapshot = () => {
    if (!cache.current || cache.current.db !== db) {
      cache.current = { db, value: selector(db) };
    }
    return cache.current.value;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => hydrated,
  );
}
