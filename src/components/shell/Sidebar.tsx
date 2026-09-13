import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Sparkles } from "lucide-react";

import { Wordmark } from "../brand/Logo";
import { Text } from "../ui/Text";
import { Avatar } from "../ui/Avatar";
import { cn } from "../../lib/cn";
import { colors } from "../../lib/theme";
import { manageNav, NavItem, primaryNav } from "./nav";
import { useAwaitingTicketCount, useCompany, useCurrentUser, useIsAdmin, useUnreadCount } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { useSession } from "../../lib/session";
import { fetchRealPlanStatus, RealPlanStatus } from "../../lib/services/org";
import { fullName } from "../../lib/util";
import { logout } from "../../lib/services/auth";

function Row({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const navigate = useNavigate();
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => navigate(item.href)}
      className={cn("flex w-full flex-row items-center gap-3 rounded-lg px-3 py-2 text-left", active ? "bg-accent" : "hover:bg-muted")}
    >
      <Icon size={17} color={active ? colors.ink : colors.slate} />
      <span className={cn("flex-1 truncate text-[13px]", active ? "font-semibold text-ink" : "text-slate")}>{item.label}</span>
      {badge ? <span className="rounded-full bg-amber px-1.5 text-[10px] font-bold text-ink">{badge}</span> : null}
      {active ? <span className="h-4 w-1 rounded-full bg-amber" /> : null}
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" className="block px-3 pb-1 pt-4 font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </Text>
  );
}

export function SidebarContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const isAdmin = useIsAdmin();
  const company = useCompany();
  const unread = useUnreadCount();
  const awaitingTickets = useAwaitingTicketCount();
  const roleName = useDB((db) => db.roles.find((r) => r.id === db.users.find((u) => u.id === me?.id)?.roleId)?.name ?? null);
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");

  const { real } = useSession();
  const [plan, setPlan] = useState<RealPlanStatus | null>(null);
  useEffect(() => {
    if (!real) return;
    let cancelled = false;
    fetchRealPlanStatus().then((p) => !cancelled && setPlan(p));
    return () => {
      cancelled = true;
    };
  }, [real?.user.id]);

  const badgeFor = (href: string) =>
    href === "/notifications" ? (unread > 0 ? unread : undefined) : href === "/tickets" ? (awaitingTickets > 0 ? awaitingTickets : undefined) : undefined;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="border-b border-hairline px-4 pb-4 pt-5">
        <Wordmark size={26} />
      </div>

      {me ? (
        <div className="shrink-0 px-4 pt-3">
          <span className="inline-flex items-center rounded-full border border-hairline bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate">
            {isAdmin ? "Company Admin" : roleName || "Member"}
          </span>
          {company ? (
            <Text variant="caption" className="mt-1 block truncate">
              {company.name}
            </Text>
          ) : null}
          {plan?.showUpgrade
            ? (() => {
                const urgent = !!plan.trialing && (plan.trialDaysLeft ?? 99) <= 3;
                const label = plan.trialing ? `${plan.trialDaysLeft} day${plan.trialDaysLeft === 1 ? "" : "s"} left · Upgrade` : "Upgrade";
                return (
                  <button
                    type="button"
                    onClick={() => navigate("/billing")}
                    className={cn(
                      "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:brightness-95",
                      urgent ? "bg-destructive text-white" : "bg-amber text-ink",
                    )}
                  >
                    <Sparkles size={13} />
                    {label}
                  </button>
                );
              })()
            : null}
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
        <SectionLabel>Menu</SectionLabel>
        {primaryNav.map((item) => (
          <Row key={item.href} item={item} active={isActive(item.href)} badge={badgeFor(item.href)} />
        ))}

        {isAdmin ? (
          <>
            <SectionLabel>Manage</SectionLabel>
            {manageNav.map((item) => (
              <Row key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </>
        ) : null}
      </div>

      <div className="border-t border-hairline p-3">
        <div className="mb-2 flex flex-row items-center gap-2.5">
          <Avatar name={me ? fullName(me) : "?"} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-ink">{me ? fullName(me) : ""}</div>
            <Text variant="caption" className="block truncate">
              {me?.email}
            </Text>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate("/welcome");
          }}
          className="flex w-full flex-row items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted"
        >
          <LogOut size={15} color={colors.slate} />
          <span className="text-[13px] text-slate">Sign out</span>
        </button>
      </div>
    </div>
  );
}
