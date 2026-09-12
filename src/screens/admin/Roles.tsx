import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Plus, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
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
      <Screen>
        <PageHeader title="Roles" subtitle="Each role has a rank (top = most senior) and a default 'reports to' role." />

        <div className="flex flex-row gap-2">
          <Input containerClassName="flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="New role name (e.g. Team Lead)" onKeyDown={(e) => e.key === "Enter" && name.trim() && wrap(() => { createRole(me.id, name); setName(""); }, "Role added")} />
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

        <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
          {roles.length === 0 ? (
            <Text variant="caption" className="block p-6 text-center">
              No roles yet.
            </Text>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Reports to</th>
                  <th className="px-3 py-2 text-right font-medium">People</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {roles.map((r, i) => (
                  <tr key={r.id} className="hover:bg-background">
                    <td className="px-3 py-2">
                      <div className="flex flex-row items-center gap-1">
                        <span className="tabular-nums text-muted-foreground">{r.rank}</span>
                        <button type="button" disabled={i === 0} onClick={() => swapRoleRank(me.id, r.id, roles[i - 1].id)} className="rounded p-0.5 hover:bg-muted disabled:opacity-20">
                          <ArrowUp size={12} color={colors.ink} />
                        </button>
                        <button type="button" disabled={i === roles.length - 1} onClick={() => swapRoleRank(me.id, r.id, roles[i + 1].id)} className="rounded p-0.5 hover:bg-muted disabled:opacity-20">
                          <ArrowDown size={12} color={colors.ink} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-row items-center gap-1.5">
                        <GitBranch size={14} color={colors.slate} />
                        <span className="font-medium text-ink">{r.name}</span>
                        {r.isAdminRole ? <Badge label="admin" className="bg-ink" textClassName="text-white" /> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.reportsToRoleId ?? ""}
                        onChange={(e) => patchRole(me.id, r.id, { reportsToRoleId: e.target.value || null })}
                        className="rounded border border-hairline bg-card px-1.5 py-1 text-xs text-ink outline-none focus:border-ink"
                      >
                        <option value="">— none —</option>
                        {roles.filter((o) => o.id !== r.id).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.memberCount}</td>
                    <td className="px-3 py-2 text-right">
                      {!r.isAdminRole ? (
                        <button type="button" onClick={() => confirmAction("Delete role?", `"${r.name}"`, () => wrap(() => deleteRole(me.id, r.id), "Deleted"), "Delete", true)} className="rounded p-1 hover:bg-destructive/10">
                          <Trash2 size={14} color={colors.destructive} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Screen>
    </AdminGuard>
  );
}
