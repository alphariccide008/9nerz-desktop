/**
 * Pulls the real company's org data (units, roles, members) from
 * https://www.9nerz.com/api/org/* and caches it into the same local `db` store
 * that org.ts / tasks.ts / tickets.ts already read from — so Structure, Roles,
 * People, Reporting and the Dashboard's reporting-line widgets light up with
 * real data without any changes to those screens. Real rows use their real
 * (Supabase UUID) ids, which never collide with the local mock seed's ids, so
 * this only ever replaces previously-synced real data, never mock demo data.
 */

import { apiRequest } from "../api/http";
import { mutate } from "../db/store";
import { OrgUnit, Role, User, UserOrgUnit } from "../db/schema";
import { getAccessToken, getSession } from "../session";

type RealUnit = {
  id: string;
  name: string;
  unit_type: string;
  parent_unit_id: string | null;
  has_top_role: boolean;
  locked_at: string | null;
  created_at: string;
};
type RealRole = {
  id: string;
  name: string;
  rank: number;
  reports_to_role_id: string | null;
  is_admin_role: boolean;
  created_at: string;
};
type RealMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  is_company_admin: boolean;
  is_email_verified: boolean;
  reports_to_user_id: string | null;
  role_id: string | null;
  primary_unit_id: string | null;
  unit_ids: string[];
  last_active_at: string | null;
  created_at: string;
};

let inFlight: Promise<void> | null = null;

/** Fetch + cache real org data for the current real session. Safe to call
 *  repeatedly (e.g. on every AppLayout mount) — coalesces concurrent calls. */
export function syncRealOrgData(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<void> {
  const real = getSession().real;
  if (!real) return;
  const token = getAccessToken();
  const companyId = real.user.companyId;

  try {
    const [unitsRes, rolesRes, membersRes] = await Promise.all([
      apiRequest<{ units: RealUnit[] }>("GET", "/api/org/units", undefined, token),
      apiRequest<{ roles: RealRole[] }>("GET", "/api/org/roles", undefined, token),
      apiRequest<{ members: RealMember[] }>("GET", "/api/org/members", undefined, token),
    ]);

    const now = new Date().toISOString();

    const units: OrgUnit[] = unitsRes.units.map((u) => ({
      id: u.id,
      companyId,
      parentUnitId: u.parent_unit_id,
      name: u.name,
      unitType: u.unit_type as OrgUnit["unitType"],
      hasTopRole: u.has_top_role,
      createdBy: null,
      lockedAt: u.locked_at,
      createdAt: u.created_at,
      updatedAt: u.created_at,
    }));

    const roles: Role[] = rolesRes.roles.map((r) => ({
      id: r.id,
      companyId,
      name: r.name,
      rank: r.rank,
      reportsToRoleId: r.reports_to_role_id,
      isAdminRole: r.is_admin_role,
      createdAt: r.created_at,
      updatedAt: r.created_at,
    }));

    const users: User[] = membersRes.members.map((m) => ({
      id: m.id,
      companyId,
      firstName: m.first_name,
      lastName: m.last_name,
      email: m.email,
      password: "",
      roleId: m.role_id,
      reportsToUserId: m.reports_to_user_id,
      isCompanyAdmin: m.is_company_admin,
      status: m.status as User["status"],
      isEmailVerified: m.is_email_verified,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      invitedBy: null,
      inviteToken: null,
      inviteExpires: null,
      inviteAcceptedAt: null,
      lastLoginAt: null,
      lastActiveAt: m.last_active_at,
      createdAt: m.created_at,
      updatedAt: now,
    }));

    const memberIds = new Set(membersRes.members.map((m) => m.id));
    const userOrgUnits: UserOrgUnit[] = membersRes.members.flatMap((m) =>
      m.unit_ids.map((unitId) => ({ userId: m.id, orgUnitId: unitId, isPrimary: unitId === m.primary_unit_id, createdAt: now })),
    );

    mutate((d) => {
      d.orgUnits = [...d.orgUnits.filter((u) => u.companyId !== companyId), ...units];
      d.roles = [...d.roles.filter((r) => r.companyId !== companyId), ...roles];
      d.users = [...d.users.filter((u) => u.companyId !== companyId), ...users];
      d.userOrgUnits = [...d.userOrgUnits.filter((l) => !memberIds.has(l.userId)), ...userOrgUnits];
    });
  } catch (e) {
    console.warn("[orgSync] failed to sync real org data", e);
  }
}
