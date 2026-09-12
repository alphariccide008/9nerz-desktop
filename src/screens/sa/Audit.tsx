import { useMemo, useState } from "react";
import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Segmented } from "../../components/ui/Segmented";
import { useDB } from "../../lib/db/store";
import { crossCompanyAudit, saAuditLog } from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";

export default function SaAudit() {
  const [tab, setTab] = useState<"platform" | "sa">("platform");
  const [flagged, setFlagged] = useState(false);
  const tick = useDB((db) => db.auditLogs.length + db.superAdminAuditLogs.length);
  const rows = useMemo(() => crossCompanyAudit({ flaggedOnly: flagged }), [tick, flagged]);
  const saRows = useMemo(() => saAuditLog(), [tick]);

  return (
    <Screen>
      <PageHeader title="Platform audit" subtitle="Cross-company log + the tamper-evident owner action log." />
      <Segmented
        options={[
          { value: "platform", label: "Cross-company" },
          { value: "sa", label: "Owner actions" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "platform" ? (
        <>
          <button type="button" onClick={() => setFlagged((f) => !f)} className="flex flex-row items-center gap-2 self-start">
            <span className={`flex h-4 w-4 items-center justify-center rounded border ${flagged ? "border-ink bg-ink" : "border-hairline"}`}>{flagged ? <span className="text-[10px] font-bold text-white">✓</span> : null}</span>
            <Text variant="caption">Flagged only</Text>
          </button>
          <Card>
            {rows.map((r, i) => (
              <div key={r.id} className={`flex flex-row items-center gap-3 px-4 py-2 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
                <span className={`h-2 w-2 rounded-full ${r.isFlagged ? "bg-destructive" : "bg-hairline"}`} />
                <div className="flex-1">
                  <div className="text-[12px] capitalize text-ink">{r.actionType.replace(/_/g, " ")}</div>
                  <Text variant="caption">
                    {r.companyName} · {r.actorType}
                  </Text>
                </div>
                <Text variant="caption">{relativeTime(r.createdAt)}</Text>
              </div>
            ))}
          </Card>
        </>
      ) : (
        <Card>
          {saRows.map((r, i) => (
            <div key={r.id} className={`px-4 py-2.5 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
              <div className="flex flex-row items-center justify-between">
                <span className="text-[12px] font-medium capitalize text-ink">{r.actionType.replace(/_/g, " ")}</span>
                <Text variant="caption">{relativeTime(r.createdAt)}</Text>
              </div>
              <Text variant="caption">{r.details}</Text>
            </div>
          ))}
        </Card>
      )}
    </Screen>
  );
}
