/**
 * Session state — the local stand-in for JWT auth. Two separate realms, exactly
 * like the web app: company users (`nerz:session`) and the platform owner
 * (`nerz:sa_session`), which never mix.
 */

import { useSyncExternalStore } from "react";
import { storage } from "./storage";

const USER_KEY = "nerz:session:v1";
const SA_KEY = "nerz:sa_session:v1";

type SessionState = {
  userId: string | null;
  superAdminId: string | null;
  ready: boolean;
};

let state: SessionState = { userId: null, superAdminId: null, ready: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadSession(): Promise<void> {
  try {
    const [u, s] = await Promise.all([storage.getItem(USER_KEY), storage.getItem(SA_KEY)]);
    state = { userId: u || null, superAdminId: s || null, ready: true };
  } catch {
    state = { userId: null, superAdminId: null, ready: true };
  }
  emit();
}

export function getSession(): SessionState {
  return state;
}

export async function setUserSession(userId: string): Promise<void> {
  state = { ...state, userId };
  await storage.setItem(USER_KEY, userId);
  emit();
}

export async function clearUserSession(): Promise<void> {
  state = { ...state, userId: null };
  await storage.removeItem(USER_KEY);
  emit();
}

export async function setSuperAdminSession(id: string): Promise<void> {
  state = { ...state, superAdminId: id };
  await storage.setItem(SA_KEY, id);
  emit();
}

export async function clearSuperAdminSession(): Promise<void> {
  state = { ...state, superAdminId: null };
  await storage.removeItem(SA_KEY);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
