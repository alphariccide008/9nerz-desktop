import {
  Bell,
  Building2,
  CheckSquare,
  CreditCard,
  GitBranch,
  Inbox,
  Layers,
  LayoutGrid,
  Mail,
  Network,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Tasks", href: "/tasks", icon: Layers },
  { label: "Tickets", href: "/tickets", icon: Inbox },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: UserCircle },
];

export const manageNav: NavItem[] = [
  { label: "Structure", href: "/admin/structure", icon: Building2 },
  { label: "Roles", href: "/admin/roles", icon: GitBranch },
  { label: "People", href: "/admin/people", icon: Users },
  { label: "Reporting", href: "/admin/reporting", icon: Network },
  { label: "Approvals", href: "/approvals", icon: CheckSquare },
  { label: "Email routing", href: "/admin/routing", icon: Mail },
  { label: "Permission policy", href: "/admin/settings", icon: Settings },
  { label: "Audit trail", href: "/admin/audit", icon: ShieldCheck },
];

export const billingNav: NavItem = { label: "Billing", href: "/billing", icon: CreditCard };
