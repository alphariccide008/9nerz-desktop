/** Notification service — mirror of app/api/notifications/*. */

import { getDB, mutate } from "../db/store";
import { nowISO } from "../util";

export function listNotifications(userId: string, opts?: { unreadOnly?: boolean }) {
  return getDB()
    .notifications.filter((n) => n.userId === userId && (!opts?.unreadOnly || !n.isRead))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadCount(userId: string): number {
  return getDB().notifications.filter((n) => n.userId === userId && !n.isRead).length;
}

export function markRead(notifId: string): void {
  mutate((d) => {
    d.notifications = d.notifications.map((n) => (n.id === notifId ? { ...n, isRead: true, readAt: nowISO() } : n));
  });
}

export function markAllRead(userId: string): void {
  mutate((d) => {
    d.notifications = d.notifications.map((n) =>
      n.userId === userId && !n.isRead ? { ...n, isRead: true, readAt: nowISO() } : n,
    );
  });
}
