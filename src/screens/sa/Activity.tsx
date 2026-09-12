import { useMemo } from "react";
import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { useDB } from "../../lib/db/store";
import { activityFeed } from "../../lib/services/superAdmin";
import { relativeTime } from "../../lib/util";

export default function SaActivity() {
  const tick = useDB((db) => db.auditLogs.length);
  const feed = useMemo(() => activityFeed(), [tick]);

  return (
    <Screen maxWidth={720}>
      <PageHeader title="Activity" subtitle="Live cross-company action feed." />
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
