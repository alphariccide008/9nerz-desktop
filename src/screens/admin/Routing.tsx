import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Copy, Mail, MailPlus, Plus, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Sheet } from "../../components/ui/Sheet";
import { Banner } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { MailboxConnect } from "../../components/admin/MailboxConnect";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { addInbox, addRoutingRule, deleteRoutingRule, listInboxes, listRoutingRules } from "../../lib/services/tickets";
import { listUnits } from "../../lib/services/org";
import { confirmAction } from "../../lib/confirm";
import { colors } from "../../lib/theme";

export default function Routing() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const tick = useDB((db) => db.ticketInboxes.length + db.ticketRoutingRules.length);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxLabel, setInboxLabel] = useState("");
  const [subject, setSubject] = useState("");
  const [ruleUnit, setRuleUnit] = useState<string | null>(null);
  const [ruleInbox, setRuleInbox] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (address: string) => {
    navigator.clipboard?.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 1500);
  };

  const inboxes = useMemo(() => (me ? listInboxes(me.companyId) : []), [me, tick]);
  const rules = useMemo(() => (me ? listRoutingRules(me.companyId) : []), [me, tick]);
  const units = useMemo(() => (me ? listUnits(me.companyId).units : []), [me, tick]);

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
        <PageHeader
          title="Email routing"
          subtitle="Inbound addresses and the rules that sort mail into queues."
          right={<Button title="Simulate inbound" size="sm" variant="outline" icon={<MailPlus size={14} color={colors.ink} />} onPress={() => navigate("/tickets/simulate-inbound")} />}
        />

        <MailboxConnect companyId={me.companyId} actorId={me.id} units={units} />

        <Text variant="caption" className="pt-1 font-semibold uppercase tracking-wide text-muted-foreground">
          …or use a 9nerz-hosted address
        </Text>

        <div>
          <div className="mb-2 flex flex-row items-center justify-between">
            <Text variant="heading">Inboxes</Text>
            <Button title="Add" size="sm" variant="outline" icon={<Plus size={13} color={colors.ink} />} onPress={() => setInboxOpen(true)} />
          </div>
          <Card>
            {inboxes.map((i, n) => (
              <div key={i.id} className={`flex flex-row items-center gap-2 px-4 py-3 ${n > 0 ? "border-t border-hairline/60" : ""}`}>
                <Mail size={14} color={colors.slate} />
                <code className="flex-1 truncate text-[13px] text-ink">{i.address}</code>
                {i.isDefault ? <Text variant="caption">default</Text> : null}
                <button type="button" onClick={() => copy(i.address)} className="shrink-0 rounded p-1 text-slate hover:bg-background" title="Copy address">
                  {copied === i.address ? <Check size={14} color={colors.teal} /> : <Copy size={14} />}
                </button>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <div className="mb-2 flex flex-row items-center justify-between">
            <Text variant="heading">Routing rules</Text>
            <Button title="Add rule" size="sm" icon={<Plus size={13} color={colors.white} />} onPress={() => setRuleOpen(true)} />
          </div>
          <Card>
            {rules.length === 0 ? (
              <Text variant="caption" className="block p-4 text-center">
                No rules — everything goes to the Unrouted queue.
              </Text>
            ) : (
              rules.map((r, n) => (
                <div key={r.id} className={`flex flex-row items-center gap-2 px-4 py-3 ${n > 0 ? "border-t border-hairline/60" : ""}`}>
                  <Text variant="caption" className="w-5 tabular-nums">
                    {r.priority}
                  </Text>
                  <span className="text-[13px] text-ink">{r.subjectPattern ? `subject ~ "${r.subjectPattern}"` : "any subject"}</span>
                  <ArrowRight size={13} color={colors.slate} />
                  <span className="text-[13px] font-medium text-ink">{r.orgUnitName}</span>
                  <button type="button" className="ml-auto p-1" onClick={() => confirmAction("Delete this?", "", () => wrap(() => deleteRoutingRule(me.id, r.id), "Deleted"), "Delete", true)}>
                    <Trash2 size={13} color={colors.destructive} />
                  </button>
                </div>
              ))
            )}
          </Card>
        </div>

        <Sheet
          visible={inboxOpen}
          onClose={() => setInboxOpen(false)}
          title="Add inbound address"
          footer={
            <Button
              title="Add inbox"
              fullWidth
              disabled={!inboxLabel.trim()}
              onPress={() =>
                wrap(() => {
                  addInbox(me.id, me.companyId, inboxLabel);
                  setInboxLabel("");
                  setInboxOpen(false);
                }, "Inbox added")
              }
            />
          }
        >
          <Input label="Label" value={inboxLabel} onChange={(e) => setInboxLabel(e.target.value)} placeholder="e.g. Billing" autoFocus />
          <Banner tone="info" className="mt-2">
            <Text variant="caption">Free tier includes one address. Paid tiers get multiple + custom domain.</Text>
          </Banner>
        </Sheet>

        <Sheet
          visible={ruleOpen}
          onClose={() => setRuleOpen(false)}
          title="New routing rule"
          footer={
            <Button
              title="Create rule"
              fullWidth
              disabled={!ruleUnit}
              onPress={() =>
                wrap(() => {
                  addRoutingRule(me.id, me.companyId, { inboxId: ruleInbox, subjectPattern: subject || null, orgUnitId: ruleUnit! });
                  setSubject("");
                  setRuleUnit(null);
                  setRuleOpen(false);
                }, "Rule created")
              }
            />
          }
        >
          <div className="flex flex-col gap-3">
            <Select label="Inbox (optional)" value={ruleInbox} options={inboxes.map((i) => ({ value: i.id, label: i.address }))} onChange={setRuleInbox} allowClear placeholder="Any inbox" />
            <Input label="Subject contains (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. refund" />
            <Select label="Route to unit" value={ruleUnit} options={units.map((u) => ({ value: u.id, label: u.name }))} onChange={setRuleUnit} />
          </div>
        </Sheet>
      </Screen>
    </AdminGuard>
  );
}
