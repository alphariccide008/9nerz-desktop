/** Shared React hooks bridging session + DB to screens — desktop port of lib/hooks.ts. */

import { useEffect, useMemo, useState } from "react";
import { useDB } from "./db/store";
import { useSession, RealUser, RealCompany } from "./session";
import { Company, User } from "./db/schema";
import { breakpoints, Breakpoint } from "./theme";

/** Fallback for a real account before its first orgSync completes (or if it
 *  never does): a synthetic record built from the live-login profile alone.
 *  Fields the login response doesn't return (roleId, timestamps, …) get
 *  harmless placeholders. Once orgSync has run, `useCurrentUser` prefers the
 *  fully-synced row in `db.users` instead (real roleId, status, etc. — Roles,
 *  People, Profile and others all read those fields for real accounts now). */
function realUserToLocalShape(u: RealUser): User {
  const now = new Date().toISOString();
  return {
    id: u.id,
    companyId: u.companyId,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    password: "",
    roleId: null,
    reportsToUserId: null,
    isCompanyAdmin: u.isCompanyAdmin,
    status: "active",
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    invitedBy: null,
    inviteToken: null,
    inviteExpires: null,
    inviteAcceptedAt: null,
    lastLoginAt: null,
    lastActiveAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function realCompanyToLocalShape(c: RealCompany): Company {
  const now = new Date().toISOString();
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: (c.status as Company["status"]) ?? "active",
    subscriptionTier: (c.subscriptionTier as Company["subscriptionTier"]) ?? "free",
    billingReference: null,
    ticketPrefix: "9TC",
    createdAt: now,
    updatedAt: now,
  };
}

export function useCurrentUser(): User | null {
  const { userId, real } = useSession();
  const dbUser = useDB((db) => db.users.find((u) => u.id === userId) ?? null);
  if (real) return dbUser ?? realUserToLocalShape(real.user);
  return dbUser;
}

export function useCompany(): Company | null {
  const { real } = useSession();
  const user = useCurrentUser();
  const mockCompany = useDB((db) => (user ? db.companies.find((c) => c.id === user.companyId) ?? null : null));
  if (real) return real.company ? realCompanyToLocalShape(real.company) : null;
  return mockCompany;
}

export function useUnreadCount(): number {
  const { userId } = useSession();
  return useDB((db) => db.notifications.filter((n) => n.userId === userId && !n.isRead).length);
}

/** Tickets in the caller's scope that are waiting on a reply — drives the "Tickets" badge (migration 009). */
export function useAwaitingTicketCount(): number {
  const { userId } = useSession();
  return useDB((db) => {
    const me = db.users.find((u) => u.id === userId);
    if (!me) return 0;
    const myUnit = me.isCompanyAdmin
      ? null
      : db.userOrgUnits.find((uo) => uo.userId === userId && uo.isPrimary)?.orgUnitId ?? null;
    return db.tickets.filter((t) => {
      if (t.companyId !== me.companyId || !t.awaitingResponse || t.status === "resolved") return false;
      if (me.isCompanyAdmin) return true;
      return t.assigneeId === userId || (!!myUnit && t.orgUnitId === myUnit);
    }).length;
  });
}

export function useIsAdmin(): boolean {
  return useCurrentUser()?.isCompanyAdmin ?? false;
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

/** Width-based breakpoint — on desktop this is almost always "lg"/"xl", but the
 *  window is still resizable/snappable, so screens built responsively still pay off. */
export function useBreakpoint(): { bp: Breakpoint; width: number; isDesktop: boolean; isTablet: boolean; isPhone: boolean } {
  const width = useWindowWidth();
  return useMemo(() => {
    let bp: Breakpoint = "sm";
    if (width >= breakpoints.xl) bp = "xl";
    else if (width >= breakpoints.lg) bp = "lg";
    else if (width >= breakpoints.md) bp = "md";
    return {
      bp,
      width,
      isDesktop: width >= breakpoints.lg,
      isTablet: width >= breakpoints.md && width < breakpoints.lg,
      isPhone: width < breakpoints.md,
    };
  }, [width]);
}
