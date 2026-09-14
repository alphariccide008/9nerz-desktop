import { useMemo, useState } from "react";
import { RefreshCw, Check, X, AlertTriangle } from "lucide-react";
import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useDB } from "../../lib/db/store";
import { listAllPayments, listAllSubscriptions, runBillingSweep, setPaymentStatus } from "../../lib/services/superAdmin";
import { shortDate } from "../../lib/util";

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  success: "bg-teal/15 text-teal",
  pending: "bg-amber/20 text-[#8a5a12]",
  failed: "bg-destructive/15 text-destructive",
};

const SUB_STATUS_STYLE: Record<string, string> = {
  active: "bg-teal/15 text-teal",
  trialing: "bg-amber/20 text-[#8a5a12]",
  past_due: "bg-amber/20 text-[#8a5a12]",
  grace: "bg-[#fde7d1] text-[#b3540f]",
  cancelled: "bg-muted text-muted-foreground",
};

export default function SaPayments() {
  const paymentsTick = useDB((db) => db.payments.length);
  const subsTick = useDB((db) => JSON.stringify(db.subscriptions));
  const payments = useMemo(() => listAllPayments(), [paymentsTick]);
  const subs = useMemo(() => listAllSubscriptions(), [subsTick]);
  const [filter, setFilter] = useState("");
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);

  const totals = payments.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const subSummary = subs.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const atRisk = subs.filter((s) => ["past_due", "grace"].includes(s.status));
  const filteredPayments = filter ? payments.filter((p) => p.status === filter) : payments;

  const runSweep = () => {
    setSweeping(true);
    setSweepMsg(null);
    try {
      const r = runBillingSweep();
      setSweepMsg(
        `Sweep done: ${r.movedToGrace} entered grace, ${r.movedToPastDue} moved to past due, ${r.cancelledAndDowngraded} moved to Free` +
          (r.trialsExpired ? `, ${r.trialsExpired} trials expired` : "") +
          ".",
      );
    } finally {
      setSweeping(false);
    }
  };

  const review = (id: string, status: "success" | "failed") => {
    setPaymentStatus(id, status);
  };

  return (
    <Screen>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Payments &amp; billing</h1>
          <Text variant="caption" className="mt-0.5 block">
            Review payments, and let the grace-period sweep move lapsed companies to Free.
          </Text>
        </div>
        <button
          type="button"
          onClick={runSweep}
          disabled={sweeping}
          className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${sweeping ? "animate-spin" : ""}`} />
          Run billing sweep
        </button>
      </div>

      {sweepMsg && <div className="rounded-lg border border-hairline bg-card px-4 py-2.5 text-sm text-ink">{sweepMsg}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Valid payments", totals.success ?? 0],
          ["Pending review", totals.pending ?? 0],
          ["Failed", totals.failed ?? 0],
          ["In grace", subSummary.grace ?? 0],
          ["Past due", subSummary.past_due ?? 0],
          ["Cancelled", subSummary.cancelled ?? 0],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-xl border border-hairline bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-ink">{val as number}</p>
          </div>
        ))}
      </div>

      {atRisk.length > 0 && (
        <section className="rounded-xl border border-orange-200 bg-orange-50">
          <header className="flex items-center gap-2 border-b border-orange-200 px-4 py-2.5 text-sm font-semibold text-orange-800">
            <AlertTriangle className="h-4 w-4" />
            Companies at billing risk
          </header>
          <div className="divide-y divide-orange-200/60">
            {atRisk.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{s.companyName}</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {s.currentPeriodEnd && <span>due {shortDate(s.currentPeriodEnd)}</span>}
                  {s.graceEndsAt && <span>grace ends {shortDate(s.graceEndsAt)}</span>}
                  <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${SUB_STATUS_STYLE[s.status] ?? ""}`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">All payments</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-hairline bg-card px-2 py-1.5 text-xs outline-none focus:border-ink"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="success">Valid</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Invoice</th>
              <th className="px-3 py-2.5 font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Provider</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-background">
                  <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{shortDate(p.createdAt)}</td>
                  <td className="px-3 py-2.5 text-ink">{p.companyName}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{p.invoiceNumber || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">
                    {p.currency} {(p.amount / 100).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-muted-foreground">{p.provider}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${PAYMENT_STATUS_STYLE[p.status]}`}>
                      {p.status === "success" ? "valid" : p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.status === "pending" ? (
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => review(p.id, "success")}
                          className="flex items-center gap-1 rounded-md bg-teal px-2 py-1 text-[11px] font-semibold text-white hover:brightness-110"
                        >
                          <Check className="h-3 w-3" /> Valid
                        </button>
                        <button
                          type="button"
                          onClick={() => review(p.id, "failed")}
                          className="flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-[11px] font-semibold text-white hover:brightness-110"
                        >
                          <X className="h-3 w-3" /> Invalid
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">reviewed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Screen>
  );
}
