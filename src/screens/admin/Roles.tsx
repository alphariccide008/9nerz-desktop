import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Plus, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { createRole, deleteRole, listRoles, patchRole, swapRoleRank } from "../../lib/services/org";
import { confirmAction } from "../../lib/confirm";
import { colors } from "../../lib/theme";

export default function Roles() {
  const me = useCurrentUser();
  const toast = useToast();
  const [name, setName] = useState("");
  const tick = useDB((db) => db.roles.map((r) => `${r.id}${r.rank}${r.reportsToRoleId}`).join(","));
  const roles = useMemo(() => (me ? listRoles(me.companyId) : []), [me, tick]);

  if (!me) return null;

  const wrap = (fn: () => void, msg: string) => {
    try {
      fn();
      toast.show(msg, "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <AdminGuard>
      <Screen maxWidth={640}>
        <PageHeader title="Roles" subtitle="Each role has a rank (top = most senior) and a default 'reports to' role." />

        <div className="flex flex-row gap-2">
          <Input containerClassName="flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="New role name (e.g. Team Lead)" />
          <Button
            title="Add"
            icon={<Plus size={15} color={colors.white} />}
            onPress={() =>
              wrap(() => {
                createRole(me.id, name);
                setName("");
              }, "Role added")
            }
            disabled={!name.trim()}
          />
        </div>

        <Card>
          {roles.map((r, i) => (
            <div key={r.id} className={`flex flex-col gap-2 p-3 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
              <div className="flex flex-row items-center gap-2">
                <Text variant="caption" className="w-6 tabular-nums">
                  {r.rank}
                </Text>
                <button type="button" disabled={i === 0} onClick={() => swapRoleRank(me.id, r.id, roles[i - 1].id)} className="p-0.5 disabled:opacity-40">
                  <ArrowUp size={13} color={i === 0 ? colors.hairline : colors.slate} />
                </button>
                <button type="button" disabled={i === roles.length - 1} onClick={() => swapRoleRank(me.id, r.id, roles[i + 1].id)} className="p-0.5 disabled:opacity-40">
                  <ArrowDown size={13} color={i === roles.length - 1 ? colors.hairline : colors.slate} />
                </button>
                <GitBranch size={14} color={colors.slate} />
                <span className="text-[13px] font-medium text-ink">{r.name}</span>
                {r.isAdminRole ? <Badge label="admin" className="bg-ink" textClassName="text-white" /> : null}
                <Text variant="caption" className="ml-auto">
                  {r.memberCount} {r.memberCount === 1 ? "person" : "people"}
                </Text>
                {!r.isAdminRole ? (
                  <button type="button" onClick={() => confirmAction("Delete role?", `"${r.name}"`, () => wrap(() => deleteRole(me.id, r.id), "Deleted"), "Delete", true)} className="p-1">
                    <Trash2 size={13} color={colors.destructive} />
                  </button>
                ) : null}
              </div>
              <Select
                value={r.reportsToRoleId}
                options={roles.filter((o) => o.id !== r.id).map((o) => ({ value: o.id, label: o.name }))}
                onChange={(v) => patchRole(me.id, r.id, { reportsToRoleId: v || null })}
                placeholder="Reports to: —"
                allowClear
              />
            </div>
          ))}
        </Card>
      </Screen>
    </AdminGuard>
  );
}
