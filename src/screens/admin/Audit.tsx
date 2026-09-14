import { useEffect, useMemo, useState } from "react";
import { Flag } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { AuditView, fetchRealAudit, listAudit } from "../../lib/services/audit";
import { useSession } from "../../lib/session";

export default function Audit() {
  const me = useCurrentUser();
  const { real } = useSession();
  const tick = useDB((db) => db.auditLogs.length);
  const mockRows = useMemo(() => (me ? listAudit(me.companyId) : []), [me, tick]);
  const [realRows, setRealRows] = useState<AuditView[] | null>(null);

  useEffect(() => {
    if (!real) return;
    fetchRealAudit().then(setRealRows);
  }, [real?.user.id]);

  const rows = real ? (realRows ?? []) : mockRows;

  if (!me) return null;

  return (
    <AdminGuard>
      <Screen>
        <PageHeader title="Audit trail" subtitle="Every structural change in your organization." />
        <div className="overflow-hidden rounded-xl border border-hairline bg-card">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {r.isFlagged ? <Flag className="h-3.5 w-3.5 shrink-0 text-red-500" /> : null}
                    <span className="min-w-0 truncate font-medium text-ink">{r.actionType.replace(/_/g, " ")}</span>
                    {r.entityType ? <span className="shrink-0 text-xs text-muted-foreground">· {r.entityType}</span> : null}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">by {r.actorName}</span>
                  <span className="text-[11px] text-muted-foreground sm:ml-auto sm:shrink-0">{new Date(r.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Screen>
    </AdminGuard>
  );
}
