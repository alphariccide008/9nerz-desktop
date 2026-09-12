import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/Feedback";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { auditActionTypes, listAudit } from "../../lib/services/audit";
import { relativeTime } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function Audit() {
  const me = useCurrentUser();
  const [filter, setFilter] = useState<string | null>(null);
  const tick = useDB((db) => db.auditLogs.length);
  const types = useMemo(() => (me ? auditActionTypes(me.companyId) : []), [me, tick]);
  const rows = useMemo(() => (me ? listAudit(me.companyId, filter ? { actionType: filter } : undefined) : []), [me, tick, filter]);

  if (!me) return null;

  return (
    <AdminGuard>
      <Screen>
        <PageHeader title="Audit trail" subtitle="Every state-changing action in your workspace." />
        <Select label="Filter by action" value={filter} options={types.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} onChange={setFilter} allowClear placeholder="All actions" />
        {rows.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={22} color={colors.slate} />} title="Nothing logged yet" />
        ) : (
          <Card>
            {rows.map((r, i) => (
              <div key={r.id} className={`flex flex-row items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
                <span className={`h-2 w-2 rounded-full ${r.isFlagged ? "bg-destructive" : "bg-hairline"}`} />
                <div className="flex-1">
                  <div className="text-[13px] capitalize text-ink">{r.actionType.replace(/_/g, " ")}</div>
                  <Text variant="caption">
                    {r.actorName}
                    {r.entityType ? ` · ${r.entityType}` : ""}
                  </Text>
                </div>
                <Text variant="caption">{relativeTime(r.createdAt)}</Text>
              </div>
            ))}
          </Card>
        )}
      </Screen>
    </AdminGuard>
  );
}
