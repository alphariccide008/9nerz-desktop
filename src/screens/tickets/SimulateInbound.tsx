import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailPlus } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Input, Textarea } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Banner } from "../../components/ui/Feedback";
import { Text } from "../../components/ui/Text";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { listInboxes, listRoutingRules, simulateInbound } from "../../lib/services/tickets";
import { useToast } from "../../components/ui/Toast";
import { colors } from "../../lib/theme";

export default function SimulateInbound() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [inbox, setInbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inboxes = useDB(() => (me ? listInboxes(me.companyId) : []));
  const rules = useDB(() => (me ? listRoutingRules(me.companyId) : []));

  if (!me) return null;

  const send = () => {
    if (!from.trim() || !subject.trim()) return toast.show("From and subject are required", "error");
    setBusy(true);
    try {
      const res = simulateInbound(me.companyId, {
        fromEmail: from,
        fromName: name,
        subject,
        body: body || "(no body)",
        inboxAddress: inbox ?? inboxes.find((i) => i.isDefault)?.address,
      });
      toast.show(res.routedTo ? `Routed to ${res.routedTo}` : "Landed in Unrouted", "success");
      navigate(`/tickets/${res.ticketId}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={620}>
      <PageHeader title="Simulate inbound email" subtitle="Runs the same routing engine a real inbound-mail webhook would." />

      <Banner tone="info">
        <Text variant="caption">
          Active rules: {rules.length === 0 ? "none — everything goes to Unrouted" : rules.map((r) => `${r.subjectPattern ? `"${r.subjectPattern}"` : "any"} → ${r.orgUnitName}`).join("  ·  ")}
        </Text>
      </Banner>

      <Input label="From email" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="customer@example.com" />
      <Input label="From name (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
      {inboxes.length > 1 ? <Select label="To inbox" value={inbox} options={inboxes.map((i) => ({ value: i.address, label: i.address }))} onChange={setInbox} /> : null}
      <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Refund request — order #123" />
      <Textarea label="Body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="The message body…" />
      <Button title="Deliver email" onPress={send} loading={busy} fullWidth icon={<MailPlus size={15} color={colors.white} />} />
    </Screen>
  );
}
