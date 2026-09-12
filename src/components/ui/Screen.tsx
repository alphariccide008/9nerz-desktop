import { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Text } from "./Text";
import { cn } from "../../lib/cn";

/** Standard scrollable page body. Pass maxWidth="none" for a full-width desktop layout (dashboards, grids);
 *  a number width-clamps and centers the content, appropriate for forms and narrow settings pages. */
export function Screen({
  children,
  maxWidth = 1200,
  className,
  contentClassName,
}: {
  children: ReactNode;
  maxWidth?: number | "none";
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("h-full flex-1 overflow-y-auto bg-background", className)}>
      <div
        className={cn("mx-auto flex w-full flex-col gap-4 px-8 py-6", contentClassName)}
        style={maxWidth === "none" ? undefined : { maxWidth }}
      >
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex flex-row items-start justify-between gap-3">
      <div className="flex-1">
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="caption" className="mt-0.5 block">
            {subtitle}
          </Text>
        ) : null}
      </div>
      <div className="flex flex-row items-center gap-2">
        {onRefresh ? (
          <button type="button" onClick={onRefresh} className="rounded-lg p-2 hover:bg-muted" title="Refresh">
            <RefreshCw size={16} />
          </button>
        ) : null}
        {right}
      </div>
    </div>
  );
}
