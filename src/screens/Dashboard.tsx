import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Award, Building2, ChevronRight, ListChecks, Network, Users, type LucideIcon } from "lucide-react";

import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { StatusDot } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/Feedback";
import { Donut } from "../components/ui/Donut";
import { useCurrentUser, useIsAdmin } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import { reportingChainView } from "../lib/services/org";
import { listTasks } from "../lib/services/tasks";
import { performanceOverview } from "../lib/services/performance";
import { shortDate } from "../lib/util";
import { colors } from "../lib/theme";

export default function Dashboard() {
  const me = useCurrentUser();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const dbTick = useDB((db) => db.tasks.length + db.users.length + db.auditLogs.length);

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
                  onClick={() => navigate(`/tasks/${t.id}`)}
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

      {isAdmin ? (
        <div className="flex flex-row flex-wrap gap-2">
          {(
            [
              ["Invite people", "/admin/people"],
              ["Edit reporting lines", "/admin/reporting"],
              ["Roles & ranks", "/admin/roles"],
              ["Permission policy", "/admin/settings"],
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
