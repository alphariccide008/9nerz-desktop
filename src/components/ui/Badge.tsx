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
  // `cn` is a plain joiner, not a tailwind-merge — a caller-supplied `bg-*`/
  // `text-*` override doesn't replace these defaults, it just sits alongside
  // them, so both classes leak into the final markup and whichever Tailwind
  // happens to generate later in the stylesheet wins the cascade (usually the
  // default). Suppress the matching default explicitly instead of relying on
  // source order.
  const hasCustomBg = /\bbg-/.test(className ?? "");
  const hasCustomText = /\btext-/.test(textClassName ?? "");
  return (
    <div className={cn("inline-block self-start rounded-md px-2 py-0.5", !hasCustomBg && "bg-muted", className)}>
      <Text variant="caption" className={cn("font-semibold", !hasCustomText && "text-slate", textClassName)}>
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
