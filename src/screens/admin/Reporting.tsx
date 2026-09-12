import { useMemo } from "react";
import { Network } from "lucide-react";
import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { listMembers, patchMember, MemberView } from "../../lib/services/org";
import { colors } from "../../lib/theme";

type Node = MemberView & { reports: Node[] };

export default function Reporting() {
  const me = useCurrentUser();
  const toast = useToast();
  const tick = useDB((db) => db.users.map((u) => `${u.id}${u.reportsToUserId}`).join(","));
  const members = useMemo(() => (me ? listMembers(me.companyId) : []), [me, tick]);

  const roots = useMemo(() => {
    const byId = new Map<string, Node>(members.map((m) => [m.id, { ...m, reports: [] }]));
    const top: Node[] = [];
    for (const n of byId.values()) {
      if (n.reportsToUserId && byId.has(n.reportsToUserId)) byId.get(n.reportsToUserId)!.reports.push(n);
      else top.push(n);
    }
    return top;
  }, [members]);

  if (!me) return null;

  const setManager = (id: string, managerId: string) => {
    try {
      patchMember(me.id, id, { reportsToUserId: managerId || null });
      toast.show("Reporting line updated", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const Row = ({ n, depth }: { n: Node; depth: number }) => (
    <div>
      <div className="flex flex-row items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-background" style={{ marginLeft: depth * 16 }}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-ink">
          {n.firstName[0]}
          {n.lastName[0] || ""}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {n.firstName} {n.lastName}
            {n.isCompanyAdmin ? <span className="ml-1.5 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">admin</span> : null}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {n.roleName ?? "no role"}
            {n.primaryUnitName ? ` · ${n.primaryUnitName}` : ""}
          </p>
        </div>
        <select
          value={n.reportsToUserId ?? ""}
          onChange={(e) => setManager(n.id, e.target.value)}
          className="ml-auto shrink-0 rounded border border-hairline bg-card px-1.5 py-1 text-xs text-ink outline-none focus:border-ink"
        >
          <option value="">reports to: —</option>
          {members.filter((o) => o.id !== n.id).map((o) => (
            <option key={o.id} value={o.id}>
              {o.firstName} {o.lastName}
            </option>
          ))}
        </select>
      </div>
      {n.reports.map((c) => (
        <Row key={c.id} n={c} depth={depth + 1} />
      ))}
    </div>
  );

  return (
    <AdminGuard>
      <Screen>
        <div>
          <h1 className="flex flex-row items-center gap-2 font-display text-lg font-bold text-ink">
            <Network size={18} color={colors.ink} /> Reporting lines
          </h1>
          <Text variant="caption" className="mt-0.5 block">
            Who reports to whom. Change a manager from the dropdown on each row.
          </Text>
        </div>
        <div className="rounded-xl border border-hairline bg-card p-3">
          {members.length === 0 ? (
            <Text variant="caption" className="block p-6 text-center">
              No people yet.
            </Text>
          ) : (
            roots.map((n) => <Row key={n.id} n={n} depth={0} />)
          )}
        </div>
      </Screen>
    </AdminGuard>
  );
}
