/**
 * Auth service — calls the real, live backend at https://www.9nerz.com/api/auth/*
 * and app/api/org/invites/* (see lib/api/http.ts for the transport). This is the
 * first service migrated off the local mock database (lib/db/store.ts) per the
 * "swap seam" the app was built around — org/tasks/tickets/etc. are still local
 * mock data for now and will move over in later passes.
 */

import { apiRequest, ApiError } from "../api/http";
import { ServiceError } from "./helpers";
import {
  setRealSession,
  clearUserSession,
  getSession,
  getAccessToken,
  updateRealTokens,
  RealSession,
} from "../session";

type LoginResponse = { user: RealSession["user"]; accessToken: string; refreshToken: string };
type VerifyResponse = { user: RealSession["user"]; company: RealSession["company"]; accessToken: string; refreshToken: string };

function rethrow(e: unknown, fallback: string): never {
  if (e instanceof ApiError) throw new ServiceError(e.message || fallback, e.code ?? "error");
  throw new ServiceError(fallback);
}

// ── Signup → verify (company provisioning happens server-side on verify) ────

export async function signup(input: {
  organizationName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ email: string }> {
  const email = input.email.trim().toLowerCase();
  try {
    await apiRequest("POST", "/api/auth/signup", {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      password: input.password,
      companyName: input.organizationName.trim(),
    });
    return { email };
  } catch (e) {
    rethrow(e, "Signup failed. Please try again.");
  }
}

export async function verifyEmail(email: string, code: string): Promise<{ userId: string }> {
  try {
    const data = await apiRequest<VerifyResponse>("POST", "/api/auth/verify-email", {
      email: email.trim().toLowerCase(),
      otp: code.trim(),
    });
    await setRealSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user, company: data.company });
    return { userId: data.user.id };
  } catch (e) {
    rethrow(e, "Verification failed.");
  }
}

export async function resendVerification(email: string): Promise<void> {
  try {
    await apiRequest("POST", "/api/auth/resend-otp", { email: email.trim().toLowerCase() });
  } catch (e) {
    rethrow(e, "Could not resend the code.");
  }
}

/** Dev-mode code hint — the real backend emails codes, never surfaces them on screen. */
export function peekCode(_email: string, _kind: "verification" | "password_reset"): string | null {
  return null;
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ userId: string; needsVerification: boolean }> {
  try {
    const data = await apiRequest<LoginResponse>("POST", "/api/auth/login", { email: email.trim().toLowerCase(), password });
    await setRealSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user, company: null });
    return { userId: data.user.id, needsVerification: false };
  } catch (e) {
    if (e instanceof ApiError && /not verified/i.test(e.message)) {
      return { userId: "", needsVerification: true };
    }
    rethrow(e, "Login failed. Please try again.");
  }
}

export async function logout(): Promise<void> {
  await clearUserSession();
}

// ── Password reset ─────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await apiRequest("POST", "/api/auth/request-password-reset", { email: email.trim().toLowerCase() });
  } catch {
    // The endpoint always responds the same way regardless of whether the email
    // exists, by design — nothing to surface to the user either way.
  }
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  try {
    await apiRequest("POST", "/api/auth/reset-password", { email: email.trim().toLowerCase(), otp: code.trim(), newPassword });
  } catch (e) {
    rethrow(e, "Reset failed.");
  }
}

// ── Invite acceptance (real flow is two steps: set password, then confirm the
//    emailed OTP — unlike the old one-step mock flow) ───────────────────────

export async function previewInvite(token: string): Promise<{
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  role: string | null;
  passwordSet: boolean;
} | null> {
  try {
    return await apiRequest("GET", `/api/org/invites/accept?token=${encodeURIComponent(token)}`);
  } catch {
    return null;
  }
}

export async function startInviteAccept(input: { token: string; firstName?: string; lastName?: string; password: string }): Promise<{ email: string }> {
  try {
    const data = await apiRequest<{ email: string }>("POST", "/api/org/invites/accept", input);
    return { email: data.email };
  } catch (e) {
    rethrow(e, "Could not start accepting the invitation.");
  }
}

export async function confirmInviteAccept(input: { token: string; otp: string }): Promise<{ userId: string }> {
  try {
    const data = await apiRequest<VerifyResponse>("POST", "/api/org/invites/verify", { token: input.token, otp: input.otp.trim() });
    await setRealSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user, company: data.company });
    return { userId: data.user.id };
  } catch (e) {
    rethrow(e, "Could not confirm the invitation.");
  }
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function updateProfile(_userId: string, patch: { firstName: string; lastName: string }): Promise<void> {
  try {
    await apiRequest("PATCH", "/api/auth/profile", patch, getAccessToken());
  } catch (e) {
    rethrow(e, "Could not update your profile.");
  }
}

export async function changePassword(_userId: string, oldPassword: string, newPassword: string): Promise<void> {
  try {
    await apiRequest("PATCH", "/api/auth/update-password", { oldPassword, newPassword, confirmPassword: newPassword }, getAccessToken());
  } catch (e) {
    rethrow(e, "Could not change your password.");
  }
}

/** Refresh the access token using the stored refresh token; clears the session if it's no longer valid. */
export async function refreshSession(): Promise<boolean> {
  const real = getSession().real;
  if (!real) return false;
  try {
    const data = await apiRequest<{ accessToken: string; refreshToken: string }>("POST", "/api/auth/refresh", { refreshToken: real.refreshToken });
    await updateRealTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    await clearUserSession();
    return false;
  }
}

export function ping(): void {
  const token = getAccessToken();
  if (!token) return;
  apiRequest("POST", "/api/auth/ping", undefined, token).catch(() => {});
}
