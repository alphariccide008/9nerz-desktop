/**
 * Org service — local mirror of app/api/org/* : members, units, roles,
 * permission policy, invites, reporting lines, onboarding and approval requests.
 * Replicates the server-side rank / cycle / scope / free-tier checks.
 */

import { getDB, mutate } from "../db/store";
import {
  FREE_LIMITS,
  OrgUnit,
  PermissionPolicy,
  Role,
  UnitType,
  User,
} from "../db/schema";
import { uid, nowISO, fullName } from "../util";
import {
  ServiceError,
  writeAudit,
  notify,
  reportingChain,
  directReports,
  unitSubtree,
  wouldCycle,
  userById,
  roleOf,
  rankOf,
  primaryUnitId,
  recomputeUnitLocks,
} from "./helpers";

// ── Shaped reads ────────────────────────────────────────────────────────────

export interface MemberView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: User["status"];
  isCompanyAdmin: boolean;
  isEmailVerified: boolean;
  reportsToUserId: string | null;
  roleId: string | null;
  roleName: string | null;
  rank: number | null;
  primaryUnitId: string | null;
  primaryUnitName: string | null;
  /** All units this member belongs to (web parity — a person can serve more than one unit at once). */
  units: { id: string; name: string; isPrimary: boolean }[];
  lastActiveAt: string | null;
}

export function listMembers(companyId: string): MemberView[] {
  const db = getDB();
  return db.users
    .filter((u) => u.companyId === companyId)
    .map((u) => {
      const role = roleOf(db, u);
      const unitId = primaryUnitId(db, u.id);
      const unit = db.orgUnits.find((o) => o.id === unitId);
      const units = db.userOrgUnits
        .filter((l) => l.userId === u.id)
        .map((l) => ({ id: l.orgUnitId, name: db.orgUnits.find((o) => o.id === l.orgUnitId)?.name ?? "", isPrimary: l.isPrimary }));
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        status: u.status,
        isCompanyAdmin: u.isCompanyAdmin,
        isEmailVerified: u.isEmailVerified,
        reportsToUserId: u.reportsToUserId,
        roleId: u.roleId,
        roleName: role?.name ?? null,
        rank: role?.rank ?? null,
        primaryUnitId: unitId,
        primaryUnitName: unit?.name ?? null,
        units,
        lastActiveAt: u.lastActiveAt,
      };
    })
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.firstName.localeCompare(b.firstName));
}

export interface UnitView extends OrgUnit {
  memberCount: number;
  children: UnitView[];
}

export function listUnits(companyId: string): { units: UnitView[]; tree: UnitView[] } {
  const db = getDB();
  const rows = db.orgUnits.filter((u) => u.companyId === companyId);
  const withCount: UnitView[] = rows.map((u) => ({
    ...u,
    memberCount: db.userOrgUnits.filter((l) => l.orgUnitId === u.id).length,
    children: [],
  }));
  const byId = new Map(withCount.map((u) => [u.id, u]));
  const roots: UnitView[] = [];
  for (const u of withCount) {
    if (u.parentUnitId && byId.has(u.parentUnitId)) byId.get(u.parentUnitId)!.children.push(u);
    else roots.push(u);
  }
  return { units: withCount, tree: roots };
}

export interface RoleView extends Role {
  memberCount: number;
}

export function listRoles(companyId: string): RoleView[] {
  const db = getDB();
  return db.roles
    .filter((r) => r.companyId === companyId)
    .map((r) => ({ ...r, memberCount: db.users.filter((u) => u.roleId === r.id).length }))
    .sort((a, b) => a.rank - b.rank);
}

export function getPolicy(companyId: string): PermissionPolicy {
  const p = getDB().permissionPolicies.find((x) => x.companyId === companyId);
  if (!p) throw new ServiceError("Policy not found", "not_found");
  return p;
}

// ── Reporting chain (dashboard) ─────────────────────────────────────────────

export interface ChainView {
  user: { id: string; name: string; role: string | null };
  chain: { id: string; name: string; role: string | null }[];
  directReports: { id: string; name: string; role: string | null; email: string }[];
}

export function reportingChainView(userId: string): ChainView {
  const db = getDB();
  const me = userById(db, userId);
  if (!me) throw new ServiceError("User not found", "not_found");
  const roleName = (u: User | undefined) => (u ? roleOf(db, u)?.name ?? null : null);
  return {
    user: { id: me.id, name: fullName(me), role: roleName(me) },
    chain: reportingChain(db, userId).map((s) => ({ id: s.id, name: fullName(s), role: roleName(s) })),
    directReports: directReports(db, userId).map((r) => ({
      id: r.id,
      name: fullName(r),
      role: roleName(r),
      email: r.email,
    })),
  };
}

// ── Onboarding ─────────────────────────────────────────────────────────────

export function onboardingStatus(userId: string): { needsOnboarding: boolean; isCompanyAdmin: boolean } {
  const db = getDB();
  const me = userById(db, userId);
  if (!me) return { needsOnboarding: false, isCompanyAdmin: false };
  const hasUnit = db.userOrgUnits.some((l) => l.userId === userId);
  const companyUnits = db.orgUnits.some((u) => u.companyId === me.companyId);
  const companyRoles = db.roles.filter((r) => r.companyId === me.companyId).length > 1; // >1 = beyond the seeded admin role
  return {
    needsOnboarding: me.isCompanyAdmin && (!companyUnits || !companyRoles || !hasUnit),
    isCompanyAdmin: me.isCompanyAdmin,
  };
}

export function finishOnboarding(userId: string, unitId: string, roleId: string): void {
  mutate((d) => {
    const me = d.users.find((u) => u.id === userId);
    if (!me) throw new ServiceError("User not found");
    d.userOrgUnits = [
      ...d.userOrgUnits.filter((l) => l.userId !== userId),
      { userId, orgUnitId: unitId, isPrimary: true, createdAt: nowISO() },
    ];
    d.users = d.users.map((u) => (u.id === userId ? { ...u, roleId, updatedAt: nowISO() } : u));
    writeAudit(d, { companyId: me.companyId, actorId: userId, actionType: "onboarding_completed", entityType: "user", entityId: userId });
  });
}

// ── Units CRUD (+ free-tier limits) ────────────────────────────────────────

function assertUnitLimit(companyId: string, unitType: UnitType) {
  const db = getDB();
  const company = db.companies.find((c) => c.id === companyId);
  if (company?.subscriptionTier !== "free") return;
  const units = db.orgUnits.filter((u) => u.companyId === companyId);
  if (unitType === "business_unit" && units.filter((u) => u.unitType === "business_unit").length >= FREE_LIMITS.businessUnits)
    throw new ServiceError(
      `Free tier is capped at ${FREE_LIMITS.businessUnits} business units. Upgrade to add more.`,
      "upgrade_required",
    );
  if (unitType === "department" && units.filter((u) => u.unitType === "department").length >= FREE_LIMITS.departments)
    throw new ServiceError(
      `Free tier is capped at ${FREE_LIMITS.departments} departments. Upgrade to add more.`,
      "upgrade_required",
    );
}

export function createUnit(
  actorId: string,
  input: { name: string; unitType: UnitType; parentUnitId?: string | null },
): OrgUnit {
  const db = getDB();
  const actor = userById(db, actorId);
  if (!actor) throw new ServiceError("Not found", "not_found");
  if (!actor.isCompanyAdmin) throw new ServiceError("Only an admin can change the structure.", "forbidden");
  if (!input.name.trim()) throw new ServiceError("Give the unit a name.");
  assertUnitLimit(actor.companyId, input.unitType);
  const dup = db.orgUnits.some(
    (u) =>
      u.companyId === actor.companyId &&
      (u.parentUnitId ?? null) === (input.parentUnitId ?? null) &&
      u.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (dup) throw new ServiceError("A unit with that name already exists here.");

  const unit: OrgUnit = {
    id: uid("unit"),
    companyId: actor.companyId,
    parentUnitId: input.parentUnitId ?? null,
    name: input.name.trim(),
    unitType: input.unitType,
    hasTopRole: input.unitType === "business_unit",
    createdBy: actorId,
    lockedAt: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  mutate((d) => {
    d.orgUnits = [...d.orgUnits, unit];
    recomputeUnitLocks(d, actor.companyId);
    writeAudit(d, { companyId: actor.companyId, actorId, actionType: "unit_created", entityType: "org_unit", entityId: unit.id, after: { name: unit.name } });
  });
  return unit;
}

export function renameUnit(actorId: string, unitId: string, name: string): void {
  if (!name.trim()) throw new ServiceError("Name can't be empty.");
  mutate((d) => {
    const actor = d.users.find((u) => u.id === actorId);
    const unit = d.orgUnits.find((u) => u.id === unitId);
    if (!actor?.isCompanyAdmin || !unit) throw new ServiceError("Not allowed.", "forbidden");
    const before = unit.name;
    d.orgUnits = d.orgUnits.map((u) => (u.id === unitId ? { ...u, name: name.trim(), updatedAt: nowISO() } : u));
    writeAudit(d, { companyId: unit.companyId, actorId, actionType: "unit_updated", entityType: "org_unit", entityId: unitId, before: { name: before }, after: { name: name.trim() } });
  });
}

export function deleteUnit(actorId: string, unitId: string): void {
  const db = getDB();
  const unit = db.orgUnits.find((u) => u.id === unitId);
  const actor = userById(db, actorId);
  if (!actor?.isCompanyAdmin || !unit) throw new ServiceError("Not allowed.", "forbidden");
  if (db.orgUnits.some((u) => u.parentUnitId === unitId)) throw new ServiceError("Remove the sub-units first.");
  if (db.userOrgUnits.some((l) => l.orgUnitId === unitId)) throw new ServiceError("Move its members out first.");
  if (db.tasks.some((t) => t.orgUnitId === unitId)) throw new ServiceError("This unit still has tasks.");
  mutate((d) => {
    d.orgUnits = d.orgUnits.filter((u) => u.id !== unitId);
    d.ticketRoutingRules = d.ticketRoutingRules.filter((r) => r.orgUnitId !== unitId);
    recomputeUnitLocks(d, unit.companyId);
    writeAudit(d, { companyId: unit.companyId, actorId, actionType: "unit_deleted", entityType: "org_unit", entityId: unitId, before: { name: unit.name } });
  });
}

// ── Roles CRUD ─────────────────────────────────────────────────────────────

export function createRole(actorId: string, name: string): Role {
  const db = getDB();
  const actor = userById(db, actorId);
  if (!actor?.isCompanyAdmin) throw new ServiceError("Only an admin can manage roles.", "forbidden");
  if (!name.trim()) throw new ServiceError("Give the role a name.");
  if (db.roles.some((r) => r.companyId === actor.companyId && r.name.toLowerCase() === name.trim().toLowerCase()))
    throw new ServiceError("A role with that name already exists.");
  const maxRank = Math.max(0, ...db.roles.filter((r) => r.companyId === actor.companyId).map((r) => r.rank));
  const role: Role = {
    id: uid("role"),
    companyId: actor.companyId,
    name: name.trim(),
    rank: maxRank + 1,
    reportsToRoleId: null,
    isAdminRole: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  mutate((d) => {
    d.roles = [...d.roles, role];
    writeAudit(d, { companyId: actor.companyId, actorId, actionType: "role_created", entityType: "role", entityId: role.id, after: { name: role.name } });
  });
  return role;
}

export function patchRole(actorId: string, roleId: string, patch: Partial<Pick<Role, "name" | "rank" | "reportsToRoleId">>): void {
  mutate((d) => {
    const actor = d.users.find((u) => u.id === actorId);
    const role = d.roles.find((r) => r.id === roleId);
    if (!actor?.isCompanyAdmin || !role) throw new ServiceError("Not allowed.", "forbidden");
    d.roles = d.roles.map((r) => (r.id === roleId ? { ...r, ...patch, updatedAt: nowISO() } : r));
    writeAudit(d, { companyId: role.companyId, actorId, actionType: "role_updated", entityType: "role", entityId: roleId, after: patch as Record<string, unknown> });
  });
}

export function swapRoleRank(actorId: string, roleId: string, otherRoleId: string): void {
  mutate((d) => {
    const a = d.roles.find((r) => r.id === roleId);
    const b = d.roles.find((r) => r.id === otherRoleId);
    if (!a || !b) return;
    d.roles = d.roles.map((r) =>
      r.id === a.id ? { ...r, rank: b.rank, updatedAt: nowISO() } : r.id === b.id ? { ...r, rank: a.rank, updatedAt: nowISO() } : r,
    );
    writeAudit(d, { companyId: a.companyId, actorId, actionType: "role_rank_change", entityType: "role", entityId: a.id });
  });
}

export function deleteRole(actorId: string, roleId: string): void {
  const db = getDB();
  const role = db.roles.find((r) => r.id === roleId);
  const actor = userById(db, actorId);
  if (!actor?.isCompanyAdmin || !role) throw new ServiceError("Not allowed.", "forbidden");
  if (role.isAdminRole) throw new ServiceError("The admin role is protected.");
  if (db.users.some((u) => u.roleId === roleId)) throw new ServiceError("Someone still holds this role.");
  mutate((d) => {
    d.roles = d.roles.filter((r) => r.id !== roleId).map((r) => (r.reportsToRoleId === roleId ? { ...r, reportsToRoleId: null } : r));
    writeAudit(d, { companyId: role.companyId, actorId, actionType: "role_deleted", entityType: "role", entityId: roleId, before: { name: role.name } });
  });
}

// ── Member edits ───────────────────────────────────────────────────────────

export function patchMember(
  actorId: string,
  memberId: string,
  patch: {
    roleId?: string | null;
    primaryUnitId?: string | null;
    /** Full replacement set of unit memberships. `primaryUnitId` (if also given) must be one of these; otherwise the first entry is primary. */
    unitIds?: string[];
    reportsToUserId?: string | null;
    status?: User["status"];
  },
): void {
  const db = getDB();
  const actor = userById(db, actorId);
  const member = userById(db, memberId);
  if (!actor || !member) throw new ServiceError("Not found", "not_found");
  const isSelfAdmin = member.isCompanyAdmin;

  if (patch.status !== undefined) {
    if (!actor.isCompanyAdmin) throw new ServiceError("Only an admin can change status.", "forbidden");
    if (isSelfAdmin) throw new ServiceError("The admin can't be deactivated.");
  }
  if (patch.reportsToUserId !== undefined && patch.reportsToUserId) {
    if (wouldCycle(db, memberId, patch.reportsToUserId))
      throw new ServiceError("That would create a reporting loop.");
    const newManager = userById(db, patch.reportsToUserId);
    if (newManager && rankOf(db, newManager) >= rankOf(db, member) && !newManager.isCompanyAdmin)
      throw new ServiceError("A manager must outrank the person they manage.");
  }

  mutate((d) => {
    const before = { roleId: member.roleId, unitId: primaryUnitId(d, memberId), reportsToUserId: member.reportsToUserId, status: member.status };
    d.users = d.users.map((u) =>
      u.id === memberId
        ? {
            ...u,
            roleId: patch.roleId !== undefined ? patch.roleId : u.roleId,
            reportsToUserId: patch.reportsToUserId !== undefined ? patch.reportsToUserId : u.reportsToUserId,
            status: patch.status ?? u.status,
            updatedAt: nowISO(),
          }
        : u,
    );
    if (patch.unitIds !== undefined) {
      const ids = [...new Set(patch.unitIds.filter(Boolean))];
      const primary = patch.primaryUnitId && ids.includes(patch.primaryUnitId) ? patch.primaryUnitId : ids[0] ?? null;
      d.userOrgUnits = d.userOrgUnits.filter((l) => l.userId !== memberId);
      for (const unitId of ids)
        d.userOrgUnits.push({ userId: memberId, orgUnitId: unitId, isPrimary: unitId === primary, createdAt: nowISO() });
    } else if (patch.primaryUnitId !== undefined) {
      d.userOrgUnits = d.userOrgUnits.filter((l) => l.userId !== memberId);
      if (patch.primaryUnitId)
        d.userOrgUnits.push({ userId: memberId, orgUnitId: patch.primaryUnitId, isPrimary: true, createdAt: nowISO() });
    }
    if (patch.unitIds !== undefined || patch.primaryUnitId !== undefined) recomputeUnitLocks(d, member.companyId);
    const action =
      patch.status !== undefined
        ? patch.status === "inactive"
          ? "user_deactivated"
          : "user_reactivated"
        : patch.roleId !== undefined
          ? "role_assigned"
          : patch.reportsToUserId !== undefined
            ? "reporting_line_changed"
            : "department_assigned";
    writeAudit(d, { companyId: member.companyId, actorId, actionType: action, entityType: "user", entityId: memberId, before, after: patch as Record<string, unknown> });
  });
}

// ── Invites ────────────────────────────────────────────────────────────────

export function listInvites(companyId: string) {
  const db = getDB();
  return db.users
    .filter((u) => u.companyId === companyId && u.status === "invited")
    .map((u) => ({
      id: u.id,
      email: u.email,
      role: u.roleId ? { name: db.roles.find((r) => r.id === u.roleId)?.name ?? "" } : null,
      inviteExpires: u.inviteExpires,
      token: u.inviteToken,
    }));
}

export function createInvite(
  actorId: string,
  input: { email: string; firstName?: string; lastName?: string; roleId?: string; unitId?: string; reportsToUserId?: string },
): { token: string; link: string } {
  const db = getDB();
  const actor = userById(db, actorId);
  if (!actor) throw new ServiceError("Not found", "not_found");
  const email = input.email.trim().toLowerCase();
  if (!email) throw new ServiceError("Enter an email address.");
  if (db.users.some((u) => u.email.toLowerCase() === email)) throw new ServiceError("Someone with that email is already here.");

  const policy = getPolicy(actor.companyId);
  if (!actor.isCompanyAdmin) {
    // invite_scope
    const myUnit = primaryUnitId(db, actorId);
    if (policy.inviteScope !== "company_wide") {
      const allowed =
        policy.inviteScope === "own_unit"
          ? myUnit
            ? [myUnit]
            : []
          : myUnit
            ? unitSubtree(db, myUnit)
            : [];
      if (input.unitId && !allowed.includes(input.unitId))
        throw new ServiceError("Your permission policy doesn't let you invite into that unit.", "forbidden");
    }
    // invite_rank_ceiling
    if (input.roleId) {
      const targetRole = db.roles.find((r) => r.id === input.roleId);
      const myRank = rankOf(db, actor);
      if (targetRole) {
        if (policy.inviteRankCeiling === "below_own" && targetRole.rank <= myRank)
          throw new ServiceError("You can only invite people below your own rank.", "forbidden");
        if (policy.inviteRankCeiling === "up_to_own" && targetRole.rank < myRank)
          throw new ServiceError("You can't invite someone more senior than you.", "forbidden");
      }
    }
  }

  const token = uid("inv");
  const userId = uid("usr");
  const ts = nowISO();
  mutate((d) => {
    d.users = [
      ...d.users,
      {
        id: userId,
        companyId: actor.companyId,
        firstName: input.firstName?.trim() || "Invited",
        lastName: input.lastName?.trim() || "User",
        email,
        password: "",
        roleId: input.roleId ?? null,
        reportsToUserId: input.reportsToUserId ?? null,
        isCompanyAdmin: false,
        status: "invited",
        isEmailVerified: false,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        invitedBy: actorId,
        inviteToken: token,
        inviteExpires: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        inviteAcceptedAt: null,
        lastLoginAt: null,
        lastActiveAt: null,
        createdAt: ts,
        updatedAt: ts,
      },
    ];
    if (input.unitId)
      d.userOrgUnits.push({ userId, orgUnitId: input.unitId, isPrimary: true, createdAt: ts });
    d.devInvites = [...d.devInvites, { email, token, companyId: actor.companyId }];
    writeAudit(d, { companyId: actor.companyId, actorId, actionType: "user_invited", entityType: "user", entityId: userId, after: { email } });
  });
  return { token, link: `nerz://accept-invite?token=${token}` };
}

export function revokeInvite(actorId: string, memberId: string): void {
  mutate((d) => {
    const member = d.users.find((u) => u.id === memberId);
    if (!member || member.status !== "invited") return;
    d.users = d.users.filter((u) => u.id !== memberId);
    d.userOrgUnits = d.userOrgUnits.filter((l) => l.userId !== memberId);
    d.devInvites = d.devInvites.filter((i) => i.token !== member.inviteToken);
    writeAudit(d, { companyId: member.companyId, actorId, actionType: "invite_revoked", entityType: "user", entityId: memberId });
  });
}

// ── Data export + self-service org deletion (NDPA/GDPR, migration parity) ──

/**
 * Full JSON export of everything scoped to this company — mirrors
 * app/api/org/export/route.js. Meant to be written to a file and shared with
 * the admin, satisfying a data-portability request.
 */
export function exportOrgData(actorId: string, companyId: string): Record<string, unknown> {
  const db = getDB();
  const actor = userById(db, actorId);
  if (!actor?.isCompanyAdmin || actor.companyId !== companyId) throw new ServiceError("Only an admin can export company data.", "forbidden");
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) throw new ServiceError("Company not found", "not_found");
  const userIds = new Set(db.users.filter((u) => u.companyId === companyId).map((u) => u.id));
  const taskIds = new Set(db.tasks.filter((t) => t.companyId === companyId).map((t) => t.id));
  const ticketIds = new Set(db.tickets.filter((t) => t.companyId === companyId).map((t) => t.id));

  mutate((d) => writeAudit(d, { companyId, actorId, actionType: "org_data_exported", entityType: "company", entityId: companyId }));

  return {
    exportedAt: nowISO(),
    company,
    orgUnits: db.orgUnits.filter((u) => u.companyId === companyId),
    roles: db.roles.filter((r) => r.companyId === companyId),
    users: db.users.filter((u) => u.companyId === companyId).map(({ password, ...rest }) => rest),
    userOrgUnits: db.userOrgUnits.filter((l) => userIds.has(l.userId)),
    permissionPolicy: db.permissionPolicies.find((p) => p.companyId === companyId) ?? null,
    tasks: db.tasks.filter((t) => t.companyId === companyId),
    taskComments: db.taskComments.filter((c) => taskIds.has(c.taskId)),
    tickets: db.tickets.filter((t) => t.companyId === companyId),
    ticketMessages: db.ticketMessages.filter((m) => ticketIds.has(m.ticketId)),
    subscription: db.subscriptions.find((s) => s.companyId === companyId) ?? null,
    payments: db.payments.filter((p) => p.companyId === companyId),
    auditLogs: db.auditLogs.filter((a) => a.companyId === companyId),
  };
}

/**
 * Self-service, permanent org deletion by its own admin (type-to-confirm the
 * company name in the UI before calling this) — mirrors DELETE /api/org.
 * Distinct from super-admin's deleteCompany: only the company's own admin can
 * call this, and it's audited under the company itself, not the platform log.
 */
export function deleteOrgSelfService(actorId: string, companyId: string, confirmName: string): void {
  const db = getDB();
  const actor = userById(db, actorId);
  const company = db.companies.find((c) => c.id === companyId);
  if (!actor?.isCompanyAdmin || !company || actor.companyId !== companyId) throw new ServiceError("Only an admin can delete this workspace.", "forbidden");
  if (confirmName.trim() !== company.name) throw new ServiceError("Type the workspace name exactly to confirm.");
  mutate((d) => {
    d.companies = d.companies.filter((c) => c.id !== companyId);
    d.users = d.users.filter((u) => u.companyId !== companyId);
    d.orgUnits = d.orgUnits.filter((u) => u.companyId !== companyId);
    d.roles = d.roles.filter((r) => r.companyId !== companyId);
    d.userOrgUnits = d.userOrgUnits.filter((l) => !db.users.some((u) => u.id === l.userId && u.companyId === companyId));
    d.permissionPolicies = d.permissionPolicies.filter((p) => p.companyId !== companyId);
    d.approvalRequests = d.approvalRequests.filter((a) => a.companyId !== companyId);
    d.tasks = d.tasks.filter((t) => t.companyId !== companyId);
    d.tickets = d.tickets.filter((t) => t.companyId !== companyId);
    d.ticketInboxes = d.ticketInboxes.filter((i) => i.companyId !== companyId);
    d.ticketRoutingRules = d.ticketRoutingRules.filter((r) => r.companyId !== companyId);
    d.subscriptions = d.subscriptions.filter((s) => s.companyId !== companyId);
    d.paymentMethods = d.paymentMethods.filter((p) => p.companyId !== companyId);
    d.payments = d.payments.filter((p) => p.companyId !== companyId);
    writeAudit(d, { companyId: null, actorId, actionType: "org_self_deleted", entityType: "company", entityId: companyId, before: { name: company.name }, isFlagged: true, flagReason: "Self-service org deletion" });
  });
}

export function updatePolicy(actorId: string, patch: Partial<PermissionPolicy>): PermissionPolicy {
  const db = getDB();
  const actor = userById(db, actorId);
  if (!actor?.isCompanyAdmin) throw new ServiceError("Only an admin can edit the policy.", "forbidden");
  mutate((d) => {
    d.permissionPolicies = d.permissionPolicies.map((p) =>
      p.companyId === actor.companyId ? { ...p, ...patch, updatedAt: nowISO() } : p,
    );
    writeAudit(d, { companyId: actor.companyId, actorId, actionType: "policy_updated", entityType: "permission_policy", entityId: "policy", after: patch as Record<string, unknown> });
  });
  return getPolicy(actor.companyId);
}

// ── Approval requests ──────────────────────────────────────────────────────

export function listApprovals(companyId: string) {
  return getDB().approvalRequests.filter((a) => a.companyId === companyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function decideApproval(actorId: string, requestId: string, decision: "approved" | "rejected", note?: string): void {
  mutate((d) => {
    const actor = d.users.find((u) => u.id === actorId);
    const req = d.approvalRequests.find((a) => a.id === requestId);
    if (!actor?.isCompanyAdmin || !req || req.status !== "pending") throw new ServiceError("Not allowed.", "forbidden");
    d.approvalRequests = d.approvalRequests.map((a) =>
      a.id === requestId ? { ...a, status: decision, decidedBy: actorId, decisionNote: note ?? null, decidedAt: nowISO(), updatedAt: nowISO() } : a,
    );
    if (decision === "approved" && req.actionType === "cross_unit_move") {
      const p = req.payload as { userId: string; toUnitId: string; newManagerId?: string };
      d.userOrgUnits = d.userOrgUnits.filter((l) => l.userId !== p.userId);
      d.userOrgUnits.push({ userId: p.userId, orgUnitId: p.toUnitId, isPrimary: true, createdAt: nowISO() });
      if (p.newManagerId)
        d.users = d.users.map((u) => (u.id === p.userId ? { ...u, reportsToUserId: p.newManagerId!, updatedAt: nowISO() } : u));
    }
    writeAudit(d, { companyId: req.companyId, actorId, actionType: `approval_${decision}`, entityType: "approval_request", entityId: requestId });
    if (req.requestedBy)
      notify(d, {
        companyId: req.companyId,
        userId: req.requestedBy,
        type: "approval_decided",
        title: `Request ${decision}`,
        message: `Your ${req.actionType.replace(/_/g, " ")} request was ${decision}.`,
      });
  });
}
