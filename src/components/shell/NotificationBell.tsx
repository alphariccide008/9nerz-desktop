import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useSession } from "../../lib/session";
import { useDB } from "../../lib/db/store";
import { listNotifications, markAllRead, markRead } from "../../lib/services/notifications";

/** Ported from the real web app's components/top-nav.tsx notification bell —
 *  fixed-position dropdown showing the newest few notifications, present on
 *  every screen. Reads the same local notification store Notifications.tsx
 *  uses (real-account notification sync isn't wired yet, a known gap). */

const SHOWN = 4;

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { userId } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const tick = useDB((db) => db.notifications.map((n) => `${n.id}${n.isRead}`).join(","));
  const notifs = useMemo(() => (userId ? listNotifications(userId) : []), [userId, tick]);
  const unread = notifs.filter((n) => !n.isRead).length;
  const shown = notifs.slice(0, SHOWN);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const hrefFor = (n: (typeof notifs)[number]) => {
    if (n.entityType === "task" && n.entityId) return `/tasks/${n.entityId}`;
    if (n.entityType === "ticket" && n.entityId) return `/tickets/${n.entityId}`;
    if (n.entityType === "company") return "/billing";
    return "/notifications";
  };

  const open_ = (n: (typeof notifs)[number]) => {
    if (!n.isRead) markRead(n.id);
    setOpen(false);
    navigate(hrefFor(n));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-ink"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-0.5 text-[10px] font-bold text-ink ring-2 ring-card">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-hairline bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">Notifications{unread > 0 ? ` · ${unread} new` : ""}</span>
            {unread > 0 && userId && (
              <button onClick={() => markAllRead(userId)} className="text-xs text-ink hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {shown.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
            ) : (
              shown.map((n) => (
                <button
                  key={n.id}
                  onClick={() => open_(n)}
                  className={`flex w-full items-start gap-3 border-b border-hairline/50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50 ${!n.isRead ? "bg-ink/[0.03]" : ""}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.isRead ? "bg-ink" : "bg-transparent"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-medium ${!n.isRead ? "text-ink" : "text-muted-foreground"}`}>{n.title}</p>
                    {n.message && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{n.message}</p>}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{formatTime(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-hairline px-4 py-2">
            <button
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
              className="block w-full text-center text-xs font-medium text-ink hover:underline"
            >
              See all notifications{notifs.length > SHOWN ? ` (${notifs.length})` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
