/**
 * Pulls the real company's tickets from https://www.9nerz.com/api/tickets and
 * caches them into the same local db.tickets / db.ticketMessages / db.attachments
 * arrays that tickets.ts's read functions already filter — so Tickets and the
 * ticket detail popup show real data without changes to those screens.
 */

import { apiRequest } from "../api/http";
import { mutate, getDB } from "../db/store";
import { Attachment, Ticket, TicketMessage, TicketStatus } from "../db/schema";
import { getSession, getAccessToken } from "../session";

type RealTicket = {
  id: string;
  ticket_number: number | null;
  subject: string;
  status: string;
  priority: string;
  requester_email: string;
  requester_name: string | null;
  source_inbox: string | null;
  org_unit_id: string | null;
  assignee_id: string | null;
  last_message_at: string;
  created_at: string;
  first_response_at: string | null;
};

let listInFlight: Promise<void> | null = null;

/** "Ball in our court" is approximated from status since the list endpoint
 *  doesn't return the awaiting_response column directly. */
function approximateAwaiting(status: string): boolean {
  return status === "open" || status === "reopened";
}

export function syncRealTickets(): Promise<void> {
  if (listInFlight) return listInFlight;
  listInFlight = doSyncList().finally(() => {
    listInFlight = null;
  });
  return listInFlight;
}

async function doSyncList(): Promise<void> {
  const real = getSession().real;
  if (!real) return;
  const companyId = real.user.companyId;
  const token = getAccessToken();

  try {
    const { tickets, ticketPrefix } = await apiRequest<{ tickets: RealTicket[]; ticketPrefix: string }>("GET", "/api/tickets", undefined, token);

    const existing = getDB().tickets;
    const mapped: Ticket[] = tickets.map((t) => {
      const prior = existing.find((x) => x.id === t.id);
      return {
        id: t.id,
        companyId,
        subject: t.subject,
        status: t.status as TicketStatus,
        priority: t.priority as Ticket["priority"],
        requesterEmail: t.requester_email,
        requesterName: t.requester_name,
        sourceInbox: t.source_inbox,
        orgUnitId: t.org_unit_id,
        assigneeId: t.assignee_id,
        routingRuleId: null,
        ticketNumber: t.ticket_number,
        // Prefer whatever the detail fetch (which has the real column) last saw;
        // otherwise approximate from status until this ticket's detail is opened.
        awaitingResponse: prior && prior.updatedAt === t.last_message_at ? prior.awaitingResponse : approximateAwaiting(t.status),
        firstResponseAt: t.first_response_at,
        lastMessageAt: t.last_message_at,
        createdAt: t.created_at,
        updatedAt: t.last_message_at,
      };
    });

    mutate((d) => {
      d.tickets = [...d.tickets.filter((x) => x.companyId !== companyId), ...mapped];
      if (d.companies.some((c) => c.id === companyId)) {
        d.companies = d.companies.map((c) => (c.id === companyId ? { ...c, ticketPrefix } : c));
      } else {
        d.companies = [
          ...d.companies,
          {
            id: companyId,
            name: real.company?.name ?? "",
            slug: real.company?.slug ?? "",
            status: "active",
            subscriptionTier: "free",
            billingReference: null,
            ticketPrefix,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    });
  } catch (e) {
    console.warn("[ticketSync] failed to sync real tickets", e);
  }
}

type RealTicketDetail = {
  ticket: RealTicket & { company_id: string; resolved_at: string | null };
  messages: {
    id: string;
    direction: string;
    body: string;
    from_email: string | null;
    created_at: string;
    author: { id: string; first_name: string; last_name: string } | null;
    attachments: { id: string; filename: string; mime: string; size_bytes: number; url: string | null }[];
  }[];
};

const detailInFlight = new Map<string, Promise<void>>();

/** Fetch one ticket's full thread (messages + attachments) into the local cache. */
export function syncRealTicketDetail(ticketId: string): Promise<void> {
  const cached = detailInFlight.get(ticketId);
  if (cached) return cached;
  const p = doSyncDetail(ticketId).finally(() => detailInFlight.delete(ticketId));
  detailInFlight.set(ticketId, p);
  return p;
}

async function doSyncDetail(ticketId: string): Promise<void> {
  const real = getSession().real;
  if (!real) return;
  const companyId = real.user.companyId;
  const token = getAccessToken();

  try {
    const data = await apiRequest<RealTicketDetail>("GET", `/api/tickets/${ticketId}`, undefined, token);
    const t = data.ticket;

    const messages: TicketMessage[] = data.messages.map((m) => ({
      id: m.id,
      ticketId,
      direction: m.direction as TicketMessage["direction"],
      body: m.body,
      fromEmail: m.from_email,
      authorId: m.author?.id ?? null,
      createdAt: m.created_at,
    }));

    const attachments: Attachment[] = data.messages.flatMap((m) =>
      (m.attachments || []).map((a) => ({
        id: a.id,
        companyId,
        taskId: null,
        ticketId,
        ticketMessageId: m.id,
        filename: a.filename,
        mime: a.mime,
        sizeBytes: a.size_bytes,
        kind: (a.mime?.startsWith("image/") ? "image" : a.mime === "application/pdf" ? "pdf" : "file") as Attachment["kind"],
        uri: a.url ?? "",
        scanStatus: "clean",
        createdBy: null,
        createdAt: m.created_at,
      })),
    );

    mutate((d) => {
      d.ticketMessages = [...d.ticketMessages.filter((m) => m.ticketId !== ticketId), ...messages];
      d.attachments = [...d.attachments.filter((a) => a.ticketId !== ticketId), ...attachments];
      d.tickets = d.tickets.map((x) =>
        x.id === ticketId
          ? {
              ...x,
              status: t.status as TicketStatus,
              priority: t.priority as Ticket["priority"],
              orgUnitId: t.org_unit_id,
              assigneeId: t.assignee_id,
              updatedAt: t.last_message_at,
            }
          : x,
      );
    });
  } catch (e) {
    console.warn("[ticketSync] failed to sync ticket detail", ticketId, e);
  }
}
