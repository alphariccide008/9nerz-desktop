import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Mail } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Segmented } from "../../components/ui/Segmented";
import { StatusPill } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/Feedback";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { escalateOverdueTickets, listTickets, TicketQueue } from "../../lib/services/tickets";
import { shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

const TABS: { value: TicketQueue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Assigned to me" },
  { value: "unrouted", label: "Unrouted" },
];

export default function TicketsIndex() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TicketQueue>("all");
  const tick = useDB((db) => db.tickets.map((t) => t.updatedAt).join(","));
  const tickets = useMemo(() => (me ? listTickets(me.id, tab) : []), [me, tab, tick]);

  useEffect(() => {
    if (me) escalateOverdueTickets(me.companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.companyId]);

  if (!me) return null;

  return (
    <Screen maxWidth={760}>
      <PageHeader title="Tickets" subtitle="Support email, routed to the right queue." />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tickets.length === 0 ? (
        <EmptyState icon={<Mail size={22} color={colors.slate} />} title="No tickets in this view" />
      ) : (
        <Card>
          {tickets.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/tickets/${t.id}`)}
              className={`flex w-full flex-row items-center gap-3 px-4 py-3 text-left ${i > 0 ? "border-t border-hairline/60" : ""}`}
            >
              <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.awaitingResponse ? colors.amber : "transparent" }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-row items-center gap-1.5">
                  {t.ref ? <span className="text-[10px] font-bold tracking-[0.3px] text-slate">{t.ref}</span> : null}
                  <span className="flex-1 truncate text-[13px] font-medium text-ink">{t.subject}</span>
                </div>
                <Text variant="caption" className="block truncate">
                  {t.requesterName || t.requesterEmail}
                  {t.orgUnit ? ` · ${t.orgUnit.name}` : " · Unrouted"}
                  {t.assignee ? ` · ${t.assignee.firstName} ${t.assignee.lastName}` : ""}
                </Text>
              </div>
              <Text variant="caption" className="shrink-0">
                {shortDate(t.lastMessageAt)}
              </Text>
              <StatusPill status={t.status} />
              <ChevronRight size={14} color={colors.mutedForeground} />
            </button>
          ))}
        </Card>
      )}
    </Screen>
  );
}
