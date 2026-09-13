/**
 * Pulls the real company's tasks from https://www.9nerz.com/api/tasks and
 * caches them into the same local `db.tasks` array that tasks.ts's read
 * functions (listTasks, getTask, counts) already filter — so Tasks, Task
 * detail and the Dashboard's task widgets light up with real data without
 * changes to those screens. Fetches the broadest scope (?scope=all) once;
 * the existing local filtering logic handles "mine"/"team"/"assigned" from
 * that same cached set, exactly as it does for the local mock data.
 */

import { apiRequest } from "../api/http";
import { mutate } from "../db/store";
import { Task, TaskPriority, TaskStatus } from "../db/schema";
import { getSession, getAccessToken } from "../session";

type RealTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  org_unit_id: string | null;
  assignee_id: string | null;
  assigner_id: string | null;
  reviewer_id: string | null;
  accepted_at: string | null;
  submitted_for_review_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  blocked_at: string | null;
  blocked_comment: string | null;
  created_at: string;
  updated_at: string;
};

let inFlight: Promise<void> | null = null;

export function syncRealTasks(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<void> {
  const real = getSession().real;
  if (!real) return;
  const companyId = real.user.companyId;
  const token = getAccessToken();

  try {
    const { tasks } = await apiRequest<{ tasks: RealTask[] }>("GET", "/api/tasks?scope=all", undefined, token);

    const mapped: Task[] = tasks.map((t) => ({
      id: t.id,
      companyId,
      orgUnitId: t.org_unit_id,
      title: t.title,
      description: t.description,
      assigneeId: t.assignee_id,
      assignerId: t.assigner_id,
      reviewerId: t.reviewer_id,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      dueDate: t.due_date,
      acceptedAt: t.accepted_at,
      submittedForReviewAt: t.submitted_for_review_at,
      approvedAt: null,
      completedAt: t.completed_at,
      declinedAt: t.declined_at,
      blockedAt: t.blocked_at,
      blockedComment: t.blocked_comment,
      reviewerBlockedAt: null,
      reviewerBlockedComment: null,
      reviewedAt: null,
      revertComment: null,
      previousAssigneeId: null,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    mutate((d) => {
      d.tasks = [...d.tasks.filter((x) => x.companyId !== companyId), ...mapped];
    });
  } catch (e) {
    console.warn("[taskSync] failed to sync real tasks", e);
  }
}
