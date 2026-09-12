import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";

import { Screen, PageHeader } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { EmptyState } from "../components/ui/Feedback";
import { useCurrentUser } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import { listNotifications, markAllRead, markRead } from "../lib/services/notifications";
import { relativeTime } from "../lib/util";
import { colors } from "../lib/theme";
import { cn } from "../lib/cn";

export default function Notifications() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadOnly = filter === "unread";
  const tick = useDB((db) => db.notifications.map((n) => `${n.id}${n.isRead}`).join(","));
  const all = useMemo(() => (me ? listNotifications(me.id) : []), [me, tick]);
  const items = useMemo(() => (me ? listNotifications(me.id, { unreadOnly }) : []), [me, tick, unreadOnly]);
  const unread = all.filter((n) => !n.isRead).length;

  if (!me) return null;

  const open = (n: (typeof items)[number]) => {
    if (!n.isRead) markRead(n.id);
    if (n.entityType === "task" && n.entityId) navigate(`/tasks/${n.entityId}`);
    else if (n.entityType === "ticket" && n.entityId) navigate(`/tickets/${n.entityId}`);
  };

  return (
    <Screen maxWidth={640}>
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "All caught up."}
        right={unread > 0 ? <Button title="Mark all read" size="sm" variant="outline" icon={<CheckCheck size={14} color={colors.ink} />} onPress={() => markAllRead(me.id)} /> : undefined}
      />

      <Segmented
        options={[
          { value: "all", label: "All" },
          { value: "unread", label: "Unread", badge: unread || undefined },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {items.length === 0 ? (
        <EmptyState icon={<Bell size={22} color={colors.slate} />} title={unreadOnly ? "No unread notifications" : "No notifications yet"} />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <button key={n.id} type="button" onClick={() => open(n)} className="text-left">
              <Card className={cn("p-3", !n.isRead && "border-l-2 border-l-ink bg-ink/[0.03]")}>
                <div className="flex flex-row items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", !n.isRead ? "bg-ink" : "bg-transparent")} />
                  <span className={cn("flex-1 text-[13px]", !n.isRead ? "font-medium text-ink" : "text-slate")}>{n.title}</span>
                  <Text variant="caption">{relativeTime(n.createdAt)}</Text>
                </div>
                <Text variant="caption" className="ml-4 mt-0.5 block leading-4">
                  {n.message}
                </Text>
              </Card>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
