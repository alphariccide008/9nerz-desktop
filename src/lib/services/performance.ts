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
import { apiRequest } from "../api/http";
import { getAccessToken } from "../session";

export interface PersonStat {
  id: string;
  name: string;
  role: string | null;
  total: number;
  delivered: number;
  onTime: number;
  late: number;
  openOverdue: number;
  declined: number;
  score: number | null;
  avgDaysLate: number | null;
  rank: number | null;
}
export interface UnitStat extends Omit<PersonStat, "role" | "rank"> {
  type: string;
  parentUnitId: string | null;
  memberCount: number;
  people: PersonStat[];
  topPerformerId: string | null;
  rank: number | null;
}
export interface RealPerformance {
  windowDays: number;
  generatedAt: string;
  isAdmin: boolean;
  me: Omit<PersonStat, "role" | "rank">;
  people: PersonStat[];
  awardUserId: string | null;
  org: (Omit<PersonStat, "role" | "rank" | "id" | "name"> & { headcount: number; departments: { id: string; name: string; score: number | null; delivered: number; onTime: number; rank: number | null }[] }) | null;
  byUnit: UnitStat[];
}

/** The real backend's own OTD ranking (windowed, ranked, per-department/business-unit) —
 *  fetched directly rather than reimplemented client-side, since the ranking rules
 *  (tie-breaks, award threshold, per-unit-type ranking) are non-trivial to replicate exactly. */
export async function fetchRealPerformance(days = 90): Promise<RealPerformance> {
  return apiRequest<RealPerformance>("GET", `/api/org/performance?days=${days}`, undefined, getAccessToken());
}

/** Ported verbatim from the real web app's lib/perf.ts TIERS — rank-based colour,
 *  not a flat tone: green for #1, blue for #2, amber for #3, red beyond that,
 *  grey for no finished tasks yet. */
export interface PerfTier {
  key: string;
  label: string;
  color: string;
  soft: string;
  text: string;
}
export const TIERS: Record<string, PerfTier> = {
  first: { key: "first", label: "Top performer", color: "#16a34a", soft: "rgba(22,163,74,0.12)", text: "#15803d" },
  second: { key: "second", label: "2nd", color: "#2563eb", soft: "rgba(37,99,235,0.12)", text: "#1d4ed8" },
  third: { key: "third", label: "3rd", color: "#f59e0b", soft: "rgba(245,158,11,0.15)", text: "#b45309" },
  rest: { key: "rest", label: "Needs focus", color: "#dc2626", soft: "rgba(220,38,38,0.10)", text: "#b91c1c" },
  none: { key: "none", label: "No data yet", color: "#94a3b8", soft: "rgba(148,163,184,0.14)", text: "#64748b" },
};
export function tierForRank(rank: number | null | undefined): PerfTier {
  if (rank == null) return TIERS.none;
  if (rank === 1) return TIERS.first;
  if (rank === 2) return TIERS.second;
  if (rank === 3) return TIERS.third;
  return TIERS.rest;
}

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
