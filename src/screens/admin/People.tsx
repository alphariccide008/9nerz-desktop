import { useMemo, useState } from "react";
import { Clock, Mail, UserPlus, X } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Sheet } from "../../components/ui/Sheet";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { createInvite, listInvites, listMembers, listRoles, listUnits, patchMember, revokeInvite } from "../../lib/services/org";
import { shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-teal/15 text-teal",
  invited: "bg-amber/20 text-[#8a5a12]",
  inactive: "bg-muted text-slate",
};

export default function People() {
  const me = useCurrentUser();
  const toast = useToast();
  const tick = useDB((db) => db.users.map((u) => `${u.id}${u.roleId}${u.reportsToUserId}${u.status}`).join(",") + db.userOrgUnits.length);
  const [inviteOpen, setInviteOpen] = useState(false);

  const members = useMemo(() => (me ? listMembers(me.companyId) : []), [me, tick]);
  const roles = useMemo(() => (me ? listRoles(me.companyId) : []), [me, tick]);
  const units = useMemo(() => (me ? listUnits(me.companyId).units : []), [me, tick]);
  const invites = useMemo(() => (me ? listInvites(me.companyId) : []), [me, tick]);
  const active = members.filter((m) => m.status !== "invited");

  if (!me) return null;

  const patch = (id: string, body: Parameters<typeof patchMember>[2]) => {
    try {
      patchMember(me.id, id, body);
      toast.show("Updated", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <AdminGuard>
      <Screen>
        <PageHeader title="People" subtitle="Invite people, set their role, unit and who they report to." right={<Button title="Invite" size="sm" icon={<UserPlus size={14} color={colors.white} />} onPress={() => setInviteOpen(true)} />} />

        {invites.length > 0 ? (
          <div className="rounded-xl border border-amber/40 bg-amber/[0.06] p-3">
            <Text variant="caption" className="mb-1.5 block font-semibold uppercase tracking-wide text-[#8a5a12]">
              Pending invites
            </Text>
            <div className="flex flex-col gap-1">
              {invites.map((iv) => (
                <div key={iv.id} className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
                  <Mail size={13} color="#8a5a12" />
                  {iv.email}
                  {iv.role ? <span className="text-xs text-muted-foreground">· {iv.role.name}</span> : null}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock size={10} /> expires {shortDate(iv.inviteExpires)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      revokeInvite(me.id, iv.id);
                      toast.show("Invite revoked", "success");
                    }}
                    className="ml-auto rounded-md border border-hairline bg-card px-2 py-1 text-[11px] font-medium text-slate hover:border-destructive hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Reports to</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {active.map((m) => (
                <tr key={m.id} className="hover:bg-background">
                  <td className="px-3 py-2">
                    <p className="font-medium text-ink">
                      {m.firstName} {m.lastName}
                      {m.isCompanyAdmin ? <span className="ml-1.5 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">admin</span> : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{m.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.roleId ?? ""}
                      onChange={(e) => patch(m.id, { roleId: e.target.value || null })}
                      className="rounded border border-hairline bg-card px-1.5 py-1 text-xs text-ink outline-none focus:border-ink"
                    >
                      <option value="">—</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.primaryUnitId ?? ""}
                      onChange={(e) => patch(m.id, { unitIds: e.target.value ? [e.target.value] : [], primaryUnitId: e.target.value || null })}
                      className="rounded border border-hairline bg-card px-1.5 py-1 text-xs text-ink outline-none focus:border-ink"
                    >
                      <option value="">—</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {m.isCompanyAdmin ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <select
                        value={m.reportsToUserId ?? ""}
                        onChange={(e) => patch(m.id, { reportsToUserId: e.target.value || null })}
                        className="rounded border border-hairline bg-card px-1.5 py-1 text-xs text-ink outline-none focus:border-ink"
                      >
                        <option value="">—</option>
                        {active.filter((o) => o.id !== m.id).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.firstName} {o.lastName}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.isCompanyAdmin ? (
                      <Badge label={m.status} className={STATUS_BADGE[m.status]} />
                    ) : (
                      <select
                        value={m.status}
                        onChange={(e) => patch(m.id, { status: e.target.value as "active" | "inactive" })}
                        className={`rounded border-0 px-1.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[m.status] || ""}`}
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <InviteSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          roles={roles}
          units={units}
          members={active}
          onInvite={(input) => {
            try {
              createInvite(me.id, input);
              toast.show("Invitation created", "success");
              setInviteOpen(false);
            } catch (e) {
              toast.show(e instanceof Error ? e.message : "Failed", "error");
            }
          }}
        />
      </Screen>
    </AdminGuard>
  );
}

function InviteSheet({
  open,
  onClose,
  roles,
  units,
  members,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  roles: { id: string; name: string }[];
  units: { id: string; name: string }[];
  members: { id: string; firstName: string; lastName: string }[];
  onInvite: (i: { email: string; firstName?: string; roleId?: string; unitId?: string; reportsToUserId?: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [reportsTo, setReportsTo] = useState<string | null>(null);

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      title="Invite someone"
      footer={
        <Button
          title="Send invitation"
          fullWidth
          disabled={!email.trim()}
          onPress={() =>
            onInvite({
              email,
              firstName: firstName || undefined,
              roleId: roleId || undefined,
              unitId: unitId || undefined,
              reportsToUserId: reportsTo || undefined,
            })
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Work email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
        <Input label="First name (optional)" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Select label="Role (optional)" value={roleId} options={roles.map((r) => ({ value: r.id, label: r.name }))} onChange={setRoleId} allowClear />
        <Select label="Unit (optional)" value={unitId} options={units.map((u) => ({ value: u.id, label: u.name }))} onChange={setUnitId} allowClear />
        <Select label="Reports to (optional)" value={reportsTo} options={members.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))} onChange={setReportsTo} allowClear />
      </div>
    </Sheet>
  );
}
