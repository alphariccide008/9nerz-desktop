import { useMemo, useState } from "react";
import { Check, Clock, Mail, UserPlus, X } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Sheet } from "../../components/ui/Sheet";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { Banner } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { createInvite, listInvites, listMembers, listRoles, listUnits, patchMember, revokeInvite } from "../../lib/services/org";
import { shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function People() {
  const me = useCurrentUser();
  const toast = useToast();
  const tick = useDB((db) => db.users.map((u) => `${u.id}${u.roleId}${u.reportsToUserId}${u.status}`).join(",") + db.userOrgUnits.length);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const members = useMemo(() => (me ? listMembers(me.companyId) : []), [me, tick]);
  const roles = useMemo(() => (me ? listRoles(me.companyId) : []), [me, tick]);
  const units = useMemo(() => (me ? listUnits(me.companyId).units : []), [me, tick]);
  const invites = useMemo(() => (me ? listInvites(me.companyId) : []), [me, tick]);
  const active = members.filter((m) => m.status !== "invited");
  const selected = members.find((m) => m.id === detail);

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
      <Screen maxWidth={720}>
        <PageHeader title="People" subtitle="Invite people, set their role, unit and who they report to." right={<Button title="Invite" size="sm" icon={<UserPlus size={14} color={colors.white} />} onPress={() => setInviteOpen(true)} />} />

        {invites.length > 0 ? (
          <Card className="flex flex-col gap-1.5 border-amber/40 bg-amber/[0.06] p-3">
            <Text variant="caption" className="font-semibold uppercase tracking-wide text-[#B45309]">
              Pending invites
            </Text>
            {invites.map((iv) => (
              <div key={iv.id} className="flex flex-row items-center gap-2">
                <Mail size={13} color="#B45309" />
                <span className="text-[13px] text-ink">{iv.email}</span>
                {iv.role ? <Text variant="caption">· {iv.role.name}</Text> : null}
                <Text variant="caption" className="ml-auto flex items-center gap-1">
                  <Clock size={10} color={colors.mutedForeground} /> {shortDate(iv.inviteExpires)}
                </Text>
                <button
                  type="button"
                  onClick={() => {
                    revokeInvite(me.id, iv.id);
                    toast.show("Invite revoked", "success");
                  }}
                >
                  <X size={13} color={colors.slate} />
                </button>
              </div>
            ))}
            {invites[0]?.token ? (
              <Banner tone="info">
                <Text variant="caption">Dev: share this link — nerz://accept-invite?token={invites[0].token}</Text>
              </Banner>
            ) : null}
          </Card>
        ) : null}

        <Card>
          {active.map((m, i) => (
            <button key={m.id} type="button" onClick={() => setDetail(m.id)} className={`flex w-full flex-row items-center gap-3 px-3 py-3 text-left ${i > 0 ? "border-t border-hairline/60" : ""}`}>
              <Avatar name={`${m.firstName} ${m.lastName}`} size="sm" lastActiveAt={m.lastActiveAt} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-ink">
                  {m.firstName} {m.lastName}
                  {m.isCompanyAdmin ? <span className="text-teal"> · admin</span> : null}
                </div>
                <Text variant="caption" className="block truncate">
                  {m.roleName ?? "no role"}
                  {m.primaryUnitName ? ` · ${m.primaryUnitName}` : ""}
                </Text>
              </div>
              <Badge label={m.status} className={m.status === "active" ? "bg-teal/15" : "bg-muted"} />
            </button>
          ))}
        </Card>

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

        <Sheet visible={!!selected} onClose={() => setDetail(null)} title={selected ? `${selected.firstName} ${selected.lastName}` : ""}>
          {selected ? (
            <div className="flex flex-col gap-3">
              <Text variant="caption">{selected.email}</Text>
              <Select label="Role" value={selected.roleId} options={roles.map((r) => ({ value: r.id, label: r.name }))} onChange={(v) => patch(selected.id, { roleId: v || null })} allowClear />
              <div className="flex flex-col gap-1.5">
                <Text variant="label">Units (a person can belong to more than one)</Text>
                {units.map((u) => {
                  const membership = selected.units.find((x) => x.id === u.id);
                  const checked = !!membership;
                  return (
                    <div key={u.id} className="flex flex-row items-center gap-2.5 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          const currentIds = selected.units.map((x) => x.id);
                          const nextIds = checked ? currentIds.filter((id) => id !== u.id) : [...currentIds, u.id];
                          const nextPrimary =
                            checked && membership?.isPrimary ? nextIds[0] ?? null : selected.primaryUnitId && nextIds.includes(selected.primaryUnitId) ? selected.primaryUnitId : nextIds[0] ?? null;
                          patch(selected.id, { unitIds: nextIds, primaryUnitId: nextPrimary });
                        }}
                        className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-ink bg-ink" : "border-hairline"}`}
                      >
                        {checked ? <Check size={11} color="#fff" /> : null}
                      </button>
                      <span className="flex-1 text-[13px] text-ink">{u.name}</span>
                      {checked ? (
                        <button type="button" onClick={() => patch(selected.id, { unitIds: selected.units.map((x) => x.id), primaryUnitId: u.id })}>
                          <Text variant="caption" className={membership?.isPrimary ? "font-semibold text-teal" : ""}>
                            {membership?.isPrimary ? "primary" : "set primary"}
                          </Text>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <Select
                label="Reports to"
                value={selected.reportsToUserId}
                options={active.filter((o) => o.id !== selected.id).map((o) => ({ value: o.id, label: `${o.firstName} ${o.lastName}` }))}
                onChange={(v) => patch(selected.id, { reportsToUserId: v || null })}
                allowClear
              />
              {!selected.isCompanyAdmin ? (
                <div className="flex flex-row gap-2">
                  <Button
                    title={selected.status === "inactive" ? "Reactivate" : "Deactivate"}
                    variant={selected.status === "inactive" ? "primary" : "outline"}
                    size="sm"
                    onPress={() => patch(selected.id, { status: selected.status === "inactive" ? "active" : "inactive" })}
                  />
                </div>
              ) : (
                <Banner tone="info">The company admin can't be deactivated.</Banner>
              )}
            </div>
          ) : null}
        </Sheet>
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
