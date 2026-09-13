/**
 * Session state. Two separate realms, exactly like the web app: company users
 * (`nerz:session`) and the platform owner (`nerz:sa_session`), which never mix.
 *
 * `real` holds the live JWT session against https://www.9nerz.com/api — the
 * actual backend — once auth is real (see lib/services/auth.ts). `userId` /
 * `superAdminId` still exist for the parts of the app that haven't been
 * migrated off the local mock database yet (see lib/db/store.ts); once a real
 * session is present, `userId` is kept in sync with `real.user.id` so those
 * hooks reading `useSession().userId` line up with the real signed-in account.
 */

import { useSyncExternalStore } from "react";
import { storage } from "./storage";

const USER_KEY = "nerz:session:v1";
const SA_KEY = "nerz:sa_session:v1";
const REAL_KEY = "nerz:real_session:v1";

export type RealUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string | null;
  companyId: string;
  isCompanyAdmin: boolean;
};

export type RealCompany = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  subscriptionTier?: string;
};

export type RealSession = {
  accessToken: string;
  refreshToken: string;
  user: RealUser;
  company: RealCompany | null;
};

type SessionState = {
  userId: string | null;
  superAdminId: string | null;
  real: RealSession | null;
  ready: boolean;
};

let state: SessionState = { userId: null, superAdminId: null, real: null, ready: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadSession(): Promise<void> {
  try {
    const [u, s, r] = await Promise.all([storage.getItem(USER_KEY), storage.getItem(SA_KEY), storage.getItem(REAL_KEY)]);
    const real: RealSession | null = r ? JSON.parse(r) : null;
    state = { userId: real?.user.id ?? u ?? null, superAdminId: s || null, real, ready: true };
  } catch {
    state = { userId: null, superAdminId: null, real: null, ready: true };
  }
  emit();
}

export function getSession(): SessionState {
  return state;
}

export function getAccessToken(): string | null {
  return state.real?.accessToken ?? null;
}

export async function setUserSession(userId: string): Promise<void> {
  state = { ...state, userId };
  await storage.setItem(USER_KEY, userId);
  emit();
}

export async function clearUserSession(): Promise<void> {
  state = { ...state, userId: null, real: null };
  await Promise.all([storage.removeItem(USER_KEY), storage.removeItem(REAL_KEY)]);
  emit();
}

/** Store a live JWT session from the real backend and make it the active identity. */
export async function setRealSession(real: RealSession): Promise<void> {
  state = { ...state, userId: real.user.id, real };
  await Promise.all([storage.setItem(REAL_KEY, JSON.stringify(real)), storage.setItem(USER_KEY, real.user.id)]);
  emit();
}

/** After a token refresh — same identity, new tokens. */
export async function updateRealTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (!state.real) return;
  const real = { ...state.real, accessToken, refreshToken };
  state = { ...state, real };
  await storage.setItem(REAL_KEY, JSON.stringify(real));
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
