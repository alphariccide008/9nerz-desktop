import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, ShieldAlert, ShieldCheck } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Loading } from "../../components/ui/Feedback";
import { useDB } from "../../lib/db/store";
import { userDetail } from "../../lib/services/superAdmin";
import { fullName, relativeTime, shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-teal/15 text-teal",
  invited: "bg-amber/20 text-[#8a5a12]",
  inactive: "bg-muted text-slate",
};

export default function SaUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tick = useDB((db) => JSON.stringify(db.users.find((u) => u.id === id)) + db.userOrgUnits.length + db.tasks.length);
  const data = useMemo(() => {
    try {
      return id ? userDetail(id) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  if (!data) return (
    <Screen>
      <Loading />
    </Screen>
  );
  const { user, company, role, roleRank, reportsTo, invitedBy, units, directReports, assignedTasks, assignedTasksByStatus, assignedByThem, assignedByThemByStatus, recentActivity } = data;
  const primaryUnit = units.find((u) => u.isPrimary) ?? units[0];

  const fields: [string, string][] = [
    ["Company", company?.name ?? "—"],
    ["Role", role ? `${role}${roleRank != null ? ` (rank ${roleRank})` : ""}` : "—"],
    ["Primary unit", primaryUnit?.name ?? "—"],
    ["Reports to", reportsTo?.name ?? "—"],
    ["Invited by", invitedBy?.name ?? "—"],
    ["Invite accepted", user.inviteAcceptedAt ? shortDate(user.inviteAcceptedAt) : "—"],
    ["Joined", shortDate(user.createdAt)],
    ["Last login", user.lastLoginAt ? relativeTime(user.lastLoginAt) : "—"],
    ["Last active", user.lastActiveAt ? relativeTime(user.lastActiveAt) : "—"],
  ];

  return (
    <Screen>
      <button
        type="button"
        onClick={() => (company ? navigate(`/sa/companies/${company.id}`) : navigate("/sa/companies"))}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"
      >
        <ArrowLeft size={13} /> {company ? company.name : "Companies"}
      </button>

      <div>
        <div className="flex flex-row items-center gap-2">
          <h1 className="font-display text-lg font-bold text-ink">{fullName(user)}</h1>
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[user.status] ?? ""}`}>{user.status}</span>
          {user.isCompanyAdmin ? <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-white">Company admin</span> : null}
        </div>
        <p className="mt-1 flex flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <Mail size={13} />
          <span className="break-all">{user.email}</span>
          {user.isEmailVerified ? (
            <span className="inline-flex items-center gap-1 text-teal">
              <ShieldCheck size={13} /> verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1" style={{ color: colors.amber }}>
              <ShieldAlert size={13} /> unverified
            </span>
          )}
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border border-hairline bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, val]) => (
          <div key={label}>
            <Text variant="caption">{label}</Text>
            <p className="text-sm font-medium text-ink">{val}</p>
          </div>
        ))}
      </section>

      {units.length > 0 ? (
        <section className="rounded-xl border border-hairline bg-card p-4">
          <p className="mb-2 text-sm font-semibold text-ink">Org units</p>
          <div className="flex flex-wrap gap-2">
            {units.map((u) => (
              <span key={u.id} className="rounded-lg border border-hairline px-2 py-1 text-xs text-ink">
                {u.name}
                <span className="text-muted-foreground"> · {u.unitType}</span>
                {u.isPrimary ? <span className="ml-1 text-[10px] font-semibold text-teal">PRIMARY</span> : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-4 py-3">
          <Text variant="heading">Tasks</Text>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {(
            [
              ["Assigned to them", assignedTasks, assignedTasksByStatus],
              ["Assigned by them", assignedByThem, assignedByThemByStatus],
            ] as const
          ).map(([label, total, byStatus]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">
                {label} · <span className="font-semibold text-ink">{total}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(byStatus)
                  .filter(([, n]) => n > 0)
                  .map(([s, n]) => (
                    <span key={s} className="rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {s}: <span className="font-semibold text-ink">{n}</span>
                    </span>
                  ))}
                {total === 0 ? <span className="text-[11px] text-muted-foreground">None</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-4 py-3">
          <Text variant="heading">Direct reports · {directReports.length}</Text>
        </header>
        <div className="divide-y divide-hairline">
          {directReports.length === 0 ? (
            <Text variant="caption" className="block px-4 py-6 text-center">
              No direct reports.
            </Text>
          ) : (
            directReports.map((r) => (
              <div key={r.id} className="flex flex-row items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <button type="button" onClick={() => navigate(`/sa/users/${r.id}`)} className="block truncate text-sm text-ink hover:underline">
                    {r.name}
                  </button>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.email}
                    {r.role ? ` · ${r.role}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] capitalize text-muted-foreground">{r.status}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-4 py-3">
          <Text variant="heading">Recent activity</Text>
        </header>
        <div className="max-h-80 divide-y divide-hairline overflow-y-auto">
          {recentActivity.length === 0 ? (
            <Text variant="caption" className="block px-4 py-6 text-center">
              No recorded activity.
            </Text>
          ) : (
            recentActivity.map((a) => (
              <div key={a.id} className="flex flex-row items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate text-xs capitalize text-ink">{a.actionType.replace(/_/g, " ")}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </Screen>
  );
}
