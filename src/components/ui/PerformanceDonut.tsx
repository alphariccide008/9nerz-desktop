import { useEffect, useState } from "react";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

/** Ported from the real web app's components/perf/performance-donut.tsx —
 *  a multi-segment animated SVG ring (one slice per person/department, sized
 *  by their share of the total), not a flat single-value ring. */
export function PerformanceDonut({
  segments,
  size = 168,
  thickness = 18,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gapDeg = segments.length > 1 ? 2.4 : 0;

  let acc = 0;
  const arcs = segments.map((seg) => {
    const frac = total > 0 ? Math.max(0, seg.value) / total : 0;
    const sweep = frac * 360 - gapDeg;
    const start = acc + gapDeg / 2;
    acc += frac * 360;
    return { seg, start, sweep: Math.max(sweep, 0) };
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef0f3" strokeWidth={thickness} />
        {total > 0 &&
          arcs.map(({ seg, start, sweep }) => {
            const len = (sweep / 360) * circ;
            const offset = (start / 360) * circ;
            return (
              <circle
                key={seg.id}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${mounted ? len : 0} ${circ}`}
                strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)" }}
              />
            );
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerValue != null ? <span className="font-display text-[1.6rem] font-bold leading-none tabular-nums text-ink">{centerValue}</span> : null}
        {centerLabel != null ? <span className="mt-1 max-w-[70%] text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{centerLabel}</span> : null}
      </div>
    </div>
  );
}
