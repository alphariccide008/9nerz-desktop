import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Snowflake, Sun, Trash2 } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Loading } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/Toast";
import { useDB } from "../../lib/db/store";
import { companyDetail, deleteCompany, setCompanyStatus } from "../../lib/services/superAdmin";
import { confirmAction } from "../../lib/confirm";
import { shortDate } from "../../lib/util";

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
  const { company, subscription, members, units, roles, tasks, openTasks, payments, audit } = data;

  const setStatus = (s: "active" | "frozen" | "suspended", label: string) =>
    confirmAction(`${label} ${company.name}?`, `This ${s === "active" ? "restores" : "cuts"} all access for its users.`, () => {
      setCompanyStatus(id, s);
      toast.show(`Company ${s}`, "success");
    });

  const remove = () => {
    const confirmName = window.prompt(
      `PERMANENT DELETE. This wipes the company and every user, org unit, task and record under it.\n\nType the company name to confirm:\n${company.name}`,
    );
    if (confirmName !== company.name) {
      if (confirmName !== null) window.alert("Name did not match. Nothing deleted.");
      return;
    }
    deleteCompany(id);
    toast.show("Company deleted", "success");
    navigate("/sa/companies", { replace: true });
  };

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
          {company.status === "active" ? (
            <>
              <button
                type="button"
                onClick={() => setStatus("frozen", "Freeze")}
                className="flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                <Snowflake size={15} color="#fff" /> Freeze
              </button>
              <button
                type="button"
                onClick={() => setStatus("suspended", "Suspend")}
                className="flex items-center gap-1.5 rounded-lg bg-[#ea580c] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                <Ban size={15} color="#fff" /> Suspend
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStatus("active", "Reactivate")}
              className="flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Sun size={15} color="#fff" /> Reactivate
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Users", members.length],
          ["Org units", units],
          ["Roles", roles],
          ["Tasks", tasks],
          ["Open tasks", openTasks],
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
          <button type="button" onClick={() => navigate(`/sa/payments`)} className="text-xs text-teal hover:underline">
            All payments
          </button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-4">
          <div>
            <Text variant="caption">Plan</Text>
            <p className="text-sm font-medium capitalize text-ink">{subscription?.tier ?? company.subscriptionTier}</p>
          </div>
          <div>
            <Text variant="caption">Billing status</Text>
            <p className="text-sm font-medium capitalize text-ink">{subscription?.status.replace("_", " ") ?? "—"}</p>
          </div>
          <div>
            <Text variant="caption">Current period ends</Text>
            <p className="text-sm font-medium text-ink">{subscription?.currentPeriodEnd ? shortDate(subscription.currentPeriodEnd) : "—"}</p>
          </div>
          <div>
            <Text variant="caption">Grace ends</Text>
            <p className="text-sm font-medium text-ink">{subscription?.graceEndsAt ? shortDate(subscription.graceEndsAt) : "—"}</p>
          </div>
        </div>
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
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{p.invoiceNumber || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${
                        p.status === "success" ? "bg-teal/15 text-teal" : p.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-amber/20 text-[#8a5a12]"
                      }`}
                    >
                      {p.status === "success" ? "valid" : p.status}
                    </span>
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
