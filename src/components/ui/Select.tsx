import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Text } from "./Text";
import { Sheet } from "./Sheet";
import { cn } from "../../lib/cn";
import { colors } from "../../lib/theme";

export type Option = { value: string; label: string; hint?: string };

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  error,
  allowClear,
  sheetTitle,
}: {
  label?: string;
  value: string | null;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  allowClear?: boolean;
  sheetTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Text variant="label">{label}</Text> : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "h-11 flex flex-row items-center justify-between rounded-xl border bg-card px-3 text-left",
          error ? "border-destructive" : "border-hairline",
        )}
      >
        <span className={cn("truncate text-[14px]", selected ? "text-ink" : "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} color={colors.slate} />
      </button>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={sheetTitle ?? label ?? "Select"}>
        <div className="flex flex-col gap-1">
          {allowClear ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="flex flex-row items-center justify-between rounded-lg px-3 py-3 hover:bg-muted"
            >
              <Text tone="muted">— None —</Text>
              {!value ? <Check size={16} color={colors.teal} /> : null}
            </button>
          ) : null}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex flex-row items-center justify-between rounded-lg px-3 py-3 hover:bg-muted"
            >
              <div className="flex-1 text-left">
                <div className="text-[14px] text-ink">{o.label}</div>
                {o.hint ? <Text variant="caption">{o.hint}</Text> : null}
              </div>
              {o.value === value ? <Check size={16} color={colors.teal} /> : null}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
