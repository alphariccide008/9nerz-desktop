import { Text } from "./Text";
import { cn } from "../../lib/cn";
import { statusColors, priorityColors } from "../../lib/theme";

export function Badge({
  label,
  className,
  textClassName,
}: {
  label: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <div className={cn("inline-block self-start rounded-md bg-muted px-1.5 py-0.5", className)}>
      <Text variant="caption" className={cn("font-semibold text-slate", textClassName)}>
        {label}
      </Text>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const c = statusColors[status] ?? { bg: "#EEF0F4", fg: "#5B6472" };
  const label = status.replace(/_/g, " ");
  return (
    <div className="inline-block self-start rounded-md px-1.5 py-0.5 capitalize" style={{ backgroundColor: c.bg }}>
      <span className="text-[11px] font-semibold" style={{ color: c.fg }}>
        {label}
      </span>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const c = statusColors[status] ?? { dot: "#CBD5E1" };
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.dot }} />;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const c = priorityColors[priority] ?? priorityColors.Normal;
  return (
    <div className="inline-block self-start rounded-md px-1.5 py-0.5" style={{ backgroundColor: c.bg }}>
      <span className="text-[11px] font-semibold" style={{ color: c.fg }}>
        {priority}
      </span>
    </div>
  );
}
