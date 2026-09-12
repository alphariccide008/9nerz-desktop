import { cn } from "../../lib/cn";
import { isOnline } from "../../lib/util";

const sizes = { sm: 28, md: 36, lg: 48, xl: 64 };

export function Avatar({
  name,
  size = "md",
  lastActiveAt,
  tone = "muted",
}: {
  name: string;
  size?: keyof typeof sizes;
  lastActiveAt?: string | null;
  tone?: "muted" | "primary";
}) {
  const dim = sizes[size];
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="relative inline-block" style={{ width: dim, height: dim }}>
      <div
        className={cn("flex items-center justify-center rounded-full", tone === "primary" ? "bg-ink" : "bg-muted")}
        style={{ width: dim, height: dim }}
      >
        <span className={cn("font-semibold", tone === "primary" ? "text-white" : "text-ink")} style={{ fontSize: dim * 0.36 }}>
          {initials || "?"}
        </span>
      </div>
      {lastActiveAt !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-card",
            isOnline(lastActiveAt) ? "bg-teal" : "bg-slate/40",
          )}
          style={{ width: dim * 0.3, height: dim * 0.3 }}
        />
      )}
    </div>
  );
}
