/** Notification service — mirror of app/api/notifications/*. */

import { getDB, mutate } from "../db/store";
import { nowISO } from "../util";
import { apiRequest } from "../api/http";
import { getSession, getAccessToken } from "../session";

export function listNotifications(userId: string, opts?: { unreadOnly?: boolean }) {
  return getDB()
    .notifications.filter((n) => n.userId === userId && (!opts?.unreadOnly || !n.isRead))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export function unreadCount(userId: string): number {
  return getDB().notifications.filter((n) => n.userId === userId && !n.isRead).length;
}

export function markRead(notifId: string): void {
  mutate((d) => {
    d.notifications = d.notifications.map((n) => (n.id === notifId ? { ...n, isRead: true, readAt: nowISO() } : n));
  });
  const real = getSession().real;
  if (real) apiRequest("PATCH", `/api/notifications/${notifId}/read`, undefined, getAccessToken()).catch(() => {});
}

export function markAllRead(userId: string): void {
  mutate((d) => {
    d.notifications = d.notifications.map((n) =>
      n.userId === userId && !n.isRead ? { ...n, isRead: true, readAt: nowISO() } : n,
    );
  });
  const real = getSession().real;
  if (real) apiRequest("PATCH", "/api/notifications/read-all", undefined, getAccessToken()).catch(() => {});
}

// ── Real sync — pulls the signed-in user's notifications from the real
//    backend into the same local `db.notifications` array the functions
//    above already read, so the bell, the badge and this page all light up
//    with real data without any screen-level changes. ─────────────────────

// The route applies toCamel() to its Supabase rows before responding, so this
// is camelCase — unlike the billing/tasks/tickets routes read elsewhere in
// this codebase, which return raw snake_case columns.
type RealNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

let inFlight: Promise<void> | null = null;

export function syncRealNotifications(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<void> {
  const real = getSession().real;
  if (!real) return;
  const userId = real.user.id;
  const companyId = real.user.companyId;
  try {
    const data = await apiRequest<{ notifications: RealNotification[] }>("GET", "/api/notifications", undefined, getAccessToken());
    mutate((d) => {
      const mapped = (data.notifications ?? []).map((n) => ({
        id: n.id,
        companyId,
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        isRead: n.isRead,
        readAt: n.readAt,
        metadata: n.metadata,
        createdAt: n.createdAt,
      }));
      const others = d.notifications.filter((n) => n.userId !== userId);
      d.notifications = [...others, ...mapped];
    });
  } catch {
    // offline / transient — keep whatever was last synced
  }
}
