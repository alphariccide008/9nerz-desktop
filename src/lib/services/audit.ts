/** Audit service — mirror of app/api/audit and app/api/org/audit. */

import { getDB } from "../db/store";
import { fullName } from "../util";

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
