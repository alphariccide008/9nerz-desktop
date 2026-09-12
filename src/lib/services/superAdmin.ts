/**
 * Super Admin service — local mirror of app/api/super-admin/*. Structurally
 * separate realm (its own session). Cross-company overview, per-company
 * drill-down, freeze / suspend / delete, tamper-evident action log, visitor chat.
 */

import { getDB, mutate } from "../db/store";
import { CompanyStatus } from "../db/schema";
import { uid, nowISO, fullName } from "../util";
import { setSuperAdminSession, clearSuperAdminSession, getSession } from "../session";
import { ServiceError, writeSuperAdminAudit, recomputeUnitLocks } from "./helpers";

export async function saLogin(email: string, password: string): Promise<{ superAdminId: string }> {
  const sa = getDB().superAdmins.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
  if (!sa || sa.password !== password) throw new ServiceError("Incorrect email or password.");
  mutate((d) => {
    d.superAdmins = d.superAdmins.map((s) => (s.id === sa.id ? { ...s, lastLoginAt: nowISO() } : s));
    writeSuperAdminAudit(d, { superAdminId: sa.id, actionType: "sa_login", details: `${sa.email} signed in` });
  });
  await setSuperAdminSession(sa.id);
  return { superAdminId: sa.id };
}

export async function saLogout(): Promise<void> {
  await clearSuperAdminSession();
}

export function currentSuperAdmin() {
  return getDB().superAdmins.find((s) => s.id === getSession().superAdminId) ?? null;
}

export interface Overview {
  companies: number;
  activeCompanies: number;
  frozenCompanies: number;
  users: number;
  paidCompanies: number;
  mrrNGN: number;
  openTickets: number;
  openChats: number;
}

export function overview(): Overview {
  const db = getDB();
  return {
    companies: db.companies.length,
    activeCompanies: db.companies.filter((c) => c.status === "active").length,
    frozenCompanies: db.companies.filter((c) => c.status !== "active").length,
    users: db.users.length,
    paidCompanies: db.companies.filter((c) => c.subscriptionTier === "paid").length,
    mrrNGN: db.subscriptions.filter((s) => s.tier === "paid" && s.status === "active").length * 45000,
    openTickets: db.tickets.filter((t) => t.status === "open" || t.status === "in_progress").length,
    openChats: db.chatConversations.filter((c) => c.status === "open").length,
  };
}

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  tier: string;
  users: number;
  createdAt: string;
}

export function listCompanies(): CompanyRow[] {
  const db = getDB();
  return db.companies
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      tier: c.subscriptionTier,
      users: db.users.filter((u) => u.companyId === c.id).length,
      createdAt: c.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function companyDetail(companyId: string) {
  const db = getDB();
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) throw new ServiceError("Company not found", "not_found");
  return {
    company,
    subscription: db.subscriptions.find((s) => s.companyId === companyId) ?? null,
    members: db.users
      .filter((u) => u.companyId === companyId)
      .map((u) => ({ id: u.id, name: fullName(u), email: u.email, status: u.status, isAdmin: u.isCompanyAdmin })),
    units: db.orgUnits.filter((u) => u.companyId === companyId).length,
    tasks: db.tasks.filter((t) => t.companyId === companyId).length,
    tickets: db.tickets.filter((t) => t.companyId === companyId).length,
    payments: db.payments.filter((p) => p.companyId === companyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    audit: db.auditLogs.filter((a) => a.companyId === companyId).slice(0, 30),
  };
}

export function userDetail(userId: string) {
  const db = getDB();
  const u = db.users.find((x) => x.id === userId);
  if (!u) throw new ServiceError("User not found", "not_found");
  return {
    user: u,
    company: db.companies.find((c) => c.id === u.companyId) ?? null,
    role: db.roles.find((r) => r.id === u.roleId)?.name ?? null,
    assignedTasks: db.tasks.filter((t) => t.assigneeId === userId).length,
    recentActivity: db.auditLogs.filter((a) => a.actorId === userId).slice(0, 20),
  };
}

export function setCompanyStatus(companyId: string, status: CompanyStatus): void {
  const saId = getSession().superAdminId;
  mutate((d) => {
    const company = d.companies.find((c) => c.id === companyId);
    if (!company) throw new ServiceError("Company not found", "not_found");
    d.companies = d.companies.map((c) => (c.id === companyId ? { ...c, status, updatedAt: nowISO() } : c));
    writeSuperAdminAudit(d, {
      superAdminId: saId,
      actionType: `company_${status}`,
      targetCompanyId: companyId,
      details: `${company.name} set to ${status}`,
    });
    writeAuditForCompany(d, companyId, saId, `company_${status}`);
  });
}

function writeAuditForCompany(d: ReturnType<typeof getDB>, companyId: string, saId: string | null, actionType: string) {
  d.auditLogs = [
    {
      id: uid("audit"),
      companyId,
      orgUnitId: null,
      actorId: saId,
      actorType: "super_admin",
      actionType,
      entityType: "company",
      entityId: companyId,
      beforeState: null,
      afterState: null,
      isFlagged: false,
      flagReason: null,
      createdAt: nowISO(),
    },
    ...d.auditLogs,
  ];
}

export function deleteCompany(companyId: string): void {
  const saId = getSession().superAdminId;
  mutate((d) => {
    const company = d.companies.find((c) => c.id === companyId);
    if (!company) return;
    d.companies = d.companies.filter((c) => c.id !== companyId);
    d.users = d.users.filter((u) => u.companyId !== companyId);
    d.orgUnits = d.orgUnits.filter((u) => u.companyId !== companyId);
    d.roles = d.roles.filter((r) => r.companyId !== companyId);
    d.tasks = d.tasks.filter((t) => t.companyId !== companyId);
    d.tickets = d.tickets.filter((t) => t.companyId !== companyId);
    d.subscriptions = d.subscriptions.filter((s) => s.companyId !== companyId);
    writeSuperAdminAudit(d, { superAdminId: saId, actionType: "company_deleted", targetCompanyId: companyId, details: `${company.name} permanently deleted` });
  });
}

export function listAllPayments() {
  const db = getDB();
  return db.payments
    .map((p) => ({ ...p, companyName: db.companies.find((c) => c.id === p.companyId)?.name ?? "—" }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAllSubscriptions() {
  const db = getDB();
  return db.subscriptions
    .map((s) => ({ ...s, companyName: db.companies.find((c) => c.id === s.companyId)?.name ?? "—" }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export function crossCompanyAudit(filter?: { actionType?: string; flaggedOnly?: boolean }) {
  const db = getDB();
  return db.auditLogs
    .filter((a) => !filter?.actionType || a.actionType === filter.actionType)
    .filter((a) => !filter?.flaggedOnly || a.isFlagged)
    .slice(0, 200)
    .map((a) => ({
      id: a.id,
      companyName: a.companyId ? db.companies.find((c) => c.id === a.companyId)?.name ?? "—" : "Platform",
      actionType: a.actionType,
      actorType: a.actorType,
      entityType: a.entityType,
      isFlagged: a.isFlagged,
      createdAt: a.createdAt,
    }));
}

export function saAuditLog() {
  const db = getDB();
  return db.superAdminAuditLogs
    .map((a) => ({ ...a, companyName: a.targetCompanyId ? db.companies.find((c) => c.id === a.targetCompanyId)?.name ?? "—" : null }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function activityFeed() {
  const db = getDB();
  return db.auditLogs
    .slice(0, 60)
    .map((a) => ({
      id: a.id,
      companyName: a.companyId ? db.companies.find((c) => c.id === a.companyId)?.name ?? "—" : "Platform",
      actionType: a.actionType,
      actorName: a.actorId
        ? fullName(db.users.find((u) => u.id === a.actorId) ?? { firstName: "", lastName: "" }) ||
          db.superAdmins.find((s) => s.id === a.actorId)?.firstName ||
          "System"
        : "System",
      createdAt: a.createdAt,
    }));
}

// ── Visitor chat ──────────────────────────────────────────────────────────

export function listConversations() {
  const db = getDB();
  return db.chatConversations
    .map((c) => ({
      ...c,
      lastMessage: db.chatMessages.filter((m) => m.conversationId === c.id).slice(-1)[0]?.body ?? "",
    }))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function getConversation(conversationId: string) {
  const db = getDB();
  return {
    conversation: db.chatConversations.find((c) => c.id === conversationId) ?? null,
    messages: db.chatMessages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export function sendChatMessage(conversationId: string, sender: "visitor" | "super_admin", body: string): void {
  if (!body.trim()) return;
  mutate((d) => {
    const ts = nowISO();
    d.chatMessages = [...d.chatMessages, { id: uid("cm"), conversationId, sender, body: body.trim(), createdAt: ts }];
    d.chatConversations = d.chatConversations.map((c) =>
      c.id === conversationId
        ? { ...c, lastMessageAt: ts, unreadForAdmin: sender === "visitor" ? c.unreadForAdmin + 1 : 0 }
        : c,
    );
  });
}

export function closeConversation(conversationId: string): void {
  mutate((d) => {
    d.chatConversations = d.chatConversations.map((c) => (c.id === conversationId ? { ...c, status: "closed" } : c));
  });
}

export function markConversationRead(conversationId: string): void {
  mutate((d) => {
    d.chatConversations = d.chatConversations.map((c) => (c.id === conversationId ? { ...c, unreadForAdmin: 0 } : c));
  });
}

// ── Operations health dashboard (mirrors app/api/super-admin/operations) ───

export interface OperationsHealth {
  billingRisk: { companyId: string; companyName: string; status: string }[];
  unroutedPileups: { companyId: string; companyName: string; count: number }[];
  stuckAttachmentScans: number;
  flaggedAuditEntries: { id: string; companyName: string; actionType: string; createdAt: string }[];
  openSupportEscalations: number;
  openPlatformTickets: number;
  /** Most recent time the SLA escalation sweep actually escalated something, per company. */
  lastEscalationRun: { companyId: string; companyName: string; at: string }[];
}

export function operationsHealth(): OperationsHealth {
  const db = getDB();
  const companyName = (id: string | null) => (id ? db.companies.find((c) => c.id === id)?.name ?? "—" : "Platform");

  const billingRisk = db.subscriptions
    .filter((s) => s.status === "past_due" || s.status === "grace")
    .map((s) => ({ companyId: s.companyId, companyName: companyName(s.companyId), status: s.status }));

  const unroutedByCompany = new Map<string, number>();
  for (const t of db.tickets) if (!t.orgUnitId) unroutedByCompany.set(t.companyId, (unroutedByCompany.get(t.companyId) ?? 0) + 1);
  const unroutedPileups = [...unroutedByCompany.entries()]
    .filter(([, count]) => count > 0)
    .map(([companyId, count]) => ({ companyId, companyName: companyName(companyId), count }));

  const stuckCutoff = Date.now() - 24 * 3_600_000;
  const stuckAttachmentScans = db.attachments.filter((a) => a.scanStatus === "pending" && new Date(a.createdAt).getTime() < stuckCutoff).length;

  const flaggedAuditEntries = db.auditLogs
    .filter((a) => a.isFlagged)
    .slice(0, 20)
    .map((a) => ({ id: a.id, companyName: companyName(a.companyId), actionType: a.actionType, createdAt: a.createdAt }));

  const openSupportEscalations = db.supportEscalations.filter((e) => e.status === "open").length;
  const openPlatformTickets = db.platformTickets.filter((t) => t.status === "open").length;

  const lastByCompany = new Map<string, string>();
  for (const a of db.auditLogs) {
    if (a.actionType !== "ticket_escalated" || !a.companyId) continue;
    if (!lastByCompany.has(a.companyId)) lastByCompany.set(a.companyId, a.createdAt); // auditLogs is newest-first
  }
  const lastEscalationRun = [...lastByCompany.entries()].map(([companyId, at]) => ({ companyId, companyName: companyName(companyId), at }));

  return { billingRisk, unroutedPileups, stuckAttachmentScans, flaggedAuditEntries, openSupportEscalations, openPlatformTickets, lastEscalationRun };
}

// ── Support escalations (from the in-app AI assistant) ─────────────────────

export function listSupportEscalations(status?: "open" | "resolved") {
  const db = getDB();
  return db.supportEscalations
    .filter((e) => !status || e.status === status)
    .map((e) => ({ ...e, companyName: e.companyId ? db.companies.find((c) => c.id === e.companyId)?.name ?? "—" : null }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resolveSupportEscalation(escalationId: string, note?: string): void {
  const saId = getSession().superAdminId;
  mutate((d) => {
    const e = d.supportEscalations.find((x) => x.id === escalationId);
    if (!e) return;
    d.supportEscalations = d.supportEscalations.map((x) =>
      x.id === escalationId ? { ...x, status: "resolved", resolvedBy: saId, resolutionNote: note ?? null, resolvedAt: nowISO() } : x,
    );
    writeSuperAdminAudit(d, { superAdminId: saId, actionType: "support_escalation_resolved", details: `Resolved: "${e.question}"` });
  });
}

// ── Platform's own support mailbox (support@9nerz.app) ──────────────────────

export function listPlatformTickets(status?: "open" | "resolved") {
  return getDB()
    .platformTickets.filter((t) => !status || t.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resolvePlatformTicket(ticketId: string): void {
  const saId = getSession().superAdminId;
  mutate((d) => {
    const t = d.platformTickets.find((x) => x.id === ticketId);
    if (!t) return;
    d.platformTickets = d.platformTickets.map((x) => (x.id === ticketId ? { ...x, status: "resolved", resolvedAt: nowISO() } : x));
    writeSuperAdminAudit(d, { superAdminId: saId, actionType: "platform_ticket_resolved", details: `Resolved: "${t.subject}"` });
  });
}

/** A visitor emailing support@9nerz.app directly — separate from a company's own ticket queues. */
export function simulatePlatformInbound(input: { fromEmail: string; fromName?: string; subject: string; body: string }): void {
  mutate((d) => {
    d.platformTickets = [
      { id: uid("pt"), fromEmail: input.fromEmail.trim().toLowerCase(), fromName: input.fromName?.trim() || null, subject: input.subject.trim() || "(no subject)", body: input.body.trim(), status: "open", createdAt: nowISO(), resolvedAt: null },
      ...d.platformTickets,
    ];
  });
}

// ── Manual billing sweep (mirrors app/api/super-admin/billing/sweep) ───────

export interface BillingSweepResult {
  movedToPastDue: number;
  movedToGrace: number;
  cancelledAndDowngraded: number;
  trialsExpired: number;
}

/**
 * The real cron runs daily; here a super admin triggers it by hand (or it runs
 * once when the overview screen loads). Active subs past currentPeriodEnd move
 * to a 7-day grace window (still has access, payment overdue); grace subs past
 * graceEndsAt cancel and downgrade to free (freezing over-cap units instead of
 * deleting anything). Trials past trialEndsAt with no payment on file also
 * revert to free. `past_due` is the terminal state right before a company is
 * force-downgraded, surfaced separately from `grace` in the ops dashboard.
 */
export function runBillingSweep(): BillingSweepResult {
  const saId = getSession().superAdminId;
  const result: BillingSweepResult = { movedToPastDue: 0, movedToGrace: 0, cancelledAndDowngraded: 0, trialsExpired: 0 };
  const now = Date.now();
  mutate((d) => {
    for (const s of d.subscriptions) {
      if (s.status === "active" && s.currentPeriodEnd && new Date(s.currentPeriodEnd).getTime() < now) {
        d.subscriptions = d.subscriptions.map((x) =>
          x.id === s.id ? { ...x, status: "grace", graceEndsAt: new Date(now + 7 * 86_400_000).toISOString(), updatedAt: nowISO() } : x,
        );
        result.movedToGrace += 1;
      } else if (s.status === "grace" && s.graceEndsAt && new Date(s.graceEndsAt).getTime() - 3 * 86_400_000 < now) {
        d.subscriptions = d.subscriptions.map((x) => (x.id === s.id ? { ...x, status: "past_due", updatedAt: nowISO() } : x));
        result.movedToPastDue += 1;
      } else if (s.status === "past_due" && s.graceEndsAt && new Date(s.graceEndsAt).getTime() < now) {
        d.companies = d.companies.map((c) => (c.id === s.companyId ? { ...c, subscriptionTier: "free", updatedAt: nowISO() } : c));
        d.subscriptions = d.subscriptions.map((x) =>
          x.id === s.id ? { ...x, tier: "free", planId: "free", status: "cancelled", provider: null, isFoundingSub: false, currentPeriodEnd: null, graceEndsAt: null, updatedAt: nowISO() } : x,
        );
        recomputeUnitLocks(d, s.companyId);
        result.cancelledAndDowngraded += 1;
      } else if (s.status === "trialing" && s.trialEndsAt && new Date(s.trialEndsAt).getTime() < now) {
        d.companies = d.companies.map((c) => (c.id === s.companyId ? { ...c, subscriptionTier: "free", updatedAt: nowISO() } : c));
        d.subscriptions = d.subscriptions.map((x) =>
          x.id === s.id ? { ...x, tier: "free", planId: "free", status: "cancelled", provider: null, isFoundingSub: false, trialEndsAt: null, updatedAt: nowISO() } : x,
        );
        recomputeUnitLocks(d, s.companyId);
        result.trialsExpired += 1;
      }
    }
    if (result.movedToPastDue || result.cancelledAndDowngraded || result.trialsExpired)
      writeSuperAdminAudit(d, {
        superAdminId: saId,
        actionType: "billing_sweep_run",
        details: `past_due:${result.movedToPastDue} cancelled:${result.cancelledAndDowngraded} trials_expired:${result.trialsExpired}`,
      });
  });
  return result;
}
