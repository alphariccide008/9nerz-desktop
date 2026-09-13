import { ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Award, Building2, ChevronRight, ListChecks, Network, Users, type LucideIcon } from "lucide-react";

import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { StatusDot } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/Feedback";
import { Donut } from "../components/ui/Donut";
import { PerformanceDonut, DonutSegment } from "../components/ui/PerformanceDonut";
import { useCurrentUser, useIsAdmin } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import { useSession } from "../lib/session";
import { reportingChainView } from "../lib/services/org";
import { listTasks } from "../lib/services/tasks";
import { performanceOverview, fetchRealPerformance, RealPerformance, PersonStat, TIERS, tierForRank } from "../lib/services/performance";
import { shortDate } from "../lib/util";
import { colors } from "../lib/theme";
import { cn } from "../lib/cn";
import { TaskDetailContent } from "./tasks/TaskDetail";

export default function Dashboard() {
  const me = useCurrentUser();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { real } = useSession();
  const dbTick = useDB((db) => db.tasks.length + db.users.length + db.auditLogs.length);

  const [realPerf, setRealPerf] = useState<RealPerformance | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  useEffect(() => {
    if (!real) return;
    let cancelled = false;
    fetchRealPerformance()
      .then((p) => !cancelled && setRealPerf(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [real?.user.id]);

  const data = useMemo(() => {
    if (!me) return null;
    const chain = reportingChainView(me.id);
    const mine = listTasks(me.id, "mine").filter((t) => !["Approved", "Completed", "Declined"].includes(t.status));
    const teamOverdue = listTasks(me.id, "team", { overdueOnly: true });
    const performance = performanceOverview(me.companyId, me.id);
    return { chain, mine, teamOverdue, performance };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, dbTick]);

  const counts = useDB((db) => {
    if (!me || !isAdmin) return null;
    return {
      members: db.users.filter((u) => u.companyId === me.companyId).length,
      units: db.orgUnits.filter((u) => u.companyId === me.companyId).length,
    };
  });

  if (!me || !data) return null;
  const { chain, mine, teamOverdue, performance } = data;

  return (
    <>
    <Screen maxWidth="none">
      <div className="flex flex-row items-end justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Hi {me.firstName}</h1>
          <Text variant="caption" className="mt-0.5 block">
            {chain.user.role ?? "No role set"}
            {chain.chain[0] ? ` · reports to ${chain.chain[0].name}` : ""}
          </Text>
        </div>
        <button
          type="button"
          onClick={() => navigate("/tasks")}
          className="rounded-lg border border-hairline bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink"
        >
          All tasks
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat icon={ListChecks} label="My open tasks" value={mine.length} tone="navy" onPress={() => navigate("/tasks")} />
        <Stat icon={AlertTriangle} label="Team overdue" value={teamOverdue.length} tone={teamOverdue.length ? "red" : "muted"} onPress={() => navigate("/tasks")} />
        {isAdmin && counts ? (
          <>
            <Stat icon={Users} label="People" value={counts.members} onPress={() => navigate("/admin/people")} />
            <Stat icon={Building2} label="Units" value={counts.units} onPress={() => navigate("/admin/structure")} />
          </>
        ) : (
          <>
            <Stat icon={Network} label="I report to" value={chain.chain.length} />
            <Stat icon={Users} label="My team" value={chain.directReports.length} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl border border-hairline bg-card lg:col-span-3">
          <header className="flex flex-row items-center justify-between border-b border-hairline px-4 py-2.5">
            <Text variant="heading">My tasks</Text>
            <button type="button" onClick={() => navigate("/tasks")} className="text-xs font-medium text-teal hover:underline">
              View all
            </button>
          </header>
          {mine.length === 0 ? (
            <div className="px-4 py-8">
              <Text variant="caption" className="block text-center">
                Nothing on your plate.
              </Text>
            </div>
          ) : (
            <div className="divide-y divide-hairline/60">
              {mine.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenTaskId(t.id)}
                  className="flex w-full flex-row items-center gap-2.5 px-4 py-2.5 text-left hover:bg-background"
                >
                  <StatusDot status={t.status} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
                  {t.dueDate ? <span className="shrink-0 text-[11px] text-muted-foreground">{shortDate(t.dueDate)}</span> : null}
                  <ChevronRight size={14} color={colors.mutedForeground} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border border-hairline bg-card p-4">
            <div className="mb-2 flex flex-row items-center gap-1.5">
              <Network size={15} color={colors.ink} />
              <Text variant="heading">Reporting line</Text>
            </div>
            {chain.chain.length ? (
              <div className="flex flex-col gap-1">
                {chain.chain.map((s, i) => (
                  <div key={s.id} className="flex flex-row items-center gap-2 text-sm text-ink">
                    <span className="w-8 shrink-0 text-[10px] uppercase text-muted-foreground">{i === 0 ? "Mgr" : `+${i}`}</span>
                    <span className="truncate">{s.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Text variant="caption">You don't report to anyone yet.</Text>
            )}
          </div>
          <div className="rounded-xl border border-hairline bg-card p-4">
            <div className="mb-2 flex flex-row items-center gap-1.5">
              <Users size={15} color={colors.ink} />
              <Text variant="heading">My team</Text>
            </div>
            {chain.directReports.length ? (
              <div className="flex flex-col gap-1">
                {chain.directReports.slice(0, 6).map((r) => (
                  <div key={r.id} className="truncate text-sm text-ink">
                    {r.name}
                    {r.role ? <span className="text-xs text-muted-foreground"> · {r.role}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <Text variant="caption">Nobody reports to you yet.</Text>
            )}
          </div>
        </section>
      </div>

      {real ? (
        <RealPerformanceSection perf={realPerf} navigate={navigate} />
      ) : (
        <div className="flex flex-col gap-4">
          {isAdmin ? (
            <Card className="flex flex-row flex-wrap items-center gap-5 p-4">
              <div className="flex flex-col items-center gap-1">
                <Donut value={performance.companyOtd} tone={colors.ink} />
                <Text variant="caption">Company</Text>
              </div>
              <div className="min-w-0 flex-1">
                <Text variant="heading">Everyone · on-time delivery</Text>
                <Text variant="caption" className="block">
                  Every person in the company, ranked
                </Text>
              </div>
              {performance.topPerformer ? (
                <div className="flex flex-row items-center gap-1">
                  <Award size={13} color={colors.amber} />
                  <Text variant="caption" className="font-medium text-ink">
                    Top: {performance.topPerformer.name} ({performance.topPerformer.otdScore}%)
                  </Text>
                </div>
              ) : null}
            </Card>
          ) : (
            <Card className="flex flex-row flex-wrap items-center gap-5 p-4">
              <Donut value={performance.me.otdScore} />
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Delivered</dt>
                  <dd className="font-semibold tabular-nums text-ink">{performance.me.completed}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">On time</dt>
                  <dd className="font-semibold tabular-nums text-teal">{performance.me.onTime}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Late</dt>
                  <dd className="font-semibold tabular-nums text-destructive">{performance.me.late}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Score</dt>
                  <dd className="font-semibold text-ink">{performance.me.otdScore == null ? "—" : `${performance.me.otdScore}%`}</dd>
                </div>
              </dl>
            </Card>
          )}

          {isAdmin && performance.individuals.length > 0 ? (
            <Card>
              <header className="border-b border-hairline px-4 py-2.5">
                <Text variant="heading">Leaderboard</Text>
              </header>
              <div className="divide-y divide-hairline/60">
                {performance.individuals.slice(0, 8).map((p, i) => (
                  <div key={p.userId} className="flex flex-row items-center gap-3 px-4 py-2">
                    <span className="w-5 shrink-0 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{p.completed} done</span>
                    <span className="w-12 shrink-0 text-right text-sm font-semibold text-ink">{p.otdScore == null ? "—" : `${p.otdScore}%`}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {isAdmin && performance.units.length > 0 ? (
            <div>
              <Text variant="heading" className="mb-2 block">
                Unit performance
              </Text>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {performance.units.map((u) => (
                  <Card key={u.unitId} className="flex flex-row items-center gap-3 p-3">
                    <Donut value={u.otdScore} size={44} strokeWidth={5} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{u.unitName}</p>
                      <Text variant="caption">{u.completed} completed</Text>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {!real && isAdmin ? (
        <div className="flex flex-row flex-wrap gap-2">
          {(
            [
              ["Invite people", "/admin/people"],
              ["Edit reporting lines", "/admin/reporting"],
              ["Roles & ranks", "/admin/roles"],
              ["Settings", "/admin/settings"],
            ] as const
          ).map(([label, href]) => (
            <button key={label} type="button" onClick={() => navigate(href)} className="rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink">
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {mine.length === 0 && teamOverdue.length === 0 && !isAdmin ? <EmptyState title="All quiet" body="New tasks assigned to you will show up here." /> : null}
    </Screen>

    {openTaskId ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(18,23,42,0.45)" }}>
        <div className="absolute inset-0" onClick={() => setOpenTaskId(null)} />
        <div className="relative w-[96vw] max-w-[1152px] overflow-hidden rounded-2xl border border-hairline bg-card shadow-xl">
          <TaskDetailContent taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
        </div>
      </div>
    ) : null}
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "muted",
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "navy" | "red" | "muted";
  onPress?: () => void;
}) {
  const body = (
    <div
      className="rounded-xl border p-3 text-left transition"
      style={{
        borderColor: tone === "navy" ? "rgba(32,43,78,0.2)" : tone === "red" ? "#FECACA" : colors.hairline,
        backgroundColor: tone === "navy" ? "rgba(32,43,78,0.03)" : tone === "red" ? "rgba(254,242,242,0.5)" : colors.card,
      }}
    >
      <div className="flex flex-row items-center gap-1.5">
        <Icon size={14} color={colors.slate} />
        <Text variant="caption">{label}</Text>
      </div>
      <div className="mt-0.5 text-xl font-bold" style={{ color: tone === "red" && value ? colors.destructive : colors.ink }}>
        {value}
      </div>
    </div>
  );
  return onPress ? (
    <button type="button" onClick={onPress} className="text-left">
      {body}
    </button>
  ) : (
    body
  );
}

/** Mirrors the web app's lib/perf.ts slipLabel(). */
function slipLabel(avgDaysLate: number | null): string {
  if (avgDaysLate == null) return "—";
  if (Math.abs(avgDaysLate) < 0.1) return "on the day";
  if (avgDaysLate < 0) return `${Math.abs(avgDaysLate).toFixed(1)}d early`;
  return `${avgDaysLate.toFixed(1)}d late`;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/** One slice per person, sized by workload — ported from the web's personSegments(). */
function personSegments(people: PersonStat[]): DonutSegment[] {
  const withWork = people.filter((p) => p.delivered + p.openOverdue > 0 || p.total > 0);
  const src = withWork.length ? withWork : people;
  return src.map((p) => {
    const value = p.delivered > 0 ? p.delivered : Math.max(p.total, 1);
    return { id: p.id, label: p.name, value, color: tierForRank(p.rank).color };
  });
}

function aggregateScore(rows: { onTime: number; delivered: number }[]): number | null {
  let onTime = 0;
  let delivered = 0;
  for (const r of rows) {
    onTime += r.onTime;
    delivered += r.delivered;
  }
  return delivered ? Math.round((onTime / delivered) * 100) : null;
}

function ScoreBar({ score, color }: { score: number | null; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef0f3]">
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${score ?? 0}%`, background: color }} />
    </div>
  );
}

function SlipTrend({ avg }: { avg: number | null }) {
  if (avg == null) return <span className="inline-flex items-center gap-0.5 text-muted-foreground/60">—</span>;
  if (Math.abs(avg) < 0.1) return <span className="inline-flex items-center gap-0.5 text-muted-foreground">on time</span>;
  if (avg < 0) return <span className="inline-flex items-center gap-0.5" style={{ color: "#15803d" }}>{slipLabel(avg)}</span>;
  return <span className="inline-flex items-center gap-0.5" style={{ color: "#b91c1c" }}>{slipLabel(avg)}</span>;
}

/** Matches the web app's RankBadge exactly: a tier-coloured circle (green #1,
 *  blue #2, amber #3, red beyond that, grey for no data), medal for the top 3. */
function RankBadge({ rank }: { rank: number | null }) {
  const tier = tierForRank(rank);
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: tier.soft, color: tier.text }} title={tier.label}>
      {medal ?? (rank ?? "–")}
    </span>
  );
}

function TierLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {(["first", "second", "third", "rest", "none"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: TIERS[k].color }} />
          {TIERS[k].label}
        </span>
      ))}
    </div>
  );
}

function PerformanceLeaderboard({ people, awardId }: { people: PersonStat[]; awardId?: string | null }) {
  if (people.length === 0) return <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nobody to rank here yet.</p>;
  return (
    <ul className="space-y-2.5">
      {people.map((p) => {
        const tier = tierForRank(p.rank);
        const isAward = !!awardId && p.id === awardId;
        return (
          <li key={p.id} className={cn("flex items-center gap-3 rounded-xl border px-2.5 py-2 transition", isAward ? "border-[#16a34a]/40 bg-[#16a34a]/[0.05]" : "border-transparent hover:bg-muted/50")}>
            <RankBadge rank={p.rank} />
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-[11px] font-semibold text-ink">{initials(p.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                {isAward ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#16a34a] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    <Award size={9} /> Award
                  </span>
                ) : null}
              </div>
              <div className="mt-1">
                <ScoreBar score={p.score} color={tier.color} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <span>{p.score == null ? "no finished tasks" : `${p.onTime}/${p.delivered} on time`}</span>
                {p.openOverdue > 0 ? <span style={{ color: "#b91c1c" }}>· {p.openOverdue} overdue</span> : null}
                {p.declined > 0 ? <span>· {p.declined} declined</span> : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-display text-base font-bold tabular-nums text-ink">{p.score == null ? "—" : `${p.score}%`}</div>
              <div className="text-[10px]">
                <SlipTrend avg={p.avgDaysLate} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Section header matching the web's exact gradient/border/padding. */
function PerfHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/70 bg-gradient-to-r from-card to-card px-4 py-3">
      <div>
        <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
        {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}

function WindowPill({ days }: { days?: number }) {
  if (days == null) return null;
  return <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Last {days} days</span>;
}

/** Real-backend performance, ported field-for-field and class-for-class from the
 *  web app's components/perf/performance-card.tsx + dashboard-home.tsx: an
 *  org-wide multi-segment pie sliced by department (admin), a team leaderboard
 *  with its own multi-segment pie + tier legend, per-person 3-way pies, and
 *  per-unit pies. Data and ranking come straight from GET /api/org/performance. */
function RealPerformanceSection({ perf, navigate }: { perf: RealPerformance | null; navigate: (path: string) => void }) {
  if (!perf) {
    return (
      <Card className="p-4">
        <Text variant="caption">Loading performance…</Text>
      </Card>
    );
  }

  const award = perf.people.find((p) => p.id === perf.awardUserId) ?? null;
  const agg = aggregateScore(perf.people);
  const leaderboardSegments = personSegments(perf.people);
  const departments = perf.byUnit.filter((u) => u.type === "department");
  const businessUnits = perf.byUnit.filter((u) => u.type === "business_unit");

  const orgSegments =
    perf.org?.departments
      .map((d) => ({ id: d.id, label: d.name, value: d.delivered > 0 ? d.delivered : 0, color: tierForRank(d.rank).color }))
      .filter((s) => s.value > 0) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {perf.isAdmin && perf.org ? (
        <section className="overflow-hidden rounded-2xl border border-hairline bg-card shadow-sm">
          <PerfHeader title="Organisation performance" subtitle={`Company-wide on-time delivery · ${perf.org.headcount} ${perf.org.headcount === 1 ? "person" : "people"}`} right={<WindowPill days={perf.windowDays} />} />
          <div className="grid gap-4 p-4 md:grid-cols-[auto,1fr] md:gap-6">
            <div className="flex items-center justify-center">
              <PerformanceDonut segments={orgSegments.length ? orgSegments : [{ id: "none", label: "No data", value: 1, color: "#eef0f3" }]} size={188} centerValue={perf.org.score == null ? "—" : `${perf.org.score}%`} centerLabel="company on-time" />
            </div>
            <div className="min-w-0">
              <dl className="mb-3 grid grid-cols-3 gap-3">
                {(
                  [
                    ["Delivered", perf.org.delivered, "#202b4e"],
                    ["On time", perf.org.onTime, "#15803d"],
                    ["Overdue", perf.org.openOverdue, "#b45309"],
                  ] as const
                ).map(([k, v, c]) => (
                  <div key={k} className="rounded-xl border border-hairline/70 bg-background px-3 py-2">
                    <dt className="text-[10.5px] text-muted-foreground">{k}</dt>
                    <dd className="font-display text-lg font-bold tabular-nums" style={{ color: c }}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul className="space-y-1.5">
                {perf.org.departments
                  .slice()
                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                  .map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tierForRank(d.rank).color }} />
                      <span className="flex-1 truncate text-ink">{d.name}</span>
                      <span className="font-semibold tabular-nums text-muted-foreground">{d.score == null ? "—" : `${d.score}%`}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {perf.people.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-hairline bg-card shadow-sm">
          <PerfHeader
            title={perf.isAdmin ? "Everyone · on-time delivery" : "Team performance"}
            subtitle={perf.isAdmin ? "Every person in the company, ranked" : "On-time task delivery across everyone who reports to you"}
            right={
              <div className="flex items-center gap-2">
                {award ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#16a34a]/[0.1] px-2 py-1 text-[10.5px] font-semibold" style={{ color: "#15803d" }}>
                    <Award size={12} /> {award.name}
                  </span>
                ) : null}
                <WindowPill days={perf.windowDays} />
              </div>
            }
          />
          <div className="grid gap-4 p-4 md:grid-cols-[auto,1fr] md:gap-6">
            <div className="flex flex-col items-center justify-center gap-3 md:pr-4">
              <PerformanceDonut segments={leaderboardSegments} centerValue={agg == null ? "—" : `${agg}%`} centerLabel="team on-time" />
              <TierLegend />
            </div>
            <div className="min-w-0">
              <PerformanceLeaderboard people={perf.people} awardId={perf.awardUserId} />
            </div>
          </div>
        </section>
      ) : (
        <Card className="flex flex-row flex-wrap items-center gap-5 p-4">
          <Donut value={perf.me.score} />
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] text-muted-foreground">Delivered</dt>
              <dd className="font-semibold tabular-nums text-ink">{perf.me.delivered}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">On time</dt>
              <dd className="font-semibold tabular-nums text-teal">{perf.me.onTime}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Late</dt>
              <dd className="font-semibold tabular-nums text-destructive">{perf.me.late}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Open &amp; overdue</dt>
              <dd className="font-semibold text-ink">{perf.me.openOverdue}</dd>
            </div>
          </dl>
        </Card>
      )}

      {departments.length > 0 ? <UnitGrid title="Department performance" units={departments} /> : null}
      {businessUnits.length > 0 ? <UnitGrid title="Business unit performance" units={businessUnits} /> : null}

      {perf.people.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-sm font-bold text-ink">Individual performance</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {perf.people.map((p) => (
              <PersonPerfMini key={p.id} person={p} isAward={!!perf.awardUserId && p.id === perf.awardUserId} />
            ))}
          </div>
        </section>
      ) : null}

      {perf.isAdmin ? (
        <div className="flex flex-row flex-wrap gap-2">
          {(
            [
              ["Invite people", "/admin/people"],
              ["Edit reporting lines", "/admin/reporting"],
              ["Roles & ranks", "/admin/roles"],
              ["Settings", "/admin/settings"],
            ] as const
          ).map(([label, href]) => (
            <button key={label} type="button" onClick={() => navigate(href)} className="rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink">
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One person's own delivery split — a small 3-segment pie, ported from PersonPerfMini. */
function PersonPerfMini({ person, isAward }: { person: PersonStat; isAward?: boolean }) {
  const segs: DonutSegment[] = [
    { id: "ontime", label: "On time", value: person.onTime, color: TIERS.first.color },
    { id: "late", label: "Late", value: person.late, color: TIERS.rest.color },
    { id: "overdue", label: "Overdue", value: person.openOverdue, color: TIERS.third.color },
  ].filter((s) => s.value > 0);

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm", isAward ? "border-[#16a34a]/40" : "border-hairline")}>
      <PerformanceDonut segments={segs.length ? segs : [{ id: "none", label: "No data", value: 1, color: "#eef0f3" }]} size={88} thickness={11} centerValue={person.score == null ? "—" : `${person.score}%`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{person.name}</span>
          {isAward ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#16a34a] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              <Award size={9} /> Award
            </span>
          ) : null}
        </div>
        {person.role ? <p className="text-[10.5px] text-muted-foreground">{person.role}</p> : null}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {person.score == null ? "no finished tasks" : `${person.onTime}/${person.delivered} on time`}
          {person.openOverdue > 0 ? <span style={{ color: "#b91c1c" }}> · {person.openOverdue} overdue</span> : null}
        </p>
      </div>
    </div>
  );
}

/** Compact per-unit tile that opens a full leaderboard popup — ported from UnitPerfMini. */
function UnitGrid({ title, units }: { title: string; units: RealPerformance["byUnit"] }) {
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const openUnit = units.find((u) => u.id === openUnitId) ?? null;

  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {units
          .slice()
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
          .map((u) => {
            const tier = tierForRank(u.rank);
            const top = u.people.find((p) => p.id === u.topPerformerId) ?? null;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setOpenUnitId(u.id)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-hairline bg-card p-3 text-left shadow-sm transition hover:border-ink/30"
              >
                <PerformanceDonut segments={personSegments(u.people)} size={92} thickness={11} centerValue={u.score == null ? "—" : `${u.score}%`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {u.rank != null ? (
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold" style={{ background: tier.soft, color: tier.text }}>
                        {u.rank}
                      </span>
                    ) : null}
                    <span className="truncate text-sm font-semibold text-ink">{u.name}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground">
                    {u.type === "business_unit" ? "Business unit" : "Department"} · {u.memberCount === 1 ? "1 person" : `${u.memberCount} people`}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {top ? (
                      <span className="inline-flex items-center gap-1">
                        <Award size={12} color="#16a34a" /> {top.name} · {top.score}%
                      </span>
                    ) : (
                      <span>
                        {u.delivered} delivered · {u.onTime} on time
                      </span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
      </div>

      {openUnitId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(18,23,42,0.45)" }}>
          <div className="absolute inset-0" onClick={() => setOpenUnitId(null)} />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-hairline bg-card shadow-xl">
            {openUnit ? (
              <>
                <div className="border-b border-hairline/70 bg-card px-4 py-3">
                  <h2 className="font-display text-sm font-bold text-ink">{openUnit.name}</h2>
                  <Text variant="caption" className="block">
                    {openUnit.type === "business_unit" ? "Business unit" : "Department"} · {openUnit.score == null ? "no finished tasks" : `${openUnit.score}% on-time delivery`}
                  </Text>
                </div>
                <div className="p-4">
                  <PerformanceLeaderboard people={openUnit.people} awardId={openUnit.topPerformerId} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
