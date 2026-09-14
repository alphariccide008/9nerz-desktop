import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useDB, getDB } from "../../lib/db/store";
import { crossCompanyAudit } from "../../lib/services/superAdmin";

export default function SaAudit() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [actionType, setActionType] = useState("");
  const [flagged, setFlagged] = useState(searchParams.get("flagged") === "1");
  const companyId = searchParams.get("companyId");
  const tick = useDB((db) => db.auditLogs.length);

  const rows = useMemo(
    () => crossCompanyAudit({ actionType: actionType || undefined, flaggedOnly: flagged }).filter((r) => !companyId || getDB().companies.find((c) => c.id === companyId)?.name === r.companyName),
    [tick, flagged, actionType, companyId],
  );
  const actionTypes = useMemo(() => [...new Set(getDB().auditLogs.map((a) => a.actionType))].sort(), [tick]);

  return (
    <Screen>
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Audit trail</h1>
          <Text variant="caption">Every state-changing action across all companies. {rows.length} shown.</Text>
        </div>
        <div className="flex flex-row flex-wrap items-center gap-2">
          {companyId ? (
            <button
              type="button"
              onClick={() => setSearchParams((p) => { p.delete("companyId"); return p; })}
              className="rounded-lg border border-hairline bg-card px-2 py-1.5 text-xs text-muted-foreground"
            >
              Company filter ✕
            </button>
          ) : null}
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="rounded-lg border border-hairline bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          >
            <option value="">All actions</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
            Flagged only
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Action</th>
              <th className="px-3 py-2.5 font-medium">Entity</th>
              <th className="px-3 py-2.5 font-medium">Actor</th>
              <th className="px-4 py-2.5 font-medium">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={r.isFlagged ? "bg-destructive/5" : "hover:bg-background"}>
                  <td className="whitespace-nowrap px-4 py-2 text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-ink">{r.companyName}</td>
                  <td className="px-3 py-2 capitalize text-ink">{r.actionType.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.entityType || "—"}</td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{r.actorType}</td>
                  <td className="px-4 py-2 text-[11px]">{r.isFlagged ? <span className="font-semibold text-destructive">⚑ flagged</span> : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Screen>
  );
}
