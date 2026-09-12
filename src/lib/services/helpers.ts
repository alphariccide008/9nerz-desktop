/**
 * Shared service internals: audit + notification writers, and the org-graph
 * resolvers that mirror the Postgres functions in supabase/schema.sql
 * (user_reporting_chain, org_unit_subtree) plus the rank / cycle checks.
 */

import { DB, FREE_LIMITS, Role, User } from "../db/schema";
import { uid, nowISO, fullName } from "../util";

// ── Writers ─────────────────────────────────────────────────────────────────

export function writeAudit(
  draft: DB,
  input: {
    companyId: string | null;
    actorId: string | null;
    actorType?: "user" | "super_admin" | "system";
    actionType: string;
    entityType?: string;
    entityId?: string;
    orgUnitId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    isFlagged?: boolean;
    flagReason?: string;
  },
) {
  draft.auditLogs = [
    {
      id: uid("audit"),
      companyId: input.companyId,
      orgUnitId: input.orgUnitId ?? null,
      actorId: input.actorId,
      actorType: input.actorType ?? "user",
      actionType: input.actionType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      beforeState: input.before ?? null,
      afterState: input.after ?? null,
      isFlagged: input.isFlagged ?? false,
      flagReason: input.flagReason ?? null,
      createdAt: nowISO(),
    },
    ...draft.auditLogs,
  ];
}

export function notify(
  draft: DB,
  input: {
    companyId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (!input.userId) return;
  draft.notifications = [
    {
      id: uid("notif"),
      companyId: input.companyId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      isRead: false,
      readAt: null,
      metadata: input.metadata ?? null,
      createdAt: nowISO(),
    },
    ...draft.notifications,
  ];
}

export function writeSuperAdminAudit(
  draft: DB,
  input: { superAdminId: string | null; actionType: string; targetCompanyId?: string | null; details: string },
) {
  draft.superAdminAuditLogs = [
    {
      id: uid("saaudit"),
      superAdminId: input.superAdminId,
      actionType: input.actionType,
      targetCompanyId: input.targetCompanyId ?? null,
      details: input.details,
      createdAt: nowISO(),
    },
    ...draft.superAdminAuditLogs,
  ];
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export function userById(db: DB, id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return db.users.find((u) => u.id === id);
}

export function roleOf(db: DB, user: User | undefined): Role | undefined {
  if (!user?.roleId) return undefined;
  return db.roles.find((r) => r.id === user.roleId);
}

export function rankOf(db: DB, user: User | undefined): number {
  const r = roleOf(db, user);
  // No role = lowest authority. Company admin outranks everyone.
  if (user?.isCompanyAdmin) return -1;
  return r ? r.rank : 999;
}

export function primaryUnitId(db: DB, userId: string): string | null {
  const link = db.userOrgUnits.find((l) => l.userId === userId && l.isPrimary);
  return link?.orgUnitId ?? db.userOrgUnits.find((l) => l.userId === userId)?.orgUnitId ?? null;
}

export function displayName(db: DB, id: string | null | undefined): string {
  const u = userById(db, id);
  return u ? fullName(u) : "—";
}

// ── Org graph resolvers ─────────────────────────────────────────────────────

/** Ordered list of a user's superiors, nearest first (mirrors user_reporting_chain). */
export function reportingChain(db: DB, userId: string): User[] {
  const out: User[] = [];
  let cur = userById(db, userId)?.reportsToUserId ?? null;
  let depth = 0;
  while (cur && depth < 100) {
    const sup = userById(db, cur);
    if (!sup) break;
    out.push(sup);
    cur = sup.reportsToUserId;
    depth += 1;
  }
  return out;
}

/** Everyone whose reporting chain passes through `managerId` (their subtree). */
export function reportingSubtree(db: DB, managerId: string): User[] {
  const direct = db.users.filter((u) => u.reportsToUserId === managerId);
  const all: User[] = [...direct];
  for (const d of direct) all.push(...reportingSubtree(db, d.id));
  return all;
}

export function directReports(db: DB, managerId: string): User[] {
  return db.users.filter((u) => u.reportsToUserId === managerId && u.status !== "inactive");
}

/** A unit plus all descendant units (mirrors org_unit_subtree). */
export function unitSubtree(db: DB, unitId: string): string[] {
  const out = [unitId];
  const children = db.orgUnits.filter((u) => u.parentUnitId === unitId);
  for (const c of children) out.push(...unitSubtree(db, c.id));
  return out;
}

/** True if setting `userId`.reportsTo = `managerId` would create a cycle. */
export function wouldCycle(db: DB, userId: string, managerId: string): boolean {
  if (userId === managerId) return true;
  let cur: string | null = managerId;
  let depth = 0;
  while (cur && depth < 100) {
    if (cur === userId) return true;
    cur = userById(db, cur)?.reportsToUserId ?? null;
    depth += 1;
  }
  return false;
}

/**
 * Assignment right (Stage 3 rule): the actor may create/manage a task for the
 * assignee if the actor is anywhere in the assignee's upward reporting chain,
 * or in the same primary unit at a strictly higher rank, or a company admin.
 */
export function canAssignTo(db: DB, actor: User, assigneeId: string): boolean {
  if (actor.isCompanyAdmin) return true;
  if (actor.id === assigneeId) return false;
  const chain = reportingChain(db, assigneeId);
  if (chain.some((c) => c.id === actor.id)) return true;
  const assignee = userById(db, assigneeId);
  if (!assignee) return false;
  const sameUnit = primaryUnitId(db, actor.id) && primaryUnitId(db, actor.id) === primaryUnitId(db, assigneeId);
  if (sameUnit && rankOf(db, actor) < rankOf(db, assignee)) return true;
  return false;
}

/** Members visible to `actor` for assignment: their whole reporting subtree. */
export function assignableMembers(db: DB, actor: User): User[] {
  if (actor.isCompanyAdmin) {
    return db.users.filter((u) => u.companyId === actor.companyId && u.id !== actor.id && u.status === "active");
  }
  return reportingSubtree(db, actor.id).filter((u) => u.status === "active");
}

// ── Errors ──────────────────────────────────────────────────────────────────

export class ServiceError extends Error {
  code: string;
  constructor(message: string, code = "error") {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

/**
 * Recomputes which org units are "locked" for a free-tier company that's over
 * its structural caps (mirrors web's lockedUnitIds — see app/api/tasks/route.js).
 * Rather than blocking a downgrade outright, the *newest* business units /
 * departments beyond the allowed count are frozen, and any unit with more
 * than FREE_LIMITS.peoplePerUnit members is frozen regardless of age. Paid
 * companies (or a company with nothing over cap) always come out fully unlocked.
 */
export function recomputeUnitLocks(draft: DB, companyId: string): void {
  const company = draft.companies.find((c) => c.id === companyId);
  const units = draft.orgUnits.filter((u) => u.companyId === companyId);
  const locked = new Set<string>();

  if (company?.subscriptionTier === "free") {
    for (const type of ["business_unit", "department"] as const) {
      const ofType = units.filter((u) => u.unitType === type).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const limit = type === "business_unit" ? FREE_LIMITS.businessUnits : FREE_LIMITS.departments;
      for (const u of ofType.slice(limit)) locked.add(u.id);
    }
    for (const u of units) {
      const memberCount = draft.userOrgUnits.filter((l) => l.orgUnitId === u.id).length;
      if (memberCount > FREE_LIMITS.peoplePerUnit) locked.add(u.id);
    }
  }

  draft.orgUnits = draft.orgUnits.map((u) =>
    u.companyId === companyId
      ? { ...u, lockedAt: locked.has(u.id) ? (u.lockedAt ?? nowISO()) : null }
      : u,
  );
}

export function requireCompany(db: DB, companyId: string) {
  const c = db.companies.find((x) => x.id === companyId);
  if (!c) throw new ServiceError("Company not found", "not_found");
  if (c.status === "frozen") throw new ServiceError("This workspace is frozen. Contact your administrator.", "frozen");
  if (c.status === "suspended") throw new ServiceError("This workspace is suspended.", "suspended");
  return c;
}
