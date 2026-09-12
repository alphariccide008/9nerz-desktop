import { useMemo } from "react";
import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useDB } from "../../lib/db/store";
import { listAllPayments } from "../../lib/services/superAdmin";
import { shortDate } from "../../lib/util";

export default function SaPayments() {
  const tick = useDB((db) => db.payments.length);
  const rows = useMemo(() => listAllPayments(), [tick]);

  return (
    <Screen maxWidth={720}>
      <PageHeader title="Payments" subtitle="Every payment across the platform." />
      <Card>
        {rows.map((p, i) => (
          <div key={p.id} className={`flex flex-row items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
            <div className="flex-1">
              <div className="text-[13px] text-ink">
                {p.currency} {(p.amount / 100).toLocaleString()}
              </div>
              <Text variant="caption">
                {p.companyName} · {p.provider} · {p.reference}
              </Text>
            </div>
            <Badge label={p.status} className={p.status === "success" ? "bg-teal/15" : p.status === "pending" ? "bg-amber/20" : "bg-destructive/15"} />
            <Text variant="caption">{shortDate(p.createdAt)}</Text>
          </div>
        ))}
      </Card>
    </Screen>
  );
}
