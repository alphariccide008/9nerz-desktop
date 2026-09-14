/** Audit service — mirror of app/api/audit and app/api/org/audit. */

import { getDB } from "../db/store";
import { fullName } from "../util";
import { apiRequest } from "../api/http";
import { getSession, getAccessToken } from "../session";

export interface AuditView {
  id: string;
  actionType: string;
  actorName: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  isFlagged: boolean;
  flagReason: string | null;
}

export function listAudit(
  companyId: string,
  filter?: { actionType?: string; entityType?: string; entityId?: string; flaggedOnly?: boolean },
): AuditView[] {
  const db = getDB();
  return db.auditLogs
    .filter((a) => a.companyId === companyId)
    .filter((a) => !filter?.actionType || a.actionType === filter.actionType)
    .filter((a) => !filter?.entityType || a.entityType === filter.entityType)
    .filter((a) => !filter?.entityId || a.entityId === filter.entityId)
    .filter((a) => !filter?.flaggedOnly || a.isFlagged)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => {
      const actor = a.actorId ? db.users.find((u) => u.id === a.actorId) : undefined;
      const sa = a.actorId ? db.superAdmins.find((s) => s.id === a.actorId) : undefined;
      return {
        id: a.id,
        actionType: a.actionType,
        actorName: actor ? fullName(actor) : sa ? `${sa.firstName} ${sa.lastName}` : a.actorType === "system" ? "System" : "Unknown",
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
        isFlagged: a.isFlagged,
        flagReason: a.flagReason,
      };
    });
}

export function auditActionTypes(companyId: string): string[] {
  return [...new Set(getDB().auditLogs.filter((a) => a.companyId === companyId).map((a) => a.actionType))].sort();
}

/** Task history for the task detail view (audit filtered to one task). */
export function taskAudit(taskId: string): AuditView[] {
  const db = getDB();
  const companyId = db.tasks.find((t) => t.id === taskId)?.companyId;
  if (!companyId) return [];
  return listAudit(companyId, { entityType: "task", entityId: taskId }).reverse();
}

type RealAuditEntry = { id: string; action_type: string; entity_type: string | null; actor_name: string; is_flagged: boolean; created_at: string };

/** Real accounts read GET /api/org/audit directly — admin-only, company-scoped,
 *  already sorted newest-first server-side. Not synced into the local mock
 *  audit table since nothing else in the app reads audit data cross-screen. */
export async function fetchRealAudit(): Promise<AuditView[] | null> {
  if (!getSession().real) return null;
  try {
    const data = await apiRequest<{ entries: RealAuditEntry[] }>("GET", "/api/org/audit", undefined, getAccessToken());
    return data.entries.map((e) => ({
      id: e.id,
      actionType: e.action_type,
      actorName: e.actor_name,
      entityType: e.entity_type,
      entityId: null,
      createdAt: e.created_at,
      isFlagged: e.is_flagged,
      flagReason: null,
    }));
  } catch {
    return null;
  }
}
