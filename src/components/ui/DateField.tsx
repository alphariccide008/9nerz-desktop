import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";

import { Text } from "./Text";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { cn } from "../../lib/cn";
import { colors } from "../../lib/theme";

/** Compact month calendar in a dialog. Value is ISO. */
export function DateField({
  label,
  value,
  onChange,
  minToday,
}: {
  label?: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  minToday?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => (value ? dayjs(value) : dayjs()));
  const selected = value ? dayjs(value) : null;

  const start = cursor.startOf("month").startOf("week");
  const days: dayjs.Dayjs[] = [];
  for (let i = 0; i < 42; i++) days.push(start.add(i, "day"));

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Text variant="label">{label}</Text> : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 flex flex-row items-center rounded-xl border border-hairline bg-card px-3 text-left"
      >
        <span className={cn("text-[14px]", selected ? "text-ink" : "text-muted-foreground")}>
          {selected ? selected.format("D MMM YYYY") : "Pick a date"}
        </span>
      </button>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label ?? "Select date"}
        footer={
          <div className="flex flex-row gap-2">
            <Button
              title="Clear"
              variant="outline"
              className="flex-1"
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
            />
            <Button title="Done" className="flex-1" onPress={() => setOpen(false)} />
          </div>
        }
      >
        <div className="flex flex-row items-center justify-between py-1">
          <button type="button" onClick={() => setCursor(cursor.subtract(1, "month"))} className="p-1">
            <ChevronLeft size={18} color={colors.ink} />
          </button>
          <Text variant="heading">{cursor.format("MMMM YYYY")}</Text>
          <button type="button" onClick={() => setCursor(cursor.add(1, "month"))} className="p-1">
            <ChevronRight size={18} color={colors.ink} />
          </button>
        </div>
        <div className="flex flex-row">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="flex-1 text-center py-1">
              <Text variant="caption" className="font-semibold">
                {d}
              </Text>
            </div>
          ))}
        </div>
        <div className="flex flex-row flex-wrap">
          {days.map((d) => {
            const inMonth = d.month() === cursor.month();
            const isSel = selected && d.isSame(selected, "day");
            const isPast = minToday && d.isBefore(dayjs(), "day");
            return (
              <button
                key={d.toString()}
                type="button"
                disabled={isPast}
                onClick={() => {
                  onChange(d.hour(17).minute(0).second(0).toISOString());
                  setOpen(false);
                }}
                style={{ width: `${100 / 7}%` }}
                className="flex flex-col items-center py-1.5 disabled:cursor-not-allowed"
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", isSel && "bg-ink")}>
                  <span
                    className={cn(
                      "text-[13px]",
                      isSel ? "font-bold text-white" : inMonth ? "text-ink" : "text-muted-foreground",
                      isPast && "text-hairline",
                    )}
                  >
                    {d.date()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
