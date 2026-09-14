import { useMemo } from "react";
import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useDB } from "../../lib/db/store";
import { saAuditLog } from "../../lib/services/superAdmin";

export default function SaActivity() {
  const tick = useDB((db) => db.superAdminAuditLogs.length);
  const rows = useMemo(() => saAuditLog(), [tick]);

  return (
    <Screen>
      <div>
        <h1 className="font-display text-lg font-bold text-ink">My actions</h1>
        <Text variant="caption">Append-only log of every Super Admin action: logins, company views, freezes. Cannot be edited or deleted.</Text>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-3 py-2.5 font-medium">Action</th>
              <th className="px-3 py-2.5 font-medium">Target</th>
              <th className="px-3 py-2.5 font-medium">Detail</th>
              <th className="px-4 py-2.5 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No actions logged yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-background">
                  <td className="whitespace-nowrap px-4 py-2 text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium capitalize text-ink">{r.actionType.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.companyName || "—"}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{r.details || "—"}</td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Screen>
  );
}
