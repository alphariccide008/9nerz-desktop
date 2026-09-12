import { Text } from "./Text";
import { cn } from "../../lib/cn";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-row overflow-x-auto border-b border-hairline">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "-mb-px flex flex-row items-center gap-1.5 border-b-2 px-3 py-2.5 whitespace-nowrap",
              active ? "border-ink" : "border-transparent",
            )}
          >
            <Text variant="heading" className={cn("text-[13px]", active ? "text-ink" : "text-slate")}>
              {o.label}
            </Text>
            {o.badge ? (
              <span className="rounded-full bg-amber px-1.5 text-[10px] font-bold text-ink">{o.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
