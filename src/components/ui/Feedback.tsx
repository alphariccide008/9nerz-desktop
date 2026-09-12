import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Text } from "./Text";
import { cn } from "../../lib/cn";
import { colors } from "../../lib/theme";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-row items-center gap-2 px-1 py-6">
      <Loader2 size={18} className="animate-spin" color={colors.ink} />
      <Text tone="muted">{label}</Text>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-card px-6 py-12">
      {icon ? <div className="mb-1 opacity-40">{icon}</div> : null}
      <Text variant="heading">{title}</Text>
      {body ? (
        <Text variant="caption" className="text-center">
          {body}
        </Text>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warn" | "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  const map = {
    info: "border-ink/15 bg-ink/[0.04]",
    warn: "border-amber/40 bg-amber/10",
    error: "border-destructive/40 bg-destructive/10",
    success: "border-teal/40 bg-teal/10",
  } as const;
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", map[tone], className)}>
      {typeof children === "string" ? (
        <Text variant="caption" className={tone === "error" ? "text-destructive" : "text-ink"}>
          {children}
        </Text>
      ) : (
        children
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}
