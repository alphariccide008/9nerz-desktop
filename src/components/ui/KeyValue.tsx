import { ReactNode } from "react";
import { Text } from "./Text";
import { cn } from "../../lib/cn";

export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-hairline bg-card", className)}>{children}</div>;
}

export function KeyValueRow({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex flex-row items-center justify-between gap-3 px-4 py-2.5", !last && "border-b border-hairline/70")}>
      <Text variant="label" className="text-slate">
        {label}
      </Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text variant="body" className="flex-1 text-right text-[13px]">
          {value}
        </Text>
      ) : (
        <div className="flex justify-end">{value}</div>
      )}
    </div>
  );
}
