import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Building2, ListChecks, MessageSquare, ShieldAlert, Snowflake, Users, type LucideIcon } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useDB } from "../../lib/db/store";
import { activityFeed, overview } from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";
import { colors } from "../../lib/theme";
import { cn } from "../../lib/cn";

export default function SaOverview() {
  const navigate = useNavigate();
  const tick = useDB((db) => db.companies.length + db.users.length + db.auditLogs.length);
  const o = useMemo(() => overview(), [tick]);
  const feed = useMemo(() => activityFeed().slice(0, 8), [tick]);
  const recentCompanies = useDB((db) => [...db.companies].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6));
  const flagged = useDB((db) => db.auditLogs.filter((a) => a.isFlagged).length);

  const stats: { icon: LucideIcon; label: string; value: number | string; sub?: string; tone?: "warn" | "danger"; onPress?: () => void }[] = [
    { icon: Building2, label: "Companies", value: o.companies, sub: `${o.activeCompanies} active`, onPress: () => navigate("/sa/companies") },
    { icon: Snowflake, label: "Frozen", value: o.frozenCompanies, tone: o.frozenCompanies ? "danger" : undefined, onPress: () => navigate("/sa/companies?status=frozen") },
    { icon: ArrowUpRight, label: "Paid tier", value: o.paidCompanies, sub: `${o.freeCompanies} on free` },
    { icon: Users, label: "Users", value: o.users },
    { icon: ListChecks, label: "Tasks", value: o.tasksTotal },
    { icon: MessageSquare, label: "Open chats", value: o.openChats, tone: o.openChats ? "warn" : undefined, onPress: () => navigate("/sa/chat") },
  ];

  return (
    <Screen>
      <div>
        <h1 className="font-display text-lg font-bold text-ink">Platform overview</h1>
        <Text variant="caption" className="mt-0.5 block">
          Health of every company on 9nerz at a glance.
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const body = (
            <div className="flex h-full flex-col justify-between rounded-xl border border-hairline bg-card p-4">
              <div className="flex flex-row items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <s.icon size={16} color={s.tone === "danger" ? colors.destructive : s.tone === "warn" ? colors.amber : colors.slate} />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-ink">{s.value}</span>
                {s.sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{s.sub}</p> : null}
              </div>
            </div>
          );
          return s.onPress ? (
            <button key={s.label} type="button" onClick={s.onPress} className="text-left transition hover:-translate-y-0.5">
              {body}
            </button>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>

      {flagged > 0 ? (
        <button
          type="button"
          onClick={() => navigate("/sa/audit")}
          className="flex w-full flex-row items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive"
        >
          <ShieldAlert size={16} />
          {flagged} flagged {flagged === 1 ? "violation" : "violations"} need review
        </button>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-hairline bg-card">
          <header className="flex flex-row items-center justify-between border-b border-hairline px-4 py-3">
            <Text variant="heading">Newest companies</Text>
            <button type="button" onClick={() => navigate("/sa/companies")} className="text-xs text-teal hover:underline">
              View all
            </button>
          </header>
          <div className="divide-y divide-hairline">
            {recentCompanies.length === 0 ? (
              <Text variant="caption" className="block px-4 py-6 text-center">
                No companies yet.
              </Text>
            ) : (
              recentCompanies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/sa/companies/${c.id}`)}
                  className="flex w-full flex-row items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-background"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-ink">{c.name}</span>
                  <span className="flex shrink-0 flex-row items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="capitalize">{c.subscriptionTier}</span>
                    {c.status === "frozen" ? <span className={cn("rounded px-1.5 py-0.5 font-semibold", "bg-destructive/15 text-destructive")}>Frozen</span> : null}
                    <span>{relativeTime(c.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-card">
          <header className="flex flex-row items-center justify-between border-b border-hairline px-4 py-3">
            <Text variant="heading">Recent activity</Text>
            <button type="button" onClick={() => navigate("/sa/audit")} className="text-xs text-teal hover:underline">
              Full audit
            </button>
          </header>
          <div className="divide-y divide-hairline">
            {feed.length === 0 ? (
              <Text variant="caption" className="block px-4 py-6 text-center">
                No activity recorded yet.
              </Text>
            ) : (
              feed.map((f) => (
                <div key={f.id} className="flex flex-row items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="text-sm capitalize text-ink">{f.actionType.replace(/_/g, " ")}</span>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {f.companyName} · {f.actorName}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(f.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Screen>
  );
}
