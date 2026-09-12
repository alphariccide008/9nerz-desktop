import { useMemo } from "react";
import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useDB } from "../../lib/db/store";
import { listAllSubscriptions } from "../../lib/services/superAdmin";
import { shortDate } from "../../lib/util";

export default function SaSubscriptions() {
  const tick = useDB((db) => JSON.stringify(db.subscriptions));
  const rows = useMemo(() => listAllSubscriptions(), [tick]);

  return (
    <Screen maxWidth={720}>
      <PageHeader title="Subscriptions" subtitle="Tier and status per company." />
      <Card>
        {rows.map((s, i) => (
          <div key={s.id} className={`flex flex-row items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
            <div className="flex-1">
              <div className="text-[13px] text-ink">{s.companyName}</div>
              <Text variant="caption">
                {s.provider ?? "no provider"}
                {s.currentPeriodEnd ? ` · renews ${shortDate(s.currentPeriodEnd)}` : ""}
              </Text>
            </div>
            <Badge label={s.tier} className={s.tier === "paid" ? "bg-teal/15" : "bg-muted"} />
            <Badge label={s.status} className={s.status === "active" ? "bg-teal/15" : "bg-amber/20"} />
          </div>
        ))}
      </Card>
    </Screen>
  );
}
