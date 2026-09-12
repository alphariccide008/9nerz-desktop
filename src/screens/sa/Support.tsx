import { useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, Mail, MailPlus } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Sheet } from "../../components/ui/Sheet";
import { Segmented } from "../../components/ui/Segmented";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/Toast";
import { useDB } from "../../lib/db/store";
import { listPlatformTickets, listSupportEscalations, resolvePlatformTicket, resolveSupportEscalation, simulatePlatformInbound } from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function SaSupport() {
  const toast = useToast();
  const [tab, setTab] = useState<"escalations" | "mailbox">("escalations");
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open");
  const [simOpen, setSimOpen] = useState(false);
  const [sim, setSim] = useState({ fromEmail: "", fromName: "", subject: "", body: "" });
  const tick = useDB((db) => db.supportEscalations.length + db.platformTickets.length + db.supportEscalations.map((e) => e.status).join(""));

  const escalations = useMemo(() => listSupportEscalations(statusFilter), [tick, statusFilter]);
  const mailbox = useMemo(() => listPlatformTickets(statusFilter), [tick, statusFilter]);

  return (
    <Screen maxWidth={720}>
      <PageHeader
        title="Support"
        subtitle="Questions the in-app assistant couldn't answer, plus support@9nerz.app."
        right={tab === "mailbox" ? <Button title="Simulate inbound" size="sm" variant="outline" icon={<MailPlus size={14} color={colors.ink} />} onPress={() => setSimOpen(true)} /> : undefined}
      />

      <Segmented
        options={[
          { value: "escalations", label: "Assistant escalations", badge: escalations.filter((e) => e.status === "open").length || undefined },
          { value: "mailbox", label: "Platform mailbox", badge: mailbox.filter((t) => t.status === "open").length || undefined },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Segmented
        options={[
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" },
        ]}
        value={statusFilter}
        onChange={setStatusFilter}
      />

      {tab === "escalations" ? (
        escalations.length === 0 ? (
          <EmptyState icon={<HelpCircle size={22} color={colors.slate} />} title="Nothing here" />
        ) : (
          <Card>
            {escalations.map((e, i) => (
              <div key={e.id} className={`flex flex-col gap-1.5 px-4 py-3 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
                <div className="flex flex-row items-center justify-between">
                  <span className="flex-1 text-[13px] font-medium text-ink">{e.question}</span>
                  <Text variant="caption">{relativeTime(e.createdAt)}</Text>
                </div>
                <Text variant="caption">{e.companyName ?? "—"}</Text>
                {e.status === "open" ? (
                  <Button
                    title="Mark resolved"
                    size="sm"
                    variant="outline"
                    icon={<CheckCircle2 size={13} color={colors.ink} />}
                    onPress={() => {
                      resolveSupportEscalation(e.id);
                      toast.show("Resolved", "success");
                    }}
                  />
                ) : (
                  <Badge label="resolved" className="self-start bg-teal/15" />
                )}
              </div>
            ))}
          </Card>
        )
      ) : mailbox.length === 0 ? (
        <EmptyState icon={<Mail size={22} color={colors.slate} />} title="Nothing here" />
      ) : (
        <Card>
          {mailbox.map((t, i) => (
            <div key={t.id} className={`flex flex-col gap-1.5 px-4 py-3 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
              <div className="flex flex-row items-center justify-between">
                <span className="flex-1 truncate text-[13px] font-medium text-ink">{t.subject}</span>
                <Text variant="caption">{relativeTime(t.createdAt)}</Text>
              </div>
              <Text variant="caption">
                {t.fromName ? `${t.fromName} · ` : ""}
                {t.fromEmail}
              </Text>
              <div className="text-[13px] text-ink">{t.body}</div>
              {t.status === "open" ? (
                <Button
                  title="Mark resolved"
                  size="sm"
                  variant="outline"
                  icon={<CheckCircle2 size={13} color={colors.ink} />}
                  onPress={() => {
                    resolvePlatformTicket(t.id);
                    toast.show("Resolved", "success");
                  }}
                />
              ) : (
                <Badge label="resolved" className="self-start bg-teal/15" />
              )}
            </div>
          ))}
        </Card>
      )}

      <Sheet
        visible={simOpen}
        onClose={() => setSimOpen(false)}
        title="Simulate an inbound email"
        footer={
          <Button
            title="Send"
            fullWidth
            disabled={!sim.fromEmail.trim() || !sim.subject.trim()}
            onPress={() => {
              simulatePlatformInbound(sim);
              setSim({ fromEmail: "", fromName: "", subject: "", body: "" });
              setSimOpen(false);
              toast.show("Delivered to the platform mailbox", "success");
            }}
          />
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="From email" value={sim.fromEmail} onChange={(e) => setSim((s) => ({ ...s, fromEmail: e.target.value }))} />
          <Input label="From name (optional)" value={sim.fromName} onChange={(e) => setSim((s) => ({ ...s, fromName: e.target.value }))} />
          <Input label="Subject" value={sim.subject} onChange={(e) => setSim((s) => ({ ...s, subject: e.target.value }))} />
          <Input label="Body" value={sim.body} onChange={(e) => setSim((s) => ({ ...s, body: e.target.value }))} />
        </div>
      </Sheet>
    </Screen>
  );
}
