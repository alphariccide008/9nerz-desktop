import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../brand/Logo";

const NODES = [
  { id: "hob", label: "Head of Business", x: 50, y: 12, tone: "amber" },
  { id: "m1", label: "Manager · Design", x: 22, y: 48, tone: "white" },
  { id: "m2", label: "Manager · Sales", x: 78, y: 48, tone: "white" },
  { id: "s1", label: "Staff", x: 10, y: 86, tone: "teal" },
  { id: "s2", label: "Staff", x: 34, y: 86, tone: "teal" },
  { id: "s3", label: "Staff", x: 66, y: 86, tone: "teal" },
  { id: "s4", label: "Staff", x: 90, y: 86, tone: "teal" },
] as const;

const EDGES: [string, string][] = [
  ["hob", "m1"],
  ["hob", "m2"],
  ["m1", "s1"],
  ["m1", "s2"],
  ["m2", "s3"],
  ["m2", "s4"],
];

const DOT: Record<string, string> = { amber: "bg-amber", white: "bg-white", teal: "bg-white/70" };

function OrgTree({ show }: { show: boolean }) {
  const pos = (id: string) => NODES.find((n) => n.id === id)!;
  return (
    <div className="relative aspect-[4/3] w-full rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex flex-row items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Your structure</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">Editable</span>
      </div>
      <div className="relative h-[calc(100%-2rem)] w-full">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {EDGES.map(([a, b], i) => {
            const p1 = pos(a);
            const p2 = pos(b);
            return (
              <line
                key={`${a}-${b}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={0.6}
                style={{
                  opacity: show ? 1 : 0,
                  transition: `opacity 0.5s ease ${0.3 + i * 0.08}s`,
                }}
              />
            );
          })}
        </svg>
        {NODES.map((n, i) => (
          <div
            key={n.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${n.x}%`,
              top: `${n.y}%`,
              opacity: show ? 1 : 0,
              transform: `translate(-50%, -50%) scale(${show ? 1 : 0.6})`,
              transition: `opacity 0.35s ease ${0.15 + i * 0.07}s, transform 0.35s ease ${0.15 + i * 0.07}s`,
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className={`h-3 w-3 rounded-full ring-4 ring-white/10 ${DOT[n.tone]}`} />
              <span className="whitespace-nowrap rounded-md bg-white/[0.12] px-1.5 py-0.5 text-[9px] font-semibold text-white/85">{n.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthAside() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative hidden overflow-hidden bg-brand-gradient lg:block">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-24 h-[30rem] w-[30rem] rounded-full bg-white/[0.12] blur-3xl" style={{ animation: "aurora-a 22s ease-in-out infinite" }} />
        <div className="absolute -bottom-40 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-teal/35 blur-3xl" style={{ animation: "aurora-b 26s ease-in-out infinite" }} />
        <div className="absolute inset-0 bg-grid-light opacity-20" />
      </div>

      <div className="relative flex h-full flex-col justify-between p-12">
        <button
          type="button"
          onClick={() => navigate("/welcome")}
          className="inline-block self-start transition-opacity hover:opacity-80"
          style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(-12px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <Wordmark size={24} tone="white" />
        </button>

        <div className="max-w-md py-10">
          <h2
            className="font-display text-[2.1rem] font-extrabold leading-[1.12] text-white"
            style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s" }}
          >
            Work that follows your reporting lines
          </h2>
          <p
            className="mt-4 text-sm leading-relaxed text-white/70"
            style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.6s ease 0.18s, transform 0.6s ease 0.18s" }}
          >
            Tasks, tickets and approvals routed by the structure your organization defines, not a hierarchy we
            impose.
          </p>
          <div
            className="mt-8"
            style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.6s ease 0.25s, transform 0.6s ease 0.25s" }}
          >
            <OrgTree show={show} />
          </div>
        </div>

        <figure
          className="max-w-md border-l-2 border-amber/70 pl-4"
          style={{ opacity: show ? 1 : 0, transition: "opacity 0.6s ease 0.5s" }}
        >
          <blockquote className="text-sm leading-relaxed text-white/80">
            "Every brief has an owner, a deadline, and a next step, and leadership can see all of it."
          </blockquote>
          <figcaption className="mt-2 text-xs text-white/50">Operations Lead · multi-department team</figcaption>
        </figure>
      </div>
    </div>
  );
}
