import { ReactNode, useMemo, useState } from "react";
import { AlertTriangle, Flag, Inbox, LifeBuoy, RefreshCcw, ShieldAlert, type LucideIcon } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Banner } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/Toast";
import { useDB } from "../../lib/db/store";
import { operationsHealth, runBillingSweep } from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function SaOperations() {
  const toast = useToast();
  const tick = useDB((db) => db.subscriptions.length + db.tickets.length + db.attachments.length + db.auditLogs.length + db.supportEscalations.length + db.platformTickets.length);
  const health = useMemo(() => operationsHealth(), [tick]);
  const [sweeping, setSweeping] = useState(false);

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

  const allHealthy =
    health.billingRisk.length === 0 &&
    health.unroutedPileups.length === 0 &&
    health.stuckAttachmentScans === 0 &&
    health.flaggedAuditEntries.length === 0 &&
    health.openSupportEscalations === 0 &&
    health.openPlatformTickets === 0;

  return (
    <Screen>
      <PageHeader
        title="Operations"
        subtitle="Platform health signals — no cron here, so this reflects the last time each check ran."
        right={<Button title="Run billing sweep" size="sm" variant="outline" icon={<RefreshCcw size={13} color={colors.ink} />} loading={sweeping} onPress={sweep} />}
      />

      {allHealthy ? <Banner tone="success">Nothing needs attention right now.</Banner> : null}

      <div className="flex flex-row flex-wrap gap-2.5">
        <MiniStat label="Billing risk" value={health.billingRisk.length} danger={health.billingRisk.length > 0} />
        <MiniStat label="Unrouted pileups" value={health.unroutedPileups.reduce((n, u) => n + u.count, 0)} danger={health.unroutedPileups.length > 0} />
        <MiniStat label="Stuck scans" value={health.stuckAttachmentScans} danger={health.stuckAttachmentScans > 0} />
        <MiniStat label="Flagged entries" value={health.flaggedAuditEntries.length} danger={health.flaggedAuditEntries.length > 0} />
        <MiniStat label="Open escalations" value={health.openSupportEscalations} danger={health.openSupportEscalations > 0} />
        <MiniStat label="Open mailbox" value={health.openPlatformTickets} danger={health.openPlatformTickets > 0} />
      </div>

      {health.billingRisk.length > 0 ? (
        <Section icon={AlertTriangle} title="Billing risk">
          {health.billingRisk.map((b, i) => (
            <Row key={`${b.companyId}-${i}`} left={b.companyName} right={b.status} first={i === 0} />
          ))}
        </Section>
      ) : null}

      {health.unroutedPileups.length > 0 ? (
        <Section icon={Inbox} title="Unrouted ticket pileups">
          {health.unroutedPileups.map((u, i) => (
            <Row key={u.companyId} left={u.companyName} right={`${u.count} unrouted`} first={i === 0} />
          ))}
        </Section>
      ) : null}

      {health.flaggedAuditEntries.length > 0 ? (
        <Section icon={Flag} title="Flagged audit entries">
          {health.flaggedAuditEntries.map((f, i) => (
            <Row key={f.id} left={`${f.companyName} · ${f.actionType.replace(/_/g, " ")}`} right={relativeTime(f.createdAt)} first={i === 0} />
          ))}
        </Section>
      ) : null}

      {health.lastEscalationRun.length > 0 ? (
        <Section icon={ShieldAlert} title="Last SLA escalation, per company">
          {health.lastEscalationRun.map((l, i) => (
            <Row key={l.companyId} left={l.companyName} right={relativeTime(l.at)} first={i === 0} />
          ))}
        </Section>
      ) : null}

      {health.openSupportEscalations > 0 || health.openPlatformTickets > 0 ? (
        <Banner tone="info">
          <div className="flex flex-row items-center gap-1.5">
            <LifeBuoy size={13} color={colors.ink} />
            <Text variant="caption">
              {health.openSupportEscalations} open assistant escalation{health.openSupportEscalations === 1 ? "" : "s"} and {health.openPlatformTickets} open mailbox message
              {health.openPlatformTickets === 1 ? "" : "s"} — see Support.
            </Text>
          </div>
        </Banner>
      ) : null}
    </Screen>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="min-w-[140px] flex-1 rounded-xl border p-3" style={{ borderColor: danger ? "#FECACA" : colors.hairline, backgroundColor: danger ? "rgba(254,242,242,0.6)" : colors.card }}>
      <Text variant="caption">{label}</Text>
      <div className="mt-0.5 text-[20px] font-bold" style={{ color: danger ? colors.destructive : colors.ink }}>
        {value}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex flex-row items-center gap-1.5">
        <Icon size={14} color={colors.ink} />
        <Text variant="heading">{title}</Text>
      </div>
      <Card>{children}</Card>
    </div>
  );
}

function Row({ left, right, first }: { left: string; right: string; first?: boolean }) {
  return (
    <div className={`flex flex-row items-center justify-between px-4 py-2.5 ${first ? "" : "border-t border-hairline/60"}`}>
      <span className="flex-1 truncate text-[13px] text-ink">{left}</span>
      <Text variant="caption">{right}</Text>
    </div>
  );
}
