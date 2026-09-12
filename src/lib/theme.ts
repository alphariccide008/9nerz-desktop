/**
 * 9nerz design tokens — imperative access for places NativeWind classes can't reach
 * (SVG fills, StatusBar, chart colors, Animated values). Mirrors tailwind.config.js
 * and the web app's app/globals.css :root block verbatim.
 */

export const brand = {
  ink: "#202B4E",
  teal: "#1F7A66",
  amber: "#F2A93B",
  slate: "#5B6472",
  cloud: "#F6F7FA",
  charcoal: "#12172A",
  hairline: "#E2E5EA",
} as const;

export const colors = {
  ...brand,
  background: "#F5F6F8",
  foreground: "#202B4E",
  card: "#FFFFFF",
  cardForeground: "#202B4E",
  muted: "#EEF0F4",
  mutedForeground: "#5B6472",
  accent: "#EAEDF3",
  border: "#E2E5EA",
  input: "#E2E5EA",
  ring: "#202B4E",
  primary: "#202B4E",
  primaryForeground: "#FFFFFF",
  destructive: "#C6413A",
  destructiveForeground: "#FFFFFF",
  success: "#1F7A66",
  white: "#FFFFFF",
} as const;

/** Task + ticket status color map (bg / fg pairs), matching the web status pills. */
export const statusColors: Record<string, { bg: string; fg: string; dot: string }> = {
  Pending: { bg: "#FEF3C7", fg: "#B45309", dot: "#F59E0B" },
  "In Progress": { bg: "#DBEAFE", fg: "#1D4ED8", dot: "#3B82F6" },
  Review: { bg: "#EDE9FE", fg: "#6D28D9", dot: "#8B5CF6" },
  Approved: { bg: "#D1FAE5", fg: "#047857", dot: "#10B981" },
  Completed: { bg: "#D1FAE5", fg: "#047857", dot: "#10B981" },
  Declined: { bg: "#FEE2E2", fg: "#B91C1C", dot: "#EF4444" },
  // ticket statuses
  open: { bg: "#FEF3C7", fg: "#B45309", dot: "#F59E0B" },
  in_progress: { bg: "#DBEAFE", fg: "#1D4ED8", dot: "#3B82F6" },
  resolved: { bg: "#D1FAE5", fg: "#047857", dot: "#10B981" },
  reopened: { bg: "#EDE9FE", fg: "#6D28D9", dot: "#8B5CF6" },
};

export const priorityColors: Record<string, { bg: string; fg: string }> = {
  Low: { bg: "#F1F5F9", fg: "#475569" },
  Normal: { bg: "#EEF0F4", fg: "#334155" },
  High: { bg: "#FEF3C7", fg: "#B45309" },
  Critical: { bg: "#FEE2E2", fg: "#B91C1C" },
};

export const gradient = {
  brand: ["#202B4E", "#1F7A66"] as [string, string],
  splash: ["#202B4E", "#27336A", "#1F7A66"] as [string, string, string],
};

export const radius = { sm: 6, md: 8, lg: 10, xl: 14, "2xl": 16, full: 999 };

export const spacing = (n: number) => n * 4;

/** Responsive breakpoints (px) — width-based, checked with useWindowDimensions. */
export const breakpoints = { sm: 0, md: 700, lg: 1024, xl: 1280 } as const;
export type Breakpoint = keyof typeof breakpoints;
