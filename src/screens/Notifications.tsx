import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";

import { Screen, PageHeader } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Feedback";
import { useCurrentUser } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import { listNotifications, markAllRead, markRead } from "../lib/services/notifications";
import { relativeTime } from "../lib/util";
import { colors } from "../lib/theme";
import { cn } from "../lib/cn";

/** Mirrors the real web app's TYPE_TAG/tagFor (components/views/notifications-view.tsx) — a small
 *  colored chip keyed off entityType, falling back to a prefix match on the notification's `type`. */
const TYPE_TAG: Record<string, { label: string; className: string }> = {
  task: { label: "Task", className: "bg-[#eef1ff] text-[#3a49a6]" },
  ticket: { label: "Ticket", className: "bg-[#e7f4f0] text-[#1f7a66]" },
  company: { label: "Billing", className: "bg-[#fdf1e3] text-[#a9691f]" },
};
function tagFor(n: { entityType: string | null; type: string }) {
  if (n.entityType && TYPE_TAG[n.entityType]) return TYPE_TAG[n.entityType];
  if (n.type.startsWith("task")) return TYPE_TAG.task;
  if (n.type.startsWith("ticket")) return TYPE_TAG.ticket;
  if (n.type.startsWith("trial") || n.type.startsWith("billing")) return TYPE_TAG.company;
  return null;
}

export default function Notifications() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const tick = useDB((db) => db.notifications.map((n) => `${n.id}${n.isRead}`).join(","));
  const items = useMemo(() => (me ? listNotifications(me.id) : []), [me, tick]);
  const unread = items.filter((n) => !n.isRead).length;

  if (!me) return null;

  const open = (n: (typeof items)[number]) => {
    if (!n.isRead) markRead(n.id);
    if (n.entityType === "task" && n.entityId) navigate(`/tasks/${n.entityId}`);
    else if (n.entityType === "ticket" && n.entityId) navigate(`/tickets/${n.entityId}`);
    else if (n.entityType === "company") navigate("/billing");
  };

  return (
    <Screen maxWidth={860}>
      <PageHeader
        title={
          <>
            <Bell size={18} /> Notifications
          </>
        }
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up."}
        right={
          unread > 0 ? (
            <Button title="Mark all read" size="sm" variant="outline" icon={<CheckCheck size={14} color={colors.ink} />} onPress={() => markAllRead(me.id)} />
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={<Bell size={22} color={colors.slate} />} title="No notifications yet." />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-col divide-y divide-hairline/60">
            {items.map((n) => {
              const tag = tagFor(n);
              const clickable = ((n.entityType === "task" || n.entityType === "ticket") && !!n.entityId) || n.entityType === "company";
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => open(n)}
                  disabled={!clickable}
                  className={cn("flex flex-row items-start gap-3 px-4 py-3 text-left transition-colors", clickable ? "hover:bg-muted/60" : "cursor-default", !n.isRead && "bg-amber/[0.06]")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", !n.isRead ? "bg-amber" : "bg-transparent")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={cn("text-[13px]", !n.isRead ? "font-semibold text-ink" : "text-slate")}>{n.title}</span>
                      {tag ? <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", tag.className)}>{tag.label}</span> : null}
                      <Text variant="caption">{relativeTime(n.createdAt)}</Text>
                    </div>
                    {n.message ? (
                      <Text variant="caption" className="mt-0.5 block line-clamp-2 leading-4">
                        {n.message}
                      </Text>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </Screen>
  );
}
