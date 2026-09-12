/**
 * In-app support assistant — local mirror of app/api/support/ask + kb.
 * No LLM call (this app has no backend yet): questions are matched against a
 * static knowledge base by keyword overlap. A miss creates a SupportEscalation
 * for a super admin to pick up (see superAdmin.ts operationsHealth / listSupportEscalations).
 */

import { getDB, mutate } from "../db/store";
import { uid, nowISO } from "../util";
import { userById } from "./helpers";

export interface KBArticle {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

export const SUPPORT_KB: KBArticle[] = [
  {
    id: "kb_invite",
    question: "How do I invite someone to my company?",
    answer: "Admin → People → Invite. Pick their role and unit; they get a link (shown on-screen in this demo since there's no email backend yet).",
    keywords: ["invite", "add", "member", "person", "people", "team"],
  },
  {
    id: "kb_structure",
    question: "How do business units and departments work?",
    answer: "Business units are top-level (e.g. Operations, Product); departments sit inside a business unit (e.g. Customer Service inside Operations). Manage both from Admin → Structure.",
    keywords: ["business unit", "department", "structure", "org", "organization", "organisation"],
  },
  {
    id: "kb_task_lifecycle",
    question: "What are the task statuses?",
    answer: "Pending → In Progress (accepted) → Review (submitted) → Approved/Completed, or Declined. A reviewer can send it back to Pending with a note, and either side can raise a blocker at any point before review.",
    keywords: ["task", "status", "lifecycle", "workflow", "pending", "review", "approve"],
  },
  {
    id: "kb_ticket_routing",
    question: "How does ticket routing work?",
    answer: "Admin → Routing rules match on the inbox address and a subject substring, in priority order, and send the ticket to a department. No match lands it in the Unrouted queue.",
    keywords: ["ticket", "routing", "route", "inbox", "unrouted"],
  },
  {
    id: "kb_sla",
    question: "What happens if a ticket breaches its SLA?",
    answer: "If your company has an SLA (Admin → Settings → SLA hours) and a ticket goes that long without a reply, it's automatically escalated up the assignee's reporting chain and its priority is bumped.",
    keywords: ["sla", "escalate", "escalation", "overdue", "breach"],
  },
  {
    id: "kb_billing",
    question: "How do I upgrade or downgrade my plan?",
    answer: "Billing → Upgrade starts a 14-day trial immediately, no card needed yet. Downgrading to Free never blocks on your current structure — any unit over the free-tier caps is simply frozen until you upgrade again or move people out.",
    keywords: ["billing", "upgrade", "downgrade", "plan", "trial", "subscription", "price", "pricing"],
  },
  {
    id: "kb_export",
    question: "Can I export or delete my company's data?",
    answer: "Admin → Settings → \"Your data\" has both: a full JSON export, and self-service permanent deletion (type your workspace's name to confirm).",
    keywords: ["export", "delete", "gdpr", "ndpa", "data", "privacy", "erase"],
  },
  {
    id: "kb_attachments",
    question: "Can I attach files to a task or ticket?",
    answer: "Yes — both task creation/detail and ticket replies support attaching images, PDFs, or other files.",
    keywords: ["attach", "attachment", "file", "upload", "photo", "pdf"],
  },
];

function score(article: KBArticle, question: string): number {
  const q = question.toLowerCase();
  return article.keywords.reduce((n, k) => (q.includes(k.toLowerCase()) ? n + 1 : n), 0);
}

export interface AskResult {
  matched: boolean;
  answer: string | null;
  article: KBArticle | null;
  escalationId: string | null;
}

export function askSupport(actorId: string, question: string): AskResult {
  const trimmed = question.trim();
  if (!trimmed) return { matched: false, answer: null, article: null, escalationId: null };

  const ranked = SUPPORT_KB.map((a) => ({ a, s: score(a, trimmed) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s);

  if (ranked.length > 0) {
    return { matched: true, answer: ranked[0].a.answer, article: ranked[0].a, escalationId: null };
  }

  const db = getDB();
  const actor = userById(db, actorId);
  const escalationId = uid("esc");
  mutate((d) => {
    d.supportEscalations = [
      { id: escalationId, companyId: actor?.companyId ?? null, userId: actorId, question: trimmed, reason: "no_kb_match", status: "open", resolvedBy: null, resolutionNote: null, createdAt: nowISO(), resolvedAt: null },
      ...d.supportEscalations,
    ];
  });
  return { matched: false, answer: null, article: null, escalationId };
}

export function myEscalations(userId: string) {
  return getDB()
    .supportEscalations.filter((e) => e.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
