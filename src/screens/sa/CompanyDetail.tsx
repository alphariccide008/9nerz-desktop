import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Play, Snowflake, Trash2 } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import { Loading } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/Toast";
import { useDB } from "../../lib/db/store";
import { companyDetail, deleteCompany, setCompanyStatus } from "../../lib/services/superAdmin";
import { confirmAction } from "../../lib/confirm";
import { shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-teal/15 text-teal",
  frozen: "bg-ink/10 text-ink",
  suspended: "bg-destructive/15 text-destructive",
};
const USER_STATUS_BADGE: Record<string, string> = {
  active: "bg-teal/15 text-teal",
  invited: "bg-amber/20 text-[#8a5a12]",
  inactive: "bg-muted text-slate",
};

export default function SaCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const tick = useDB((db) => JSON.stringify(db.companies.find((c) => c.id === id)) + db.auditLogs.length);
  const data = useMemo(() => {
    try {
      return id ? companyDetail(id) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  if (!data || !id) return (
    <Screen>
      <Loading />
    </Screen>
  );
  const { company, subscription, members, units, tasks, tickets, payments, audit } = data;
  const openTasks = tasks; // local model doesn't split open vs. total; shown as one figure

  const setStatus = (s: "active" | "frozen" | "suspended") =>
    confirmAction(`Set ${company.name} to ${s}?`, s === "active" ? "Users regain access." : "This blocks all authenticated access.", () => {
      setCompanyStatus(id, s);
      toast.show(`Company ${s}`, "success");
    });

  return (
    <Screen>
      <button type="button" onClick={() => navigate("/sa/companies")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
        <ArrowLeft size={13} /> All companies
      </button>

      <div className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-row items-center gap-2">
            <h1 className="font-display text-lg font-bold text-ink">{company.name}</h1>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[company.status]}`}>{company.status}</span>
          </div>
          <Text variant="caption" className="block">
            /{company.slug} · {company.subscriptionTier} tier · created {shortDate(company.createdAt)}
          </Text>
        </div>
        <div className="flex flex-row flex-wrap gap-2">
          {company.status !== "active" ? (
            <Button title="Reactivate" size="sm" icon={<Play size={13} color={colors.white} />} onPress={() => setStatus("active")} />
          ) : (
            <>
              <Button title="Freeze" size="sm" variant="outline" icon={<Snowflake size={13} color={colors.ink} />} onPress={() => setStatus("frozen")} />
              <Button title="Suspend" size="sm" variant="outline" icon={<Ban size={13} color={colors.ink} />} onPress={() => setStatus("suspended")} />
            </>
          )}
          <Button
            title="Delete"
            size="sm"
            variant="destructive"
            icon={<Trash2 size={13} color={colors.white} />}
            onPress={() =>
              confirmAction(
                "Delete this company?",
                "Permanently removes the tenant and all its data.",
                () => {
                  deleteCompany(id);
                  toast.show("Company deleted", "success");
                  navigate("/sa/companies", { replace: true });
                },
                "Delete",
                true,
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Users", members.length],
          ["Org units", units],
          ["Tasks", tasks],
          ["Open tasks", openTasks],
          ["Tickets", tickets],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-xl border border-hairline bg-card p-3">
            <Text variant="caption">{label}</Text>
            <p className="text-xl font-bold text-ink">{val}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-hairline bg-card">
        <header className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <Text variant="heading">Billing</Text>
          <Text variant="caption">{subscription ? `${subscription.tier} · ${subscription.status}` : "—"}</Text>
        </header>
        {payments.length === 0 ? (
          <Text variant="caption" className="block px-4 py-4">
            No payments recorded.
          </Text>
        ) : (
          <table className="w-full min-w-[480px] text-sm">
            <tbody className="divide-y divide-hairline">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground">{shortDate(p.createdAt)}</td>
                  <td className="px-3 py-2 font-medium text-ink">
                    {p.currency} {(p.amount / 100).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{p.provider}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${p.status === "success" ? "bg-teal/15 text-teal" : "bg-amber/20 text-[#8a5a12]"}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-hairline bg-card">
        <header className="flex flex-row items-center justify-between border-b border-hairline px-4 py-3">
          <Text variant="heading">People · {members.length}</Text>
        </header>
        <div className="max-h-[28rem] overflow-auto">
          {members.length === 0 ? (
            <Text variant="caption" className="block px-4 py-6 text-center">
              No people yet.
            </Text>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-background">
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => navigate(`/sa/users/${m.id}`)} className="font-medium text-ink hover:underline">
                        {m.name}
                      </button>
                      {m.isAdmin ? <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">admin</span> : null}
                      <p className="text-[11px] text-muted-foreground">{m.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${USER_STATUS_BADGE[m.status] ?? ""}`}>{m.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-card">
        <header className="flex flex-row items-center justify-between border-b border-hairline px-4 py-3">
          <Text variant="heading">Recent audit</Text>
        </header>
        <div className="max-h-72 divide-y divide-hairline overflow-y-auto">
          {audit.slice(0, 12).length === 0 ? (
            <Text variant="caption" className="block px-4 py-6 text-center">
              No audit entries.
            </Text>
          ) : (
            audit.slice(0, 12).map((a) => (
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
