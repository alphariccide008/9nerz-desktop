import { useMemo } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { listMembers, patchMember, MemberView } from "../../lib/services/org";

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
      <div className="flex flex-row items-center gap-2 py-2" style={{ paddingLeft: depth * 16 }}>
        <Avatar name={`${n.firstName} ${n.lastName}`} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-ink">
            {n.firstName} {n.lastName}
            {n.isCompanyAdmin ? <span className="text-teal"> · admin</span> : null}
          </div>
          <Text variant="caption" className="block truncate">
            {n.roleName ?? "no role"}
            {n.primaryUnitName ? ` · ${n.primaryUnitName}` : ""}
          </Text>
        </div>
        <div className="w-40 shrink-0">
          <Select
            value={n.reportsToUserId}
            options={members.filter((o) => o.id !== n.id).map((o) => ({ value: o.id, label: `${o.firstName} ${o.lastName}` }))}
            onChange={(v) => setManager(n.id, v)}
            placeholder="reports to: —"
            allowClear
          />
        </div>
      </div>
      {n.reports.map((c) => (
        <Row key={c.id} n={c} depth={depth + 1} />
      ))}
    </div>
  );

  return (
    <AdminGuard>
      <Screen maxWidth={720}>
        <PageHeader title="Reporting lines" subtitle="Who reports to whom. Rank and cycle checks are enforced." />
        <Card className="p-3">
          {roots.map((n) => (
            <Row key={n.id} n={n} depth={0} />
          ))}
        </Card>
      </Screen>
    </AdminGuard>
  );
}
