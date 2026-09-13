/**
 * On-time-delivery performance analytics — local mirror of
 * app/api/org/performance + the dashboard's PerformanceCard/OrgPerfCard/
 * UnitPerfMini/IndividualGrid. Scored purely from local task data: a
 * Completed/Approved task with a dueDate counts as "on time" if it finished
 * at or before that date.
 */

import { getDB } from "../db/store";
import { Task } from "../db/schema";
import { fullName } from "../util";
import { userById, primaryUnitId } from "./helpers";

const DONE_STATUSES: Task["status"][] = ["Completed", "Approved"];
/** A user needs at least this many finished, due-dated tasks before they're eligible for "top performer". */
const MIN_TASKS_FOR_AWARD = 3;

export interface PerformanceRow {
  userId: string;
  name: string;
  unitId: string | null;
  unitName: string | null;
  completed: number;
  onTime: number;
  late: number;
  /** 0-100, null if this person has no finished due-dated tasks to score. */
  otdScore: number | null;
}

export interface UnitPerformance {
  unitId: string;
  unitName: string;
  completed: number;
  onTime: number;
  otdScore: number | null;
}

export interface PerformanceOverview {
  companyOtd: number | null;
  individuals: PerformanceRow[];
  units: UnitPerformance[];
  topPerformer: PerformanceRow | null;
  me: PerformanceRow;
}

function rowFor(db: ReturnType<typeof getDB>, userId: string): PerformanceRow {
  const u = userById(db, userId);
  // A real (backend-authenticated) account has no row here yet — task/performance
  // data is still local-mock only pending a later migration pass.
  if (!u) return { userId, name: "", unitId: null, unitName: null, completed: 0, onTime: 0, late: 0, otdScore: null };
  const finished = db.tasks.filter((t) => t.assigneeId === userId && DONE_STATUSES.includes(t.status) && t.dueDate);
  const onTime = finished.filter((t) => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)).length;
  const completed = finished.length;
  const unitId = primaryUnitId(db, userId);
  return {
    userId,
    name: fullName(u),
    unitId,
    unitName: unitId ? db.orgUnits.find((o) => o.id === unitId)?.name ?? null : null,
    completed,
    onTime,
    late: completed - onTime,
    otdScore: completed > 0 ? Math.round((onTime / completed) * 100) : null,
  };
}

export function performanceOverview(companyId: string, viewerId: string): PerformanceOverview {
  const db = getDB();
  const activeUsers = db.users.filter((u) => u.companyId === companyId && u.status === "active");
  const individuals = activeUsers.map((u) => rowFor(db, u.id)).sort((a, b) => (b.otdScore ?? -1) - (a.otdScore ?? -1));

  const eligible = individuals.filter((r) => r.completed >= MIN_TASKS_FOR_AWARD);
  const topPerformer = eligible.length ? eligible.reduce((best, r) => ((r.otdScore ?? 0) > (best.otdScore ?? 0) ? r : best)) : null;

  const byUnit = new Map<string, { unitName: string; completed: number; onTime: number }>();
  for (const r of individuals) {
    if (!r.unitId) continue;
    const cur = byUnit.get(r.unitId) ?? { unitName: r.unitName ?? "", completed: 0, onTime: 0 };
    cur.completed += r.completed;
    cur.onTime += r.onTime;
    byUnit.set(r.unitId, cur);
  }
  const units: UnitPerformance[] = [...byUnit.entries()]
    .map(([unitId, v]) => ({ unitId, unitName: v.unitName, completed: v.completed, onTime: v.onTime, otdScore: v.completed > 0 ? Math.round((v.onTime / v.completed) * 100) : null }))
    .sort((a, b) => (b.otdScore ?? -1) - (a.otdScore ?? -1));

  const totalCompleted = individuals.reduce((n, r) => n + r.completed, 0);
  const totalOnTime = individuals.reduce((n, r) => n + r.onTime, 0);
  const companyOtd = totalCompleted > 0 ? Math.round((totalOnTime / totalCompleted) * 100) : null;

  const me = individuals.find((r) => r.userId === viewerId) ?? rowFor(db, viewerId);

  return { companyOtd, individuals, units, topPerformer, me };
}
