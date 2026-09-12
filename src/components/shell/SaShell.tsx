import { useNavigate, useLocation } from "react-router-dom";
import {
  Activity,
  Building2,
  CreditCard,
  Gauge,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Wordmark } from "../brand/Logo";
import { Text } from "../ui/Text";
import { cn } from "../../lib/cn";
import { colors } from "../../lib/theme";
import { saLogout } from "../../lib/services/superAdmin";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/sa/overview", icon: LayoutGrid },
  { label: "Companies", href: "/sa/companies", icon: Building2 },
  { label: "Payments", href: "/sa/payments", icon: Receipt },
  { label: "Subscriptions", href: "/sa/subscriptions", icon: CreditCard },
  { label: "Audit", href: "/sa/audit", icon: ShieldCheck },
  { label: "Activity", href: "/sa/activity", icon: Activity },
  { label: "Chat", href: "/sa/chat", icon: MessageSquare },
  { label: "Operations", href: "/sa/operations", icon: Gauge },
  { label: "Support", href: "/sa/support", icon: LifeBuoy },
];

export function SaSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex flex-row items-center gap-2 px-4 pb-3 pt-4">
        <Wordmark size={24} />
      </div>
      <div className="mx-4 mb-2 inline-block self-start rounded bg-charcoal px-1.5 py-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white">Control plane</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const a = active(item.href);
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className={cn("flex w-full flex-row items-center gap-3 rounded-lg px-3 py-2 text-left", a ? "bg-accent" : "hover:bg-muted")}
            >
              <Icon size={17} color={a ? colors.ink : colors.slate} />
              <span className={cn("text-[13px]", a ? "font-semibold text-ink" : "text-slate")}>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-hairline p-3">
        <button
          type="button"
          onClick={async () => {
            await saLogout();
            navigate("/sa/login");
          }}
          className="flex w-full flex-row items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted"
        >
          <LogOut size={15} color={colors.slate} />
          <Text className="text-[13px] text-slate">Sign out</Text>
        </button>
      </div>
    </div>
  );
}
