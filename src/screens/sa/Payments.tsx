import { useMemo } from "react";
import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useDB } from "../../lib/db/store";
import { listAllPayments } from "../../lib/services/superAdmin";
import { shortDate } from "../../lib/util";

const STATUS_STYLE: Record<string, string> = {
  success: "bg-teal/15 text-teal",
  pending: "bg-amber/20 text-[#8a5a12]",
  failed: "bg-destructive/15 text-destructive",
};

export default function SaPayments() {
  const tick = useDB((db) => db.payments.length);
  const rows = useMemo(() => listAllPayments(), [tick]);
  const totals = rows.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Screen>
      <div>
        <h1 className="font-display text-lg font-bold text-ink">Payments &amp; billing</h1>
        <Text variant="caption" className="mt-0.5 block">
          Every payment recorded across the platform.
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(["success", "pending", "failed"] as const).map((s) => (
          <div key={s} className="rounded-xl border border-hairline bg-card p-3">
            <p className="text-xs capitalize text-muted-foreground">{s}</p>
            <p className="text-xl font-bold text-ink">{totals[s] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Invoice</th>
              <th className="px-3 py-2.5 font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Provider</th>
              <th className="px-4 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="hover:bg-background">
                  <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{shortDate(p.createdAt)}</td>
                  <td className="px-3 py-2.5 text-ink">{p.companyName}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{p.invoiceNumber || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">
                    {p.currency} {(p.amount / 100).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-muted-foreground">{p.provider}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[p.status]}`}>{p.status}</span>
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
