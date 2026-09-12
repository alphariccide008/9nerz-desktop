import { colors } from "../../lib/theme";

/** Simple single-ring donut for an on-time-delivery style percentage score. */
export function Donut({
  value,
  size = 64,
  strokeWidth = 7,
  tone = colors.teal,
}: {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  tone?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.hairline} strokeWidth={strokeWidth} fill="none" />
        {value != null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tone}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </svg>
      <span className="text-[13px] font-bold text-ink">{value == null ? "—" : `${value}%`}</span>
    </div>
  );
}
