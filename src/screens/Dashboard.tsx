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
    <Screen maxWidth={860}>
      <div className="flex flex-row items-end justify-between">
        <div>
          <Text variant="title">Hi {me.firstName}</Text>
          <Text variant="caption" className="mt-0.5 block">
            {chain.user.role ?? "No role set"}
            {chain.chain[0] ? ` · reports to ${chain.chain[0].name}` : ""}
          </Text>
        </div>
        <button type="button" onClick={() => navigate("/tasks")} className="rounded-lg border border-hairline bg-card px-2.5 py-1.5">
          <Text variant="caption" className="font-medium text-ink">
            All tasks
          </Text>
        </button>
      </div>

      <div className="flex flex-row flex-wrap gap-2.5">
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

      <Card>
        <div className="flex flex-row items-center justify-between border-b border-hairline px-4 py-2.5">
          <Text variant="heading">My tasks</Text>
          <button type="button" onClick={() => navigate("/tasks")}>
            <Text variant="caption" tone="teal" className="font-medium">
              View all
            </Text>
          </button>
        </div>
        {mine.length === 0 ? (
          <div className="px-4 py-8">
            <Text variant="caption" className="block text-center">
              Nothing on your plate.
            </Text>
          </div>
        ) : (
          mine.slice(0, 6).map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/tasks/${t.id}`)}
              className={`flex w-full flex-row items-center gap-2.5 px-4 py-2.5 text-left ${i > 0 ? "border-t border-hairline/60" : ""}`}
            >
              <StatusDot status={t.status} />
              <span className="flex-1 truncate text-[13px] text-ink">{t.title}</span>
              {t.dueDate ? <Text variant="caption">{shortDate(t.dueDate)}</Text> : null}
              <ChevronRight size={14} color={colors.mutedForeground} />
            </button>
          ))
        )}
      </Card>

      <div className="flex flex-row flex-wrap gap-3">
        <Card className="min-w-[240px] flex-1 p-4">
          <div className="mb-2 flex flex-row items-center gap-1.5">
            <Network size={15} color={colors.ink} />
            <Text variant="heading">Reporting line</Text>
          </div>
          {chain.chain.length ? (
            chain.chain.map((s, i) => (
              <div key={s.id} className="flex flex-row items-center gap-2 py-0.5">
                <Text variant="caption" className="w-9 uppercase">
                  {i === 0 ? "Mgr" : `+${i}`}
                </Text>
                <span className="truncate text-[13px] text-ink">{s.name}</span>
              </div>
            ))
          ) : (
            <Text variant="caption">You don't report to anyone yet.</Text>
          )}
        </Card>
        <Card className="min-w-[240px] flex-1 p-4">
          <div className="mb-2 flex flex-row items-center gap-1.5">
            <Users size={15} color={colors.ink} />
            <Text variant="heading">My team</Text>
          </div>
          {chain.directReports.length ? (
            chain.directReports.slice(0, 6).map((r) => (
              <div key={r.id} className="truncate py-0.5 text-[13px] text-ink">
                {r.name}
                {r.role ? <Text variant="caption"> · {r.role}</Text> : null}
              </div>
            ))
          ) : (
            <Text variant="caption">Nobody reports to you yet.</Text>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-row items-center justify-between">
          <Text variant="heading">On-time delivery</Text>
          {performance.topPerformer ? (
            <div className="flex flex-row items-center gap-1">
              <Award size={13} color={colors.amber} />
              <Text variant="caption" className="font-medium text-ink">
                Top: {performance.topPerformer.name} ({performance.topPerformer.otdScore}%)
              </Text>
            </div>
          ) : null}
        </div>
        <div className="flex flex-row flex-wrap items-center gap-5">
          <div className="flex flex-col items-center gap-1">
            <Donut value={performance.me.otdScore} />
            <Text variant="caption">You ({performance.me.completed})</Text>
          </div>
          {isAdmin ? (
            <div className="flex flex-col items-center gap-1">
              <Donut value={performance.companyOtd} tone={colors.ink} />
              <Text variant="caption">Company</Text>
            </div>
          ) : null}
          {isAdmin ? (
            <div className="min-w-[160px] flex-1 flex flex-col gap-1.5">
              {performance.units.slice(0, 4).map((u) => (
                <div key={u.unitId} className="flex flex-row items-center justify-between">
                  <span className="truncate text-[12px] text-ink">{u.unitName}</span>
                  <Text variant="caption">{u.otdScore == null ? "—" : `${u.otdScore}%`}</Text>
                </div>
              ))}
              {performance.units.length === 0 ? <Text variant="caption">No completed, due-dated tasks yet.</Text> : null}
            </div>
          ) : null}
        </div>
      </Card>

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
            <button key={label} type="button" onClick={() => navigate(href)} className="rounded-lg border border-hairline bg-card px-2.5 py-1.5">
              <Text variant="caption" className="font-medium text-ink">
                {label}
              </Text>
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
      className="min-w-[150px] flex-1 rounded-xl border p-3 text-left"
      style={{
        borderColor: tone === "navy" ? "rgba(32,43,78,0.2)" : tone === "red" ? "#FECACA" : colors.hairline,
        backgroundColor: tone === "navy" ? "rgba(32,43,78,0.03)" : tone === "red" ? "rgba(254,242,242,0.6)" : colors.card,
      }}
    >
      <div className="flex flex-row items-center gap-1.5">
        <Icon size={14} color={colors.slate} />
        <Text variant="caption">{label}</Text>
      </div>
      <div className="mt-0.5 text-[20px] font-bold" style={{ color: tone === "red" && value ? colors.destructive : colors.ink }}>
        {value}
      </div>
    </div>
  );
  return onPress ? (
    <button type="button" onClick={onPress} className="min-w-[150px] flex-1">
      {body}
    </button>
  ) : (
    body
  );
}
