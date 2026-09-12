/** Shared React hooks bridging session + DB to screens — desktop port of lib/hooks.ts. */

import { useEffect, useMemo, useState } from "react";
import { useDB } from "./db/store";
import { useSession } from "./session";
import { Company, User } from "./db/schema";
import { breakpoints, Breakpoint } from "./theme";

export function useCurrentUser(): User | null {
  const { userId } = useSession();
  return useDB((db) => db.users.find((u) => u.id === userId) ?? null);
}

export function useCompany(): Company | null {
  const user = useCurrentUser();
  return useDB((db) => (user ? db.companies.find((c) => c.id === user.companyId) ?? null : null));
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
