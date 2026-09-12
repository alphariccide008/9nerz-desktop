import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Loading } from "../../components/ui/Feedback";
import { KeyValueList, KeyValueRow } from "../../components/ui/KeyValue";
import { useDB } from "../../lib/db/store";
import { userDetail } from "../../lib/services/superAdmin";
import { fullName, relativeTime, shortDate } from "../../lib/util";

export default function SaUserDetail() {
  const { id } = useParams<{ id: string }>();
  const tick = useDB((db) => JSON.stringify(db.users.find((u) => u.id === id)));
  const data = useMemo(() => {
    try {
      return id ? userDetail(id) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  if (!data) return (
    <Screen>
      <Loading />
    </Screen>
  );
  const { user, company, role, assignedTasks, recentActivity } = data;

  return (
    <Screen maxWidth={620}>
      <PageHeader title={fullName(user)} subtitle={user.email} />
      <div className="flex flex-row gap-2">
        <Badge label={user.status} className={user.status === "active" ? "bg-teal/15" : "bg-muted"} />
        {user.isCompanyAdmin ? <Badge label="admin" className="bg-ink" textClassName="text-white" /> : null}
      </div>
      <KeyValueList>
        <KeyValueRow label="Company" value={company?.name ?? "—"} />
        <KeyValueRow label="Role" value={role ?? "—"} />
        <KeyValueRow label="Assigned tasks" value={assignedTasks} />
        <KeyValueRow label="Email verified" value={user.isEmailVerified ? "Yes" : "No"} />
        <KeyValueRow label="Last active" value={user.lastActiveAt ? relativeTime(user.lastActiveAt) : "—"} />
        <KeyValueRow label="Joined" value={shortDate(user.createdAt)} last />
      </KeyValueList>
      <Text variant="heading">Recent activity</Text>
      <Card>
        {recentActivity.length === 0 ? (
          <Text variant="caption" className="block p-4 text-center">
            No recorded activity.
          </Text>
        ) : (
          recentActivity.map((a, i) => (
            <div key={a.id} className={`flex flex-row items-center gap-3 px-4 py-2 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
              <span className="flex-1 truncate text-[12px] capitalize text-ink">{a.actionType.replace(/_/g, " ")}</span>
              <Text variant="caption">{relativeTime(a.createdAt)}</Text>
            </div>
          ))
        )}
      </Card>
    </Screen>
  );
}
