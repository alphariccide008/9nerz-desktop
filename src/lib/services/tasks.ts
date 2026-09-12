/**
 * Task service — local mirror of app/api/tasks/* and lib/store.tsx DataAPI.
 * Full v2 lifecycle: create → accept → in progress → submit for review →
 * review (approve | revert) → completed; plus decline, block/resolve,
 * reviewer assign / mark-reviewed / reviewer-block, and reassign.
 * Every transition writes a task revision + audit log + notification.
 */

import { getDB, mutate } from "../db/store";
import { Attachment, AttachmentKind, LOCKED_UNIT_MESSAGE, Task, TaskPriority, TaskStatus, User } from "../db/schema";
import { uid, nowISO, fullName } from "../util";
import {
  ServiceError,
  writeAudit,
  notify,
  userById,
  reportingSubtree,
  canAssignTo,
  assignableMembers,
  primaryUnitId,
} from "./helpers";

export interface NewTaskAttachment {
  filename: string;
  mime?: string | null;
  sizeBytes?: number | null;
  uri: string;
}

export interface TaskAttachmentView {
  id: string;
  filename: string;
  mime: string | null;
  sizeBytes: number | null;
  kind: AttachmentKind;
  uri: string;
}

function attachmentKind(mime: string | null | undefined, filename: string): AttachmentKind {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(filename)) return "image";
  if (m === "application/pdf" || /\.pdf$/i.test(filename)) return "pdf";
  return "file";
}

function assertUnitUnlocked(db: ReturnType<typeof getDB>, unitId: string | null): void {
  if (!unitId) return;
  const unit = db.orgUnits.find((u) => u.id === unitId);
  if (unit?.lockedAt) throw new ServiceError(LOCKED_UNIT_MESSAGE, "unit_locked");
}

export type TaskScope = "mine" | "assigned" | "team";

export interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  blockedAt: string | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  assigner: { id: string; firstName: string; lastName: string } | null;
  reviewer: { id: string; firstName: string; lastName: string } | null;
  orgUnitId: string | null;
  createdAt: string;
}

function toListItem(u: User[], t: Task): TaskListItem {
  const p = (id: string | null) => {
    const x = u.find((y) => y.id === id);
    return x ? { id: x.id, firstName: x.firstName, lastName: x.lastName } : null;
  };
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    blockedAt: t.blockedAt,
    assignee: p(t.assigneeId),
    assigner: p(t.assignerId),
    reviewer: p(t.reviewerId),
    orgUnitId: t.orgUnitId,
    createdAt: t.createdAt,
  };
}

export function listTasks(userId: string, scope: TaskScope, opts?: { overdueOnly?: boolean }): TaskListItem[] {
  const db = getDB();
  const me = userById(db, userId);
  if (!me) return [];
  const companyTasks = db.tasks.filter((t) => t.companyId === me.companyId);
  let rows: Task[] = [];
  if (scope === "mine") {
    rows = companyTasks.filter((t) => t.assigneeId === userId || t.reviewerId === userId);
  } else if (scope === "assigned") {
    rows = companyTasks.filter((t) => t.assignerId === userId);
  } else {
    const subtreeIds = new Set(reportingSubtree(db, userId).map((x) => x.id));
    rows = companyTasks.filter((t) => t.assigneeId && subtreeIds.has(t.assigneeId));
  }
  if (opts?.overdueOnly) {
    rows = rows.filter(
      (t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && !["Approved", "Completed", "Declined"].includes(t.status),
    );
  }
  return rows
    .sort((a, b) => (b.dueDate ?? b.createdAt).localeCompare(a.dueDate ?? a.createdAt))
    .map((t) => toListItem(db.users, t));
}

export interface TaskDetail extends Task {
  assigneeName: string | null;
  assignerName: string | null;
  reviewerName: string | null;
  orgUnitName: string | null;
  comments: { id: string; body: string; authorName: string; createdAt: string }[];
  revisions: { id: string; action: string; note: string | null; actorName: string; createdAt: string; previousStatus: string | null; newStatus: string | null }[];
  attachments: TaskAttachmentView[];
  unitLocked: boolean;
}

export function getTask(userId: string, taskId: string): TaskDetail {
  const db = getDB();
  const t = db.tasks.find((x) => x.id === taskId);
  if (!t) throw new ServiceError("Task not found", "not_found");
  const name = (id: string | null) => {
    const u = userById(db, id);
    return u ? fullName(u) : null;
  };
  return {
    ...t,
    assigneeName: name(t.assigneeId),
    assignerName: name(t.assignerId),
    reviewerName: name(t.reviewerId),
    orgUnitName: db.orgUnits.find((o) => o.id === t.orgUnitId)?.name ?? null,
    unitLocked: !!(t.orgUnitId && db.orgUnits.find((o) => o.id === t.orgUnitId)?.lockedAt),
    attachments: db.attachments
      .filter((a) => a.taskId === taskId)
      .map((a) => ({ id: a.id, filename: a.filename, mime: a.mime, sizeBytes: a.sizeBytes, kind: a.kind, uri: a.uri })),
    comments: db.taskComments
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({ id: c.id, body: c.body, authorName: name(c.authorId) ?? "Someone", createdAt: c.createdAt })),
    revisions: db.taskRevisions
      .filter((r) => r.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r) => ({
        id: r.id,
        action: r.action,
        note: r.note,
        actorName: name(r.actorId) ?? "System",
        createdAt: r.createdAt,
        previousStatus: r.previousStatus,
        newStatus: r.newStatus,
      })),
  };
}

export function assignableTo(userId: string): { id: string; firstName: string; lastName: string; roleName: string | null }[] {
  const db = getDB();
  const me = userById(db, userId);
  if (!me) return [];
  return assignableMembers(db, me).map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    roleName: db.roles.find((r) => r.id === u.roleId)?.name ?? null,
  }));
}

// ── Transitions ────────────────────────────────────────────────────────────

function revision(d: ReturnType<typeof getDB>, taskId: string, actorId: string, action: string, prev: TaskStatus | null, next: TaskStatus | null, note?: string) {
  d.taskRevisions = [
    ...d.taskRevisions,
    { id: uid("rev"), taskId, actorId, action, previousStatus: prev, newStatus: next, note: note ?? null, createdAt: nowISO() },
  ];
}

function patchTask(taskId: string, actorId: string, action: string, patch: Partial<Task>, opts: { auditAction: string; note?: string; notifyUserId?: string | null; notifyTitle?: string; notifyMessage?: string }) {
  mutate((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) throw new ServiceError("Task not found", "not_found");
    const prev = t.status;
    d.tasks = d.tasks.map((x) => (x.id === taskId ? { ...x, ...patch, updatedAt: nowISO() } : x));
    const next = (patch.status ?? prev) as TaskStatus;
    revision(d, taskId, actorId, action, prev, next, opts.note);
    writeAudit(d, { companyId: t.companyId, actorId, actionType: opts.auditAction, entityType: "task", entityId: taskId, before: { status: prev }, after: { status: next } });
    if (opts.notifyUserId)
      notify(d, {
        companyId: t.companyId,
        userId: opts.notifyUserId,
        type: opts.auditAction,
        title: opts.notifyTitle ?? "Task update",
        message: opts.notifyMessage ?? `"${t.title}" was updated.`,
        entityType: "task",
        entityId: taskId,
      });
  });
}

export function createTask(
  actorId: string,
  input: {
    title: string;
    description?: string;
    assigneeId: string;
    reviewerId?: string;
    priority?: TaskPriority;
    dueDate?: string | null;
    attachments?: NewTaskAttachment[];
  },
): Task {
  const db = getDB();
  const actor = userById(db, actorId);
  if (!actor) throw new ServiceError("Not found", "not_found");
  if (!input.title.trim()) throw new ServiceError("Give the task a title.");
  if (!input.assigneeId) throw new ServiceError("Pick who this is for.");
  if (!canAssignTo(db, actor, input.assigneeId))
    throw new ServiceError("You can only create tasks for people who report to you.", "forbidden");
  assertUnitUnlocked(db, primaryUnitId(db, input.assigneeId));

  const task: Task = {
    id: uid("task"),
    companyId: actor.companyId,
    orgUnitId: primaryUnitId(db, input.assigneeId),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assigneeId: input.assigneeId,
    assignerId: actorId,
    reviewerId: input.reviewerId || null,
    status: "Pending",
    priority: input.priority ?? "Normal",
    dueDate: input.dueDate ?? null,
    acceptedAt: null,
    submittedForReviewAt: null,
    approvedAt: null,
    completedAt: null,
    declinedAt: null,
    blockedAt: null,
    blockedComment: null,
    reviewerBlockedAt: null,
    reviewerBlockedComment: null,
    reviewedAt: null,
    revertComment: null,
    previousAssigneeId: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  mutate((d) => {
    d.tasks = [...d.tasks, task];
    if (input.attachments?.length) {
      const ts = nowISO();
      d.attachments = [
        ...d.attachments,
        ...input.attachments.slice(0, 5).map<Attachment>((a) => ({
          id: uid("att"),
          companyId: actor.companyId,
          taskId: task.id,
          ticketId: null,
          ticketMessageId: null,
          filename: a.filename || "file",
          mime: a.mime ?? null,
          sizeBytes: a.sizeBytes ?? null,
          kind: attachmentKind(a.mime, a.filename || "file"),
          uri: a.uri,
          scanStatus: "skipped",
          createdBy: actorId,
          createdAt: ts,
        })),
      ];
    }
    revision(d, task.id, actorId, "created", null, "Pending");
    writeAudit(d, { companyId: actor.companyId, actorId, actionType: "task_created", entityType: "task", entityId: task.id, after: { title: task.title } });
    notify(d, {
      companyId: actor.companyId,
      userId: input.assigneeId,
      type: "task_assigned",
      title: "New task",
      message: `${fullName(actor)} assigned you "${task.title}".`,
      entityType: "task",
      entityId: task.id,
    });
    if (input.reviewerId)
      notify(d, { companyId: actor.companyId, userId: input.reviewerId, type: "reviewer_assigned", title: "Review requested", message: `You're the reviewer on "${task.title}".`, entityType: "task", entityId: task.id });
  });
  return task;
}

export function updateTask(actorId: string, taskId: string, patch: { title?: string; description?: string; priority?: TaskPriority; dueDate?: string | null }): void {
  patchTask(taskId, actorId, "updated", patch, { auditAction: "task_updated" });
}

export function acceptTask(actorId: string, taskId: string): void {
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "accepted", { status: "In Progress", acceptedAt: nowISO(), declinedAt: null }, {
    auditAction: "task_accepted",
    notifyUserId: t?.assignerId,
    notifyTitle: "Task accepted",
    notifyMessage: `Your task "${t?.title}" was accepted.`,
  });
}

export function declineTask(actorId: string, taskId: string, reason?: string): void {
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "declined", { status: "Declined", declinedAt: nowISO(), revertComment: reason ?? null }, {
    auditAction: "task_declined",
    note: reason,
    notifyUserId: t?.assignerId,
    notifyTitle: "Task declined",
    notifyMessage: `"${t?.title}" was declined${reason ? `: ${reason}` : "."}`,
  });
}

export function submitForReview(actorId: string, taskId: string): void {
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(
    taskId,
    actorId,
    "submitted_for_review",
    { status: "Review", submittedForReviewAt: nowISO(), reviewerBlockedComment: null, reviewerBlockedAt: null },
    {
      auditAction: "task_submitted_for_review",
      notifyUserId: t?.reviewerId ?? t?.assignerId,
      notifyTitle: "Ready for review",
      notifyMessage: `"${t?.title}" is ready for your review.`,
    },
  );
}

export function revertTask(actorId: string, taskId: string, comment: string): void {
  if (!comment.trim()) throw new ServiceError("Add a note so they know what to change.");
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "reverted", { status: "Pending", revertComment: comment.trim(), submittedForReviewAt: null }, {
    auditAction: "task_reverted",
    note: comment.trim(),
    notifyUserId: t?.assigneeId,
    notifyTitle: "Changes requested",
    notifyMessage: `"${t?.title}" was sent back: ${comment.trim()}`,
  });
}

export function approveTask(actorId: string, taskId: string, finalStatus: "Approved" | "Completed" = "Approved"): void {
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "approved", { status: finalStatus, approvedAt: nowISO(), completedAt: nowISO() }, {
    auditAction: "task_approved",
    notifyUserId: t?.assigneeId,
    notifyTitle: "Task approved",
    notifyMessage: `"${t?.title}" was approved. Nice work.`,
  });
}

export function blockTask(actorId: string, taskId: string, comment: string): void {
  if (!comment.trim()) throw new ServiceError("Describe what's blocking you.");
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "blocked", { status: "Pending", blockedAt: nowISO(), blockedComment: comment.trim(), acceptedAt: null }, {
    auditAction: "task_blocked",
    note: comment.trim(),
    notifyUserId: t?.assignerId,
    notifyTitle: "Task blocked",
    notifyMessage: `A blocker was raised on "${t?.title}": ${comment.trim()}`,
  });
}

export function resolveBlock(actorId: string, taskId: string, comment?: string): void {
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "block_resolved", { status: "In Progress", blockedAt: null, blockedComment: null, acceptedAt: t?.acceptedAt ?? nowISO() }, {
    auditAction: "task_block_resolved",
    note: comment,
    notifyUserId: t?.assigneeId,
    notifyTitle: "Blocker cleared",
    notifyMessage: `The blocker on "${t?.title}" was resolved.`,
  });
}

export function assignReviewer(actorId: string, taskId: string, reviewerId: string): void {
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "reviewer_assigned", { reviewerId, reviewedAt: null, reviewerBlockedComment: null, reviewerBlockedAt: null }, {
    auditAction: "reviewer_assigned",
    note: userById(getDB(), reviewerId) ? fullName(userById(getDB(), reviewerId)!) : undefined,
    notifyUserId: reviewerId,
    notifyTitle: "Review requested",
    notifyMessage: `You were added as reviewer on "${t?.title}".`,
  });
}

export function markReviewed(actorId: string, taskId: string): void {
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(taskId, actorId, "reviewed", { reviewedAt: nowISO(), reviewerId: null }, {
    auditAction: "task_reviewed",
    notifyUserId: t?.assignerId,
    notifyTitle: "Review done",
    notifyMessage: `The reviewer signed off on "${t?.title}".`,
  });
}

export function reviewerBlock(actorId: string, taskId: string, comment: string): void {
  if (!comment.trim()) throw new ServiceError("Add a note for the assignee.");
  const t = getDB().tasks.find((x) => x.id === taskId);
  patchTask(
    taskId,
    actorId,
    "reviewer_blocked",
    { status: "In Progress", reviewerId: null, reviewerBlockedComment: comment.trim(), reviewerBlockedAt: nowISO(), submittedForReviewAt: null, reviewedAt: null },
    {
      auditAction: "reviewer_blocked",
      note: comment.trim(),
      notifyUserId: t?.assigneeId,
      notifyTitle: "Reviewer sent it back",
      notifyMessage: `The reviewer blocked "${t?.title}": ${comment.trim()}`,
    },
  );
}

export function reassignTask(actorId: string, taskId: string, assigneeId: string): void {
  const db = getDB();
  const actor = userById(db, actorId)!;
  if (!canAssignTo(db, actor, assigneeId)) throw new ServiceError("You can't assign to that person.", "forbidden");
  assertUnitUnlocked(db, primaryUnitId(db, assigneeId));
  const t = db.tasks.find((x) => x.id === taskId);
  patchTask(
    taskId,
    actorId,
    "reassigned",
    { assigneeId, previousAssigneeId: t?.assigneeId ?? null, status: "Pending", submittedForReviewAt: null, reviewerId: null, acceptedAt: null, orgUnitId: primaryUnitId(db, assigneeId) },
    {
      auditAction: "task_reassigned",
      notifyUserId: assigneeId,
      notifyTitle: "New task",
      notifyMessage: `${fullName(actor)} reassigned "${t?.title}" to you.`,
    },
  );
}

/** Assigner or a company admin only — mirrors DELETE /api/tasks/[id]. */
export function deleteTask(actorId: string, taskId: string): void {
  const db = getDB();
  const actor = userById(db, actorId);
  const t = db.tasks.find((x) => x.id === taskId);
  if (!t) throw new ServiceError("Task not found", "not_found");
  if (!actor || (actor.id !== t.assignerId && !actor.isCompanyAdmin))
    throw new ServiceError("Only the person who assigned this task, or an admin, can delete it.", "forbidden");
  mutate((d) => {
    d.tasks = d.tasks.filter((x) => x.id !== taskId);
    d.taskComments = d.taskComments.filter((c) => c.taskId !== taskId);
    d.taskRevisions = d.taskRevisions.filter((r) => r.taskId !== taskId);
    d.attachments = d.attachments.filter((a) => a.taskId !== taskId);
    writeAudit(d, { companyId: t.companyId, actorId, actionType: "task_deleted", entityType: "task", entityId: taskId, before: { title: t.title } });
  });
}

export function addTaskAttachments(actorId: string, taskId: string, attachments: NewTaskAttachment[]): void {
  if (!attachments.length) return;
  mutate((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) throw new ServiceError("Task not found", "not_found");
    const ts = nowISO();
    d.attachments = [
      ...d.attachments,
      ...attachments.slice(0, 5).map<Attachment>((a) => ({
        id: uid("att"),
        companyId: t.companyId,
        taskId,
        ticketId: null,
        ticketMessageId: null,
        filename: a.filename || "file",
        mime: a.mime ?? null,
        sizeBytes: a.sizeBytes ?? null,
        kind: attachmentKind(a.mime, a.filename || "file"),
        uri: a.uri,
        scanStatus: "skipped",
        createdBy: actorId,
        createdAt: ts,
      })),
    ];
    writeAudit(d, { companyId: t.companyId, actorId, actionType: "task_attachment_added", entityType: "task", entityId: taskId });
  });
}

export function addComment(actorId: string, taskId: string, body: string): void {
  if (!body.trim()) return;
  mutate((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) throw new ServiceError("Task not found", "not_found");
    d.taskComments = [
      ...d.taskComments,
      { id: uid("cmt"), taskId, parentCommentId: null, authorId: actorId, body: body.trim(), createdAt: nowISO(), updatedAt: nowISO() },
    ];
    const actor = userById(d, actorId);
    const recipients = new Set([t.assigneeId, t.assignerId, t.reviewerId].filter((id): id is string => !!id && id !== actorId));
    for (const r of recipients)
      notify(d, { companyId: t.companyId, userId: r, type: "task_comment", title: "New comment", message: `${actor ? fullName(actor) : "Someone"} commented on "${t.title}".`, entityType: "task", entityId: taskId });
  });
}
