import { ReactNode, useMemo, useState } from "react";
import { Activity, AlertTriangle, CreditCard, Flag, Inbox, LifeBuoy, RefreshCw, type LucideIcon } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useDB } from "../../lib/db/store";
import {
  dismissAuditFlag,
  listSupportEscalations,
  operationsHealth,
  resolveSupportEscalation,
  runBillingSweep,
} from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";

const empty = <p className="text-xs text-muted-foreground">Nothing needs attention here.</p>;

function Card({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4" />
        {title}
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${count > 0 ? "bg-amber/20 text-[#8a5a12]" : "bg-teal/15 text-teal"}`}>
          {count}
        </span>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function SaOperations() {
  const toast = useToast();
  const tick = useDB(
    (db) => db.subscriptions.length + db.tickets.length + db.attachments.length + db.auditLogs.length + db.supportEscalations.length + db.platformTickets.length,
  );
  const health = useMemo(() => operationsHealth(), [tick]);
  const escalations = useMemo(() => listSupportEscalations("open"), [tick]);
  const [sweeping, setSweeping] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const sweep = () => {
    setSweeping(true);
    try {
      const r = runBillingSweep();
      toast.show(`Sweep done — ${r.movedToGrace} to grace, ${r.movedToPastDue} to past due, ${r.cancelledAndDowngraded} downgraded, ${r.trialsExpired} trials expired`, "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSweeping(false);
    }
  };

  const act = (key: string, fn: () => void) => {
    setBusy(key);
    try {
      fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Activity className="h-5 w-5" /> Operations
          </h1>
          <Text variant="caption" className="mt-0.5 block max-w-xl">
            Platform-wide health. Widespread failure across every company usually means an infra / provider issue, not individual accounts.
          </Text>
        </div>
        <button
          type="button"
          onClick={sweep}
          disabled={sweeping}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink transition hover:border-ink disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${sweeping ? "animate-spin" : ""}`} />
          Run billing sweep
        </button>
      </div>

      <Card title="Support escalations" icon={LifeBuoy} count={escalations.length}>
        {escalations.length === 0 ? (
          <p className="text-xs text-muted-foreground">No open escalations. The assistant is handling the generic questions.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {escalations.map((e) => (
              <li key={e.id} className="py-2.5 text-sm">
                <p className="text-ink">{e.question}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{e.companyName ?? "—"}</span>
                  {e.requesterName && <span>· {e.requesterName}</span>}
                  <span>· {relativeTime(e.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => act(`esc-${e.id}`, () => resolveSupportEscalation(e.id))}
                    disabled={busy === `esc-${e.id}`}
                    className="ml-auto rounded-lg border border-hairline px-2 py-1 font-medium text-ink hover:border-ink disabled:opacity-40"
                  >
                    Mark resolved
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Billing risk" icon={CreditCard} count={health.billingRisk.length}>
        {health.billingRisk.length === 0
          ? empty
          : (
            <ul className="divide-y divide-hairline">
              {health.billingRisk.map((b, i) => (
                <li key={`${b.companyId}-${i}`} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="font-medium text-ink">{b.companyName}</span>
                  <span className="rounded bg-amber/20 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-[#8a5a12]">
                    {b.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <Card title="Attachments stuck in scan" icon={AlertTriangle} count={health.stuckAttachmentScans}>
        {health.stuckAttachmentScans === 0 ? empty : (
          <p className="text-xs text-ink">{health.stuckAttachmentScans} attachment{health.stuckAttachmentScans === 1 ? "" : "s"} pending scan for over 24h.</p>
        )}
      </Card>

      <Card title="Unrouted ticket pile-ups" icon={Inbox} count={health.unroutedPileups.length}>
        {health.unroutedPileups.length === 0 ? empty : (
          <ul className="divide-y divide-hairline">
            {health.unroutedPileups.map((u) => (
              <li key={u.companyId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{u.companyName}</span>
                <span className="text-[11px] text-muted-foreground sm:ml-auto">{u.count} open unrouted, no routing rules?</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Flagged for review" icon={Flag} count={health.flaggedAuditEntries.length}>
        {health.flaggedAuditEntries.length === 0 ? empty : (
          <ul className="divide-y divide-hairline">
            {health.flaggedAuditEntries.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-mono text-xs text-ink">{f.actionType.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">{f.companyName}</span>
                <button
                  type="button"
                  onClick={() => act(`flag-${f.id}`, () => dismissAuditFlag(f.id))}
                  disabled={busy === `flag-${f.id}`}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-xs font-medium text-ink hover:border-ink disabled:opacity-40"
                >
                  Dismiss, not a violation
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Screen>
  );
}
