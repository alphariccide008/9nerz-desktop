/**
 * Ticket service — local mirror of app/api/tickets/* plus the routing engine
 * (migration 005). Includes an inbound-email simulator that runs the same
 * routing logic the real webhook would: match inbox, then subject rules by
 * priority → org unit; no match → the Unrouted queue.
 */

import { getDB, mutate } from "../db/store";
import { Attachment, AttachmentKind, TaskPriority, Ticket, TicketStatus, User } from "../db/schema";
import { uid, nowISO, fullName } from "../util";
import {
  ServiceError,
  writeAudit,
  notify,
  userById,
  roleOf,
  rankOf,
  primaryUnitId,
  directReports,
} from "./helpers";

export type TicketQueue = "all" | "mine" | "unrouted";

const DEFAULT_TICKET_PREFIX = "9TC";

/** Human-friendly ticket reference: `<prefix>-<zero-padded number>`, e.g. 9TC-001 (mirrors src/lib/ticketRef.js). */
export function formatTicketRef(prefix: string | null | undefined, n: number | null | undefined): string | null {
  if (n == null) return null;
  return `${prefix || DEFAULT_TICKET_PREFIX}-${String(n).padStart(3, "0")}`;
}

function kindOf(mime: string | null | undefined, filename: string): AttachmentKind {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(filename)) return "image";
  if (m === "application/pdf" || /\.pdf$/i.test(filename)) return "pdf";
  return "file";
}

export interface NewAttachment {
  filename: string;
  mime?: string | null;
  sizeBytes?: number | null;
  uri: string;
}

export interface AttachmentView {
  id: string;
  filename: string;
  mime: string | null;
  sizeBytes: number | null;
  kind: AttachmentKind;
  uri: string;
}

export interface TicketListItem {
  id: string;
  ticketNumber: number | null;
  ref: string | null;
  subject: string;
  status: TicketStatus;
  priority: string;
  awaitingResponse: boolean;
  requesterEmail: string;
  requesterName: string | null;
  sourceInbox: string | null;
  orgUnit: { id: string; name: string } | null;
  assignee: { firstName: string; lastName: string } | null;
  lastMessageAt: string;
}

function managersOfUnit(db: DBType, companyId: string, unitId: string): User[] {
  // Managers = anyone in the unit who has direct reports, or a mid-tier+ rank.
  const inUnit = db.users.filter((u) => u.companyId === companyId && primaryUnitId(db, u.id) === unitId && u.status === "active");
  return inUnit.filter((u) => directReports(db, u.id).length > 0 || rankOf(db, u) <= 3 || u.isCompanyAdmin);
}
type DBType = ReturnType<typeof getDB>;

export function listTickets(userId: string, queue: TicketQueue): TicketListItem[] {
  const db = getDB();
  const me = userById(db, userId);
  if (!me) return [];
  let rows = db.tickets.filter((t) => t.companyId === me.companyId);

  if (queue === "mine") rows = rows.filter((t) => t.assigneeId === userId);
  else if (queue === "unrouted") rows = rows.filter((t) => !t.orgUnitId);
  else if (!me.isCompanyAdmin) {
    // non-admins see their unit's queue + tickets assigned to them
    const myUnit = primaryUnitId(db, userId);
    rows = rows.filter((t) => t.assigneeId === userId || (myUnit && t.orgUnitId === myUnit));
  }

  const prefix = db.companies.find((c) => c.id === me.companyId)?.ticketPrefix ?? DEFAULT_TICKET_PREFIX;

  return rows
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      ref: formatTicketRef(prefix, t.ticketNumber),
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      awaitingResponse: t.awaitingResponse && t.status !== "resolved",
      requesterEmail: t.requesterEmail,
      requesterName: t.requesterName,
      sourceInbox: t.sourceInbox,
      orgUnit: t.orgUnitId ? { id: t.orgUnitId, name: db.orgUnits.find((o) => o.id === t.orgUnitId)?.name ?? "" } : null,
      assignee: t.assigneeId ? pick(db.users.find((u) => u.id === t.assigneeId)) : null,
      lastMessageAt: t.lastMessageAt,
    }));
}

const pick = (u?: User) => (u ? { firstName: u.firstName, lastName: u.lastName } : null);

/**
 * Count of tickets in the caller's scope waiting on a reply (awaiting_response,
 * not resolved). Drives the sidebar "Tickets" badge — mirrors GET /api/tickets/count.
 */
export function countAwaiting(userId: string): number {
  const db = getDB();
  const me = userById(db, userId);
  if (!me) return 0;
  const myUnit = me.isCompanyAdmin ? null : primaryUnitId(db, userId);
  return db.tickets.filter((t) => {
    if (t.companyId !== me.companyId) return false;
    if (!t.awaitingResponse || t.status === "resolved") return false;
    if (me.isCompanyAdmin) return true;
    return t.assigneeId === userId || (!!myUnit && t.orgUnitId === myUnit);
  }).length;
}

export interface TicketDetailView {
  ticket: Ticket & { orgUnitName: string | null; assigneeName: string | null; ref: string | null };
  messages: {
    id: string;
    direction: string;
    body: string;
    fromEmail: string | null;
    authorName: string | null;
    createdAt: string;
    attachments: AttachmentView[];
  }[];
  canManage: boolean;
  canRespond: boolean;
  isAdmin: boolean;
  unitMembers: { id: string; firstName: string; lastName: string }[];
}

function attachmentsFor(db: DBType, messageId: string): AttachmentView[] {
  return db.attachments
    .filter((a) => a.ticketMessageId === messageId)
    .map((a) => ({ id: a.id, filename: a.filename, mime: a.mime, sizeBytes: a.sizeBytes, kind: a.kind, uri: a.uri }));
}

export function getTicket(userId: string, ticketId: string): TicketDetailView {
  const db = getDB();
  const me = userById(db, userId);
  const t = db.tickets.find((x) => x.id === ticketId);
  if (!me || !t) throw new ServiceError("Ticket not found", "not_found");

  const isAdmin = me.isCompanyAdmin;
  const isUnitManager = !!t.orgUnitId && managersOfUnit(db, me.companyId, t.orgUnitId).some((u) => u.id === userId);
  const canManage = isAdmin || isUnitManager;
  const canRespond = canManage || t.assigneeId === userId;

  const prefix = db.companies.find((c) => c.id === me.companyId)?.ticketPrefix ?? DEFAULT_TICKET_PREFIX;

  return {
    ticket: {
      ...t,
      orgUnitName: db.orgUnits.find((o) => o.id === t.orgUnitId)?.name ?? null,
      assigneeName: t.assigneeId ? fullName(db.users.find((u) => u.id === t.assigneeId)!) : null,
      ref: formatTicketRef(prefix, t.ticketNumber),
    },
    messages: db.ticketMessages
      .filter((m) => m.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        fromEmail: m.fromEmail,
        authorName: m.authorId ? fullName(db.users.find((u) => u.id === m.authorId)!) : null,
        createdAt: m.createdAt,
        attachments: attachmentsFor(db, m.id),
      })),
    canManage,
    canRespond,
    isAdmin,
    unitMembers: (t.orgUnitId
      ? db.users.filter((u) => u.companyId === me.companyId && primaryUnitId(db, u.id) === t.orgUnitId && u.status === "active")
      : []
    ).map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })),
  };
}

// ── Routing engine ─────────────────────────────────────────────────────────

function route(db: DBType, companyId: string, inboxAddress: string | null, subject: string): { orgUnitId: string | null; ruleId: string | null } {
  const rules = db.ticketRoutingRules
    .filter((r) => r.companyId === companyId)
    .sort((a, b) => a.priority - b.priority);
  const inbox = db.ticketInboxes.find((i) => i.companyId === companyId && i.address === inboxAddress);
  const subj = subject.toLowerCase();
  for (const r of rules) {
    const inboxOk = !r.inboxId || (inbox && r.inboxId === inbox.id);
    const subjectOk = !r.subjectPattern || subj.includes(r.subjectPattern.toLowerCase());
    if (inboxOk && subjectOk) return { orgUnitId: r.orgUnitId, ruleId: r.id };
  }
  return { orgUnitId: null, ruleId: null };
}

export function simulateInbound(
  companyId: string,
  input: { fromEmail: string; fromName?: string; subject: string; body: string; inboxAddress?: string },
): { ticketId: string; routedTo: string | null } {
  const db = getDB();
  const inbox = input.inboxAddress
    ? db.ticketInboxes.find((i) => i.companyId === companyId && i.address === input.inboxAddress)
    : db.ticketInboxes.find((i) => i.companyId === companyId && i.isDefault);
  const { orgUnitId, ruleId } = route(db, companyId, inbox?.address ?? null, input.subject);
  const ticketId = uid("tk");
  const ts = nowISO();
  let routedName: string | null = null;
  // Per-company sequential number (migration 007 — the real allocator is a
  // BEFORE INSERT trigger row-locking ticket_number_seqs; single-threaded here).
  const nextNumber =
    Math.max(0, ...db.tickets.filter((t) => t.companyId === companyId).map((t) => t.ticketNumber ?? 0)) + 1;

  mutate((d) => {
    d.tickets = [
      ...d.tickets,
      {
        id: ticketId,
        companyId,
        subject: input.subject.trim() || "(no subject)",
        status: "open",
        priority: "Normal",
        requesterEmail: input.fromEmail.trim().toLowerCase(),
        requesterName: input.fromName?.trim() || null,
        sourceInbox: inbox?.address ?? null,
        orgUnitId,
        assigneeId: null,
        routingRuleId: ruleId,
        ticketNumber: nextNumber,
        awaitingResponse: true,
        firstResponseAt: null,
        lastMessageAt: ts,
        createdAt: ts,
        updatedAt: ts,
      },
    ];
    d.ticketMessages = [
      ...d.ticketMessages,
      { id: uid("tm"), ticketId, direction: "inbound", body: input.body.trim(), fromEmail: input.fromEmail.trim().toLowerCase(), authorId: null, createdAt: ts },
    ];
    writeAudit(d, { companyId, actorId: null, actorType: "system", actionType: "ticket_created", entityType: "ticket", entityId: ticketId });
    if (orgUnitId) {
      routedName = d.orgUnits.find((o) => o.id === orgUnitId)?.name ?? null;
      for (const mgr of managersOfUnit(d, companyId, orgUnitId))
        notify(d, { companyId, userId: mgr.id, type: "ticket_routed", title: "New ticket", message: `"${input.subject}" landed in ${routedName}.`, entityType: "ticket", entityId: ticketId });
    } else {
      for (const admin of d.users.filter((u) => u.companyId === companyId && u.isCompanyAdmin))
        notify(d, { companyId, userId: admin.id, type: "ticket_unrouted", title: "Unrouted ticket", message: `"${input.subject}" couldn't be routed automatically.`, entityType: "ticket", entityId: ticketId });
    }
  });
  return { ticketId, routedTo: routedName };
}

// ── Actions ────────────────────────────────────────────────────────────────

export function reply(
  actorId: string,
  ticketId: string,
  body: string,
  internal: boolean,
  attachments: NewAttachment[] = [],
): void {
  const text = body.trim();
  if (!text && attachments.length === 0) return;
  mutate((d) => {
    const t = d.tickets.find((x) => x.id === ticketId);
    const actor = userById(d, actorId);
    if (!t || !actor) throw new ServiceError("Ticket not found", "not_found");
    const ts = nowISO();
    const messageId = uid("tm");
    d.ticketMessages = [
      ...d.ticketMessages,
      {
        id: messageId,
        ticketId,
        direction: internal ? "internal" : "outbound",
        body: text || (internal ? "(no message)" : "(see attachment)"),
        fromEmail: null,
        authorId: actorId,
        createdAt: ts,
      },
    ];
    if (attachments.length) {
      d.attachments = [
        ...d.attachments,
        ...attachments.slice(0, 5).map<Attachment>((a) => ({
          id: uid("att"),
          companyId: t.companyId,
          taskId: null,
          ticketId,
          ticketMessageId: messageId,
          filename: a.filename || "file",
          mime: a.mime ?? null,
          sizeBytes: a.sizeBytes ?? null,
          kind: kindOf(a.mime, a.filename || "file"),
          uri: a.uri,
          scanStatus: "skipped",
          createdBy: actorId,
          createdAt: ts,
        })),
      ];
    }
    d.tickets = d.tickets.map((x) =>
      x.id === ticketId
        ? {
            ...x,
            lastMessageAt: ts,
            status: !internal && x.status === "open" ? "in_progress" : x.status,
            // We answered last — drop the "awaiting" flag (internal notes don't count).
            awaitingResponse: internal ? x.awaitingResponse : false,
            firstResponseAt: !internal && !x.firstResponseAt ? ts : x.firstResponseAt,
            updatedAt: ts,
          }
        : x,
    );
    writeAudit(d, { companyId: t.companyId, actorId, actionType: internal ? "ticket_internal_note" : "ticket_replied", entityType: "ticket", entityId: ticketId });
  });
}

export function setStatus(actorId: string, ticketId: string, status: TicketStatus): void {
  mutate((d) => {
    const t = d.tickets.find((x) => x.id === ticketId);
    if (!t) throw new ServiceError("Ticket not found", "not_found");
    d.tickets = d.tickets.map((x) =>
      x.id === ticketId
        ? {
            ...x,
            status,
            // Resolving clears the "awaiting" flag; reopening re-raises it (migration 009).
            awaitingResponse: status === "resolved" ? false : status === "reopened" ? true : x.awaitingResponse,
            updatedAt: nowISO(),
          }
        : x,
    );
    writeAudit(d, { companyId: t.companyId, actorId, actionType: "ticket_status_changed", entityType: "ticket", entityId: ticketId, after: { status } });
  });
}

export function setPriority(actorId: string, ticketId: string, priority: Ticket["priority"]): void {
  mutate((d) => {
    const actor = userById(d, actorId);
    const t = d.tickets.find((x) => x.id === ticketId);
    if (!t) throw new ServiceError("Ticket not found", "not_found");
    const isUnitManager = !!t.orgUnitId && managersOfUnit(d, t.companyId, t.orgUnitId).some((u) => u.id === actorId);
    if (!actor?.isCompanyAdmin && !isUnitManager) throw new ServiceError("Only a manager can change priority.", "forbidden");
    d.tickets = d.tickets.map((x) => (x.id === ticketId ? { ...x, priority, updatedAt: nowISO() } : x));
    writeAudit(d, { companyId: t.companyId, actorId, actionType: "ticket_priority_changed", entityType: "ticket", entityId: ticketId, after: { priority } });
  });
}

export function assign(actorId: string, ticketId: string, assigneeId: string | null): void {
  mutate((d) => {
    const t = d.tickets.find((x) => x.id === ticketId);
    if (!t) throw new ServiceError("Ticket not found", "not_found");
    if (assigneeId && t.orgUnitId && primaryUnitId(d, assigneeId) !== t.orgUnitId)
      throw new ServiceError("You can only assign to someone in this department.", "forbidden");
    d.tickets = d.tickets.map((x) => (x.id === ticketId ? { ...x, assigneeId, updatedAt: nowISO() } : x));
    writeAudit(d, { companyId: t.companyId, actorId, actionType: "ticket_assigned", entityType: "ticket", entityId: ticketId });
    if (assigneeId)
      notify(d, { companyId: t.companyId, userId: assigneeId, type: "ticket_assigned", title: "Ticket assigned", message: `You were assigned "${t.subject}".`, entityType: "ticket", entityId: ticketId });
  });
}

export function moveQueue(actorId: string, ticketId: string, orgUnitId: string | null): void {
  mutate((d) => {
    const actor = userById(d, actorId);
    const t = d.tickets.find((x) => x.id === ticketId);
    if (!actor?.isCompanyAdmin || !t) throw new ServiceError("Only an admin can move queues.", "forbidden");
    d.tickets = d.tickets.map((x) => (x.id === ticketId ? { ...x, orgUnitId, assigneeId: null, updatedAt: nowISO() } : x));
    writeAudit(d, { companyId: t.companyId, actorId, actionType: "ticket_routed", entityType: "ticket", entityId: ticketId });
    if (orgUnitId)
      for (const mgr of managersOfUnit(d, t.companyId, orgUnitId))
        notify(d, { companyId: t.companyId, userId: mgr.id, type: "ticket_routed", title: "Ticket moved here", message: `"${t.subject}" was routed to your queue.`, entityType: "ticket", entityId: ticketId });
  });
}

// ── SLA escalation (mirrors app/api/cron/escalate-tickets + ticketEscalation.js) ──

const PRIORITY_ORDER: TaskPriority[] = ["Low", "Normal", "High", "Critical"];
function bumpPriority(p: TaskPriority): TaskPriority {
  return PRIORITY_ORDER[Math.min(PRIORITY_ORDER.indexOf(p) + 1, PRIORITY_ORDER.length - 1)];
}

export interface EscalationResult {
  ticketId: string;
  subject: string;
  escalatedTo: string;
}

/**
 * No real cron here — this runs client-side, called when the ticket list
 * loads. Escalates any ticket that's been awaiting a reply longer than the
 * company's `slaHours` policy up the current assignee's reporting chain (or
 * to another unit manager if unassigned), bumps its priority, and notifies
 * whoever it lands on. Re-escalating the same ticket is throttled to once an
 * hour so repeated screen loads don't spam it further up the chain.
 */
export function escalateOverdueTickets(companyId: string): EscalationResult[] {
  const db = getDB();
  const policy = db.permissionPolicies.find((p) => p.companyId === companyId);
  if (!policy?.slaHours) return [];
  const cutoff = Date.now() - policy.slaHours * 3_600_000;
  const results: EscalationResult[] = [];

  mutate((d) => {
    const candidates = d.tickets.filter(
      (t) => t.companyId === companyId && t.awaitingResponse && t.status !== "resolved" && new Date(t.lastMessageAt).getTime() < cutoff,
    );
    for (const t of candidates) {
      const lastEscalation = d.auditLogs.find((a) => a.entityId === t.id && a.actionType === "ticket_escalated");
      if (lastEscalation && Date.now() - new Date(lastEscalation.createdAt).getTime() < 3_600_000) continue;

      const currentAssignee = t.assigneeId ? userById(d, t.assigneeId) : null;
      const escalateTo =
        currentAssignee?.reportsToUserId ??
        (t.orgUnitId ? managersOfUnit(d, companyId, t.orgUnitId).find((m) => m.id !== t.assigneeId)?.id : undefined) ??
        null;
      if (!escalateTo) continue;

      d.tickets = d.tickets.map((x) =>
        x.id === t.id ? { ...x, assigneeId: escalateTo, priority: bumpPriority(x.priority), updatedAt: nowISO() } : x,
      );
      writeAudit(d, { companyId, actorId: null, actorType: "system", actionType: "ticket_escalated", entityType: "ticket", entityId: t.id, after: { escalatedTo: escalateTo } });
      notify(d, {
        companyId,
        userId: escalateTo,
        type: "ticket_escalated",
        title: "Ticket escalated to you",
        message: `"${t.subject}" breached its ${policy.slaHours}h SLA and was escalated to you.`,
        entityType: "ticket",
        entityId: t.id,
      });
      results.push({ ticketId: t.id, subject: t.subject, escalatedTo: escalateTo });
    }
  });
  return results;
}

// ── Inboxes + routing rules (admin) ────────────────────────────────────────

export function listInboxes(companyId: string) {
  return getDB().ticketInboxes.filter((i) => i.companyId === companyId);
}
export function listRoutingRules(companyId: string) {
  const db = getDB();
  return db.ticketRoutingRules
    .filter((r) => r.companyId === companyId)
    .sort((a, b) => a.priority - b.priority)
    .map((r) => ({
      ...r,
      inboxAddress: db.ticketInboxes.find((i) => i.id === r.inboxId)?.address ?? null,
      orgUnitName: db.orgUnits.find((o) => o.id === r.orgUnitId)?.name ?? "—",
    }));
}

export function addInbox(actorId: string, companyId: string, label: string): void {
  const db = getDB();
  const actor = userById(db, actorId);
  if (!actor?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  const company = db.companies.find((c) => c.id === companyId);
  if (company?.subscriptionTier === "free" && db.ticketInboxes.filter((i) => i.companyId === companyId).length >= 1)
    throw new ServiceError("Free tier includes one inbound address. Upgrade for more.", "upgrade_required");
  const slug = company?.slug ?? "org";
  mutate((d) => {
    d.ticketInboxes = [
      ...d.ticketInboxes,
      { id: uid("inbox"), companyId, address: `${label.toLowerCase().replace(/[^a-z0-9]/g, "") || "support"}@${slug}.9nerz.app`, label: label.trim() || "Support", isDefault: false, createdAt: nowISO() },
    ];
  });
}

export function addRoutingRule(
  actorId: string,
  companyId: string,
  input: { inboxId: string | null; subjectPattern: string | null; orgUnitId: string },
): void {
  const db = getDB();
  if (!userById(db, actorId)?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  if (!input.orgUnitId) throw new ServiceError("Pick a destination unit.");
  const maxP = Math.max(0, ...db.ticketRoutingRules.filter((r) => r.companyId === companyId).map((r) => r.priority));
  mutate((d) => {
    d.ticketRoutingRules = [
      ...d.ticketRoutingRules,
      { id: uid("rr"), companyId, inboxId: input.inboxId, subjectPattern: input.subjectPattern?.trim() || null, orgUnitId: input.orgUnitId, priority: maxP + 1, createdAt: nowISO() },
    ];
  });
}

export function deleteRoutingRule(actorId: string, ruleId: string): void {
  if (!userById(getDB(), actorId)?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  mutate((d) => {
    d.ticketRoutingRules = d.ticketRoutingRules.filter((r) => r.id !== ruleId);
  });
}
