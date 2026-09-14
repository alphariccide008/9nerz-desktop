import { useNavigate, useLocation } from "react-router-dom";
import {
  Activity,
  Building2,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ScrollText,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import { Wordmark } from "../brand/Logo";
import { saLogout, currentSuperAdmin } from "../../lib/services/superAdmin";

/** Ported verbatim (label/order/icon) from the real web app's
 *  components/super-admin/sa-sidebar.tsx LINKS array. */
const NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/sa/overview", icon: LayoutDashboard },
  { label: "Companies", href: "/sa/companies", icon: Building2 },
  { label: "Operations", href: "/sa/operations", icon: Activity },
  { label: "Support inbox", href: "/sa/support", icon: Inbox },
  { label: "Payments", href: "/sa/payments", icon: CreditCard },
  { label: "Audit trail", href: "/sa/audit", icon: ScrollText },
  { label: "Live chat", href: "/sa/chat", icon: MessageSquare },
  { label: "My actions", href: "/sa/activity", icon: ShieldAlert },
];

export function SaSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");
  const email = currentSuperAdmin()?.email ?? "";

  return (
    <div className="flex h-full flex-col bg-[#202b4e] text-white">
      <div className="flex flex-row items-center gap-2 px-4 py-4">
        <Wordmark size={22} tone="white" />
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          Super Admin
        </span>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const a = active(item.href);
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                a ? "bg-white/15 font-medium text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        {email ? <p className="truncate px-1 pb-2 text-[11px] text-white/45">{email}</p> : null}
        <button
          type="button"
          onClick={async () => {
            await saLogout();
            navigate("/sa/login");
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
