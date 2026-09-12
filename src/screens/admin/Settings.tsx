import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Download, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Sheet } from "../../components/ui/Sheet";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { deleteOrgSelfService, exportOrgData, getPolicy, updatePolicy } from "../../lib/services/org";
import { logout } from "../../lib/services/auth";
import { ApprovalAction, PermissionPolicy } from "../../lib/db/schema";
import { colors } from "../../lib/theme";

const RADIO_FIELDS: { key: keyof PermissionPolicy; label: string; options: [string, string][] }[] = [
  {
    key: "inviteScope",
    label: "Who can a non-admin invite into?",
    options: [
      ["own_unit", "Only their own unit"],
      ["own_unit_and_subunits", "Their unit and everything under it"],
      ["company_wide", "Anywhere in the company"],
    ],
  },
  {
    key: "inviteRankCeiling",
    label: "How senior a person can they invite?",
    options: [
      ["below_own", "Strictly below their own rank"],
      ["up_to_own", "Up to and including their own rank"],
    ],
  },
  {
    key: "reportingChangeScope",
    label: "Who can change reporting lines?",
    options: [
      ["own_unit", "Managers, within their own unit"],
      ["own_unit_and_subunits", "Managers, within their unit + sub-units"],
      ["cross_unit", "Senior people, across units"],
      ["admin_only", "Admins only"],
    ],
  },
];

const APPROVALS: [ApprovalAction, string][] = [
  ["unit_creation", "Creating a new unit"],
  ["cross_unit_move", "Moving someone across units"],
  ["role_rank_change", "Changing a role's rank"],
];

export default function AdminSettings() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const tick = useDB((db) => JSON.stringify(db.permissionPolicies.find((p) => p.companyId === me?.companyId)));
  const companyName = useDB((db) => db.companies.find((c) => c.id === me?.companyId)?.name ?? "");
  const policy = useMemo(() => (me ? getPolicy(me.companyId) : null), [me, tick]);
  const [slaText, setSlaText] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  if (!me || !policy) return null;

  const save = (patch: Partial<PermissionPolicy>) => {
    try {
      updatePolicy(me.id, patch);
      toast.show("Saved", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const slaValue = slaText ?? (policy.slaHours != null ? String(policy.slaHours) : "");

  const exportData = async () => {
    try {
      const data = exportOrgData(me.id, me.companyId);
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.show("Copied full data export to clipboard", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const deleteOrg = () => {
    try {
      deleteOrgSelfService(me.id, me.companyId, confirmName);
      setDeleteOpen(false);
      logout().then(() => navigate("/welcome", { replace: true }));
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <AdminGuard>
      <Screen maxWidth={620}>
        <PageHeader title="Permission policy" subtitle="These rules decide what managers can do without an admin. Admins always bypass them." />

        {RADIO_FIELDS.map((f) => (
          <Card key={f.key} className="flex flex-col gap-2 p-4">
            <Text variant="heading">{f.label}</Text>
            {f.options.map(([v, label]) => {
              const active = (policy as unknown as Record<string, unknown>)[f.key] === v;
              return (
                <button key={v} type="button" onClick={() => save({ [f.key]: v } as Partial<PermissionPolicy>)} className="flex flex-row items-center gap-2.5 py-1 text-left">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${active ? "border-ink bg-ink" : "border-hairline"}`}>{active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}</span>
                  <span className="text-[13px] text-ink">{label}</span>
                </button>
              );
            })}
          </Card>
        ))}

        <Card className="flex flex-col gap-2 p-4">
          <Text variant="heading">Which actions need admin approval first?</Text>
          {APPROVALS.map(([v, label]) => {
            const on = policy.approvalRequiredFor.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => save({ approvalRequiredFor: on ? policy.approvalRequiredFor.filter((x) => x !== v) : [...policy.approvalRequiredFor, v] })}
                className="flex flex-row items-center gap-2.5 py-1 text-left"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-ink bg-ink" : "border-hairline"}`}>{on ? <Check size={11} color="#fff" /> : null}</span>
                <span className="text-[13px] text-ink">{label}</span>
              </button>
            );
          })}
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <Text variant="heading">Ticket SLA</Text>
          <Text variant="caption">Hours an open ticket can go without a reply before it's auto-escalated up the assignee's manager chain. Leave blank to disable escalation.</Text>
          <Input
            placeholder="e.g. 24"
            value={slaValue}
            onChange={(e) => setSlaText(e.target.value)}
            onBlur={() => {
              const n = slaValue.trim() ? Number(slaValue) : null;
              save({ slaHours: n && n > 0 ? Math.round(n) : null });
              setSlaText(null);
            }}
          />
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <Text variant="heading">Your data</Text>
          <Text variant="caption">Export everything this workspace has stored, or permanently delete it.</Text>
          <Button title="Export all data (JSON)" variant="outline" icon={<Download size={14} color={colors.ink} />} onPress={exportData} />
        </Card>

        <Card className="flex flex-col gap-2 border-destructive/30 p-4">
          <Text variant="heading" className="text-destructive">
            Danger zone
          </Text>
          <Text variant="caption">Permanently delete this workspace — every unit, member, task and ticket. This can't be undone.</Text>
          <Button
            title="Delete workspace"
            variant="outline"
            icon={<Trash2 size={14} color={colors.destructive} />}
            onPress={() => {
              setConfirmName("");
              setDeleteOpen(true);
            }}
          />
        </Card>
      </Screen>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this workspace?" footer={<Button title="Permanently delete" fullWidth onPress={deleteOrg} disabled={confirmName.trim() !== companyName} />}>
        <div className="flex flex-col gap-3">
          <Text variant="caption">
            Type <span className="font-semibold text-ink">{companyName}</span> to confirm. This deletes every unit, member, task and ticket immediately and can't be undone.
          </Text>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={companyName} />
        </div>
      </Sheet>
    </AdminGuard>
  );
}
