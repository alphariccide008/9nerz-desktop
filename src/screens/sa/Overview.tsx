import { useMemo } from "react";
import { Activity, Building2, MessageSquare, TicketCheck, Users, Wallet } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { useDB } from "../../lib/db/store";
import { activityFeed, overview } from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function SaOverview() {
  const tick = useDB((db) => db.companies.length + db.users.length + db.auditLogs.length);
  const o = useMemo(() => overview(), [tick]);
  const feed = useMemo(() => activityFeed().slice(0, 12), [tick]);

  const stats = [
    { icon: Building2, label: "Companies", value: o.companies },
    { icon: Users, label: "Users", value: o.users },
    { icon: Wallet, label: "Paid", value: o.paidCompanies },
    { icon: Activity, label: "MRR (₦)", value: o.mrrNGN.toLocaleString() },
    { icon: TicketCheck, label: "Open tickets", value: o.openTickets },
    { icon: MessageSquare, label: "Open chats", value: o.openChats },
  ];

  return (
    <Screen maxWidth={760}>
      <PageHeader title="Overview" subtitle="Cross-company control plane." />
      <div className="flex flex-row flex-wrap gap-2.5">
        {stats.map((s) => (
          <Card key={s.label} className="min-w-[150px] flex-1 p-3">
            <div className="flex flex-row items-center gap-1.5">
              <s.icon size={14} color={colors.slate} />
              <Text variant="caption">{s.label}</Text>
            </div>
            <div className="mt-0.5 text-[20px] font-bold text-ink">{s.value}</div>
          </Card>
        ))}
      </div>

      <Text variant="heading">Recent activity</Text>
      <Card>
        {feed.map((f, i) => (
          <div key={f.id} className={`flex flex-row items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
            <div className="flex-1">
              <div className="text-[13px] capitalize text-ink">{f.actionType.replace(/_/g, " ")}</div>
              <Text variant="caption">
                {f.companyName} · {f.actorName}
              </Text>
            </div>
            <Text variant="caption">{relativeTime(f.createdAt)}</Text>
          </div>
        ))}
      </Card>
    </Screen>
  );
}
