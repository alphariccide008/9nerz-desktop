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

const SLIDES = [
  {
    title: "Customer Service · board",
    badge: "4 active",
    rows: [
      { status: "In Progress", dot: colors.ink, tag: "Design", t: "Billboard artwork — Lekki", who: "Chidi Eze" },
      { status: "Review", dot: colors.teal, tag: "Finance", t: "Monthly revenue report", who: "Bode Cole" },
      { status: "Pending", dot: colors.amber, tag: "Marketing", t: "Draft Q3 campaign brief", who: "Dara Ali" },
      { status: "Pending", dot: colors.amber, tag: "Legal", t: "Vendor contract review", who: "Hauwa Sani" },
    ],
  },
  {
    title: "Support · tickets",
    badge: "3 open",
    rows: [
      { status: "Open", dot: colors.amber, tag: "9TC-004", t: "Refund for order #4821", who: "jane@customer.com" },
      { status: "In progress", dot: colors.ink, tag: "9TC-005", t: "App crashes on checkout", who: "sam@shop.io" },
      { status: "Open", dot: colors.amber, tag: "9TC-006", t: "Partnership enquiry", who: "biz@partner.co" },
    ],
  },
  {
    title: "Engineering · reporting line",
    badge: "6 people",
    rows: [
      { status: "Manager", dot: colors.teal, tag: "Rank 3", t: "Fola Bello", who: "reports to Gani Musa" },
      { status: "Associate", dot: colors.slate, tag: "Rank 5", t: "Hauwa Sani", who: "reports to Fola Bello" },
      { status: "Head", dot: colors.ink, tag: "Rank 2", t: "Gani Musa", who: "reports to Ada Obi" },
    ],
  },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [slide, setSlide] = useState(0);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);
  const active = SLIDES[slide];

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

            <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[1.08] tracking-tight lg:text-[3.6rem]">
              Your organization,
              <br />
              on one board.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
              9nerz is task and ticket management built on your org chart. Define your own departments, roles and
              reporting lines — every board, route and report follows them.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-6 py-3.5 text-sm font-bold text-ink shadow-lg transition-all hover:brightness-105 active:scale-[0.98]"
              >
                Create your organization
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

            <p className="mt-6 text-[11px] text-white/55">No credit card · self-host option</p>
          </div>

          <div
            className="w-full min-w-0 transition-all duration-700 ease-out lg:pl-2"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)" }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-card shadow-2xl">
              <div key={slide} style={{ animation: "slide-fade-in 0.5s ease-out" }}>
                <div className="flex flex-row items-center justify-between border-b border-hairline px-4 py-3">
                  <span className="text-sm font-bold text-ink">{active.title}</span>
                  <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-bold text-teal">{active.badge}</span>
                </div>
                <div className="divide-y divide-hairline/70">
                  {active.rows.map((t) => (
                    <div key={t.t} className="flex flex-row items-center gap-3 px-4 py-3">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.dot }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{t.t}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t.tag} · {t.who}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-slate">{t.status}</span>
                    </div>
                  ))}
                </div>
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
