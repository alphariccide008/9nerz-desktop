import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Inbox, ListChecks, Network, Sparkles } from "lucide-react";
import { Wordmark } from "../components/brand/Logo";
import { Text } from "../components/ui/Text";
import { colors } from "../lib/theme";
import { cn } from "../lib/cn";

const CAPABILITIES = [
  { icon: Network, title: "Your org chart is the foundation", body: "Departments, business units, roles and reporting lines are yours to define, not a fixed shape we impose on you." },
  { icon: ListChecks, title: "Briefs that route themselves", body: "Turn a request into a task, send it up the reporting chain for sign-off, and drop it onto the right desk." },
  { icon: Inbox, title: "Email becomes a tracked ticket", body: "Point a support address at 9nerz. Inbound mail lands in the right department's queue, ready to assign." },
];

/** Ported from the real web app's components/marketing/hero.tsx TiltBoard — a static
 *  3-column kanban preview (framer-motion tilt/drag dropped, not worth the extra
 *  dependency for a launch screen, but the content and layout match exactly). */
const BOARD_LISTS = [
  {
    name: "To do",
    dot: colors.amber,
    cards: [
      { t: "Draft Q3 campaign brief", tag: "Marketing" },
      { t: "Vendor contract review", tag: "Legal" },
      { t: "Refresh onboarding deck", tag: "People" },
    ],
  },
  {
    name: "In progress",
    dot: colors.ink,
    cards: [
      { t: "Billboard artwork · Lekki", tag: "Design" },
      { t: "Monthly revenue report", tag: "Finance" },
    ],
  },
  {
    name: "Review",
    dot: colors.teal,
    cards: [
      { t: "Client proposal · new account", tag: "Sales" },
      { t: "Website copy pass", tag: "Content" },
    ],
  },
];

const ROTATING = ["from anywhere", "before it slips", "as a team", "with clarity"];

export default function Welcome() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [rot, setRot] = useState(0);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const id = setInterval(() => setRot((r) => (r + 1) % ROTATING.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-screen w-screen overflow-y-auto bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-gradient text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-0 h-[30rem] w-[30rem] rounded-full bg-white/10 blur-3xl" style={{ animation: "aurora-a 20s ease-in-out infinite" }} />
          <div className="absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-teal/40 blur-3xl" style={{ animation: "aurora-b 24s ease-in-out infinite" }} />
          <div className="absolute inset-0 bg-grid-light opacity-40" />
        </div>

        <div className="relative mx-auto grid max-w-[1300px] items-center gap-12 px-8 pb-16 pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-12 lg:pb-20 lg:pt-20">
          <div
            className="min-w-0 transition-all duration-500 ease-out"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(14px)" }}
          >
            <div className="mb-6">
              <Wordmark size={26} tone="white" />
            </div>

            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/85 ring-1 ring-white/15">
              <Sparkles size={13} color={colors.amber} />
              Org-structure · Tasks · Ticketing
            </span>

            <h1 className="mt-5 font-display text-[2.05rem] font-extrabold leading-[1.1] tracking-tight lg:text-[4rem] lg:leading-[1.05]">
              Move work from request to done
              <span className="mt-1 block h-[1.2em] overflow-hidden text-amber lg:mt-2">
                <span key={rot} style={{ animation: "slide-fade-in 0.4s ease-out" }} className="block">
                  {ROTATING[rot]}
                </span>
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
              9nerz is task and ticket management built on your org chart. Define your own
              departments, roles and reporting lines. Then every board, route and report
              follows them.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-6 py-3.5 text-sm font-bold text-ink shadow-lg transition-all hover:brightness-105 active:scale-[0.98]"
              >
                Start free
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Log in
              </button>
            </div>

            <p className="mt-6 text-xs leading-tight text-white/70">
              <span className="font-bold text-white">10 days of Unlimited, free</span>
              <br />
              no credit card · $80/mo locked for the first 200
            </p>
          </div>

          <div
            className="w-full min-w-0 transition-all duration-700 ease-out lg:pl-2"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)" }}
          >
            <div className="relative rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-sm sm:p-4">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {BOARD_LISTS.map((list) => (
                  <div key={list.name} className="w-48 shrink-0 rounded-xl bg-card p-2.5 shadow-sm lg:w-56">
                    <div className="mb-2.5 flex flex-row items-center gap-2 px-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: list.dot }} />
                      <span className="text-xs font-bold text-ink">{list.name}</span>
                      <span className="ml-auto text-[10px] font-semibold text-muted-foreground">{list.cards.length}</span>
                    </div>
                    <div className="space-y-2">
                      {list.cards.map((c) => (
                        <div key={c.t} className="rounded-lg border border-hairline bg-background p-2.5 shadow-xs">
                          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate">
                            {c.tag}
                          </span>
                          <p className="mt-1.5 text-[11px] font-medium leading-snug text-ink">{c.t}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-[1300px] px-8 py-16 lg:px-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className={cn("card-hover rounded-2xl border border-hairline bg-card p-6 shadow-sm")}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink/10 text-ink">
                <c.icon size={20} color={colors.ink} />
              </div>
              <Text variant="heading" className="mt-4 block text-[16px]">
                {c.title}
              </Text>
              <Text variant="caption" className="mt-2 block leading-relaxed">
                {c.body}
              </Text>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
