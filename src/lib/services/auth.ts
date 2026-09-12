/**
 * Auth service — local mirror of app/api/auth/* and the signup→company-creation
 * flow. Verification / reset codes are surfaced on-screen (db.devCodes) exactly
 * like the web app prints them to the server console when no email sender is set.
 */

import { getDB, mutate } from "../db/store";
import { User } from "../db/schema";
import {
  uid,
  nowISO,
  sixDigitCode,
  validatePassword,
  isConsumerEmail,
  slugify,
} from "../util";
import { setUserSession, clearUserSession, getSession } from "../session";
import { ServiceError, writeAudit, notify } from "./helpers";

const CODE_TTL_MS = 15 * 60 * 1000;

function findUserByEmail(email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return getDB().users.find((u) => u.email.toLowerCase() === e);
}

function pushCode(email: string, kind: "verification" | "password_reset"): string {
  const code = sixDigitCode();
  mutate((d) => {
    d.devCodes = [
      ...d.devCodes.filter((c) => !(c.email === email && c.kind === kind)),
      { email, code, kind, expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString() },
    ];
  });
  return code;
}

/** In dev we surface the code on-screen; screens read this to show the hint. */
export function peekCode(email: string, kind: "verification" | "password_reset"): string | null {
  const c = getDB().devCodes.find((x) => x.email === email && x.kind === kind);
  if (!c) return null;
  if (new Date(c.expiresAt).getTime() < Date.now()) return null;
  return c.code;
}

// ── Signup → company provisioning ───────────────────────────────────────────

export async function signup(input: {
  organizationName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ email: string; devCode: string }> {
  const email = input.email.trim().toLowerCase();
  if (!input.organizationName.trim() || !input.firstName.trim() || !input.lastName.trim() || !email || !input.password)
    throw new ServiceError("Please fill out all fields.");
  if (isConsumerEmail(email))
    throw new ServiceError("Use a company email — consumer providers like Gmail or Yahoo aren't allowed.");
  const pw = validatePassword(input.password);
  if (!pw.valid) throw new ServiceError(pw.message);
  if (findUserByEmail(email)) throw new ServiceError("An account with that email already exists.");

  const companyId = uid("co");
  const roleId = uid("role");
  const policyId = uid("pol");
  const userId = uid("usr");
  const ts = nowISO();
  let slug = slugify(input.organizationName);
  const taken = new Set(getDB().companies.map((c) => c.slug));
  if (taken.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

  mutate((d) => {
    d.companies = [
      ...d.companies,
      {
        id: companyId,
        name: input.organizationName.trim(),
        slug,
        status: "active",
        subscriptionTier: "free",
        billingReference: null,
        ticketPrefix: "9TC",
        createdAt: ts,
        updatedAt: ts,
      },
    ];
    d.roles = [
      ...d.roles,
      { id: roleId, companyId, name: "Company Admin", rank: 1, reportsToRoleId: null, isAdminRole: true, createdAt: ts, updatedAt: ts },
    ];
    d.permissionPolicies = [
      ...d.permissionPolicies,
      {
        id: policyId,
        companyId,
        inviteScope: "own_unit_and_subunits",
        inviteRankCeiling: "below_own",
        reportingChangeScope: "own_unit",
        approvalRequiredFor: ["cross_unit_move"],
        slaHours: null,
        createdAt: ts,
        updatedAt: ts,
      },
    ];
    d.users = [
      ...d.users,
      {
        id: userId,
        companyId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        password: input.password,
        roleId,
        reportsToUserId: null,
        isCompanyAdmin: true,
        status: "active",
        isEmailVerified: false,
        emailVerificationToken: null,
        emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        passwordResetToken: null,
        passwordResetExpires: null,
        invitedBy: null,
        inviteToken: null,
        inviteExpires: null,
        inviteAcceptedAt: null,
        lastLoginAt: null,
        lastActiveAt: null,
        createdAt: ts,
        updatedAt: ts,
      },
    ];
    d.subscriptions = [
      ...d.subscriptions,
      { id: uid("sub"), companyId, tier: "free", planId: "free", status: "active", provider: null, trialEndsAt: null, isFoundingSub: false, currentPeriodEnd: null, graceEndsAt: null, createdAt: ts, updatedAt: ts },
    ];
    d.ticketInboxes = [
      ...d.ticketInboxes,
      { id: uid("inbox"), companyId, address: `support@${slug}.9nerz.app`, label: "General support", isDefault: true, createdAt: ts },
    ];
    writeAudit(d, { companyId, actorId: userId, actionType: "company_created", entityType: "company", entityId: companyId });
    writeAudit(d, { companyId, actorId: userId, actionType: "signup", entityType: "user", entityId: userId });
  });

  const devCode = pushCode(email, "verification");
  return { email, devCode };
}

export async function verifyEmail(email: string, code: string): Promise<{ userId: string }> {
  const e = email.trim().toLowerCase();
  const rec = getDB().devCodes.find((c) => c.email === e && c.kind === "verification");
  if (!rec || new Date(rec.expiresAt).getTime() < Date.now())
    throw new ServiceError("That code has expired. Request a new one.");
  if (rec.code !== code.trim()) throw new ServiceError("Incorrect code.");
  const user = findUserByEmail(e);
  if (!user) throw new ServiceError("Account not found.");

  mutate((d) => {
    d.users = d.users.map((u) =>
      u.id === user.id ? { ...u, isEmailVerified: true, status: "active", updatedAt: nowISO() } : u,
    );
    d.devCodes = d.devCodes.filter((c) => !(c.email === e && c.kind === "verification"));
    writeAudit(d, { companyId: user.companyId, actorId: user.id, actionType: "email_verified", entityType: "user", entityId: user.id });
  });
  await setUserSession(user.id);
  return { userId: user.id };
}

export function resendVerification(email: string): { devCode: string } {
  const e = email.trim().toLowerCase();
  if (!findUserByEmail(e)) throw new ServiceError("Account not found.");
  return { devCode: pushCode(e, "verification") };
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ userId: string; needsVerification: boolean }> {
  const user = findUserByEmail(email);
  if (!user || user.password !== password) throw new ServiceError("Incorrect email or password.");
  const company = getDB().companies.find((c) => c.id === user.companyId);
  if (company?.status === "frozen") throw new ServiceError("This workspace is frozen. Contact your administrator.");
  if (company?.status === "suspended") throw new ServiceError("This workspace is suspended.");
  if (user.status === "inactive") throw new ServiceError("Your account has been deactivated.");
  if (user.status === "invited") throw new ServiceError("Accept your invitation first — check the link you were sent.");

  if (!user.isEmailVerified) {
    pushCode(user.email, "verification");
    return { userId: user.id, needsVerification: true };
  }

  mutate((d) => {
    d.users = d.users.map((u) =>
      u.id === user.id ? { ...u, lastLoginAt: nowISO(), lastActiveAt: nowISO() } : u,
    );
    writeAudit(d, { companyId: user.companyId, actorId: user.id, actionType: "login", entityType: "user", entityId: user.id });
  });
  await setUserSession(user.id);
  return { userId: user.id, needsVerification: false };
}

export async function logout(): Promise<void> {
  const u = getDB().users.find((x) => x.id === getSession().userId);
  if (u) {
    mutate((d) => writeAudit(d, { companyId: u.companyId, actorId: u.id, actionType: "user_logout", entityType: "user", entityId: u.id }));
  }
  await clearUserSession();
}

// ── Password reset ─────────────────────────────────────────────────────────

export function requestPasswordReset(email: string): { devCode: string; exists: boolean } {
  const user = findUserByEmail(email);
  // Always behave the same to avoid leaking which emails exist.
  if (!user) return { devCode: "", exists: false };
  return { devCode: pushCode(user.email, "password_reset"), exists: true };
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const e = email.trim().toLowerCase();
  const rec = getDB().devCodes.find((c) => c.email === e && c.kind === "password_reset");
  if (!rec || new Date(rec.expiresAt).getTime() < Date.now())
    throw new ServiceError("That reset code has expired.");
  if (rec.code !== code.trim()) throw new ServiceError("Incorrect code.");
  const pw = validatePassword(newPassword);
  if (!pw.valid) throw new ServiceError(pw.message);
  const user = findUserByEmail(e);
  if (!user) throw new ServiceError("Account not found.");
  mutate((d) => {
    d.users = d.users.map((u) => (u.id === user.id ? { ...u, password: newPassword, updatedAt: nowISO() } : u));
    d.devCodes = d.devCodes.filter((c) => !(c.email === e && c.kind === "password_reset"));
    writeAudit(d, { companyId: user.companyId, actorId: user.id, actionType: "password_reset", entityType: "user", entityId: user.id });
  });
}

// ── Invite acceptance ──────────────────────────────────────────────────────

export function inviteByToken(token: string) {
  const user = getDB().users.find((u) => u.inviteToken === token && u.status === "invited");
  if (!user) return null;
  const company = getDB().companies.find((c) => c.id === user.companyId) ?? null;
  return { user, company };
}

export async function acceptInvite(input: {
  token: string;
  firstName?: string;
  lastName?: string;
  password: string;
}): Promise<{ userId: string }> {
  const found = inviteByToken(input.token);
  if (!found) throw new ServiceError("This invitation is invalid or has already been used.");
  const { user } = found;
  if (user.inviteExpires && new Date(user.inviteExpires).getTime() < Date.now())
    throw new ServiceError("This invitation has expired. Ask an admin to resend it.");
  const pw = validatePassword(input.password);
  if (!pw.valid) throw new ServiceError(pw.message);

  mutate((d) => {
    d.users = d.users.map((u) =>
      u.id === user.id
        ? {
            ...u,
            firstName: input.firstName?.trim() || u.firstName,
            lastName: input.lastName?.trim() || u.lastName,
            password: input.password,
            status: "active",
            isEmailVerified: true,
            inviteToken: null,
            inviteAcceptedAt: nowISO(),
            lastLoginAt: nowISO(),
            lastActiveAt: nowISO(),
            updatedAt: nowISO(),
          }
        : u,
    );
    d.devInvites = d.devInvites.filter((i) => i.token !== input.token);
    writeAudit(d, { companyId: user.companyId, actorId: user.id, actionType: "user_approved", entityType: "user", entityId: user.id });
    notify(d, {
      companyId: user.companyId,
      userId: user.invitedBy ?? user.id,
      type: "invite_accepted",
      title: "Invitation accepted",
      message: `${input.firstName || user.firstName} ${input.lastName || user.lastName} joined the workspace.`,
      entityType: "user",
      entityId: user.id,
    });
  });
  await setUserSession(user.id);
  return { userId: user.id };
}

// ── Profile ────────────────────────────────────────────────────────────────

export function updateProfile(userId: string, patch: { firstName: string; lastName: string }): void {
  if (!patch.firstName.trim() || !patch.lastName.trim()) throw new ServiceError("Name can't be empty.");
  mutate((d) => {
    const u = d.users.find((x) => x.id === userId);
    d.users = d.users.map((x) =>
      x.id === userId ? { ...x, firstName: patch.firstName.trim(), lastName: patch.lastName.trim(), updatedAt: nowISO() } : x,
    );
    if (u) writeAudit(d, { companyId: u.companyId, actorId: userId, actionType: "user_updated", entityType: "user", entityId: userId });
  });
}

export function changePassword(userId: string, oldPassword: string, newPassword: string): void {
  const user = getDB().users.find((u) => u.id === userId);
  if (!user) throw new ServiceError("Account not found.");
  if (user.password !== oldPassword) throw new ServiceError("Your current password is incorrect.");
  const pw = validatePassword(newPassword);
  if (!pw.valid) throw new ServiceError(pw.message);
  mutate((d) => {
    d.users = d.users.map((x) => (x.id === userId ? { ...x, password: newPassword, updatedAt: nowISO() } : x));
    writeAudit(d, { companyId: user.companyId, actorId: userId, actionType: "password_changed", entityType: "user", entityId: userId });
  });
}

export function ping(userId: string): void {
  mutate((d) => {
    d.users = d.users.map((x) => (x.id === userId ? { ...x, lastActiveAt: nowISO() } : x));
  });
}
