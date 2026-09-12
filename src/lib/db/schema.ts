/**
 * Local DB schema — a faithful TypeScript port of the 9nerz Supabase schema
 * (C:\Users\HP\Desktop\9Nerz\supabase\schema.sql + migrations 003–009).
 *
 * Every table is scoped by `companyId` exactly like the real multi-tenant model.
 * Field names use camelCase; values match the SQL CHECK constraints.
 */

export type ISODate = string;
export type UUID = string;

// ── Phase 1 · Dynamic Org Model ──────────────────────────────────────────────

export type CompanyStatus = "active" | "frozen" | "suspended";
export type SubscriptionTier = "free" | "paid";

export interface Company {
  id: UUID;
  name: string;
  slug: string;
  status: CompanyStatus;
  subscriptionTier: SubscriptionTier;
  billingReference: string | null;
  /** Per-company prefix for human-friendly ticket refs, e.g. 9TC-001 (migration 007). */
  ticketPrefix: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface SuperAdmin {
  id: UUID;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  lastLoginAt: ISODate | null;
  createdAt: ISODate;
}

export type UnitType = "business_unit" | "department";

export interface OrgUnit {
  id: UUID;
  companyId: UUID;
  parentUnitId: UUID | null;
  name: string;
  unitType: UnitType;
  hasTopRole: boolean;
  createdBy: UUID | null;
  /** Set when a plan downgrade left this unit over the free-tier cap; frozen instead of blocking the downgrade. */
  lockedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export const LOCKED_UNIT_MESSAGE =
  "This unit is over your plan's free-tier limit and is frozen until you upgrade or move people/units out.";

export interface Role {
  id: UUID;
  companyId: UUID;
  name: string;
  rank: number; // lower = more senior
  reportsToRoleId: UUID | null;
  isAdminRole: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type UserStatus = "invited" | "active" | "inactive";

export interface User {
  id: UUID;
  companyId: UUID;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: UUID | null;
  reportsToUserId: UUID | null;
  isCompanyAdmin: boolean;
  status: UserStatus;
  isEmailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: ISODate | null;
  passwordResetToken: string | null;
  passwordResetExpires: ISODate | null;
  invitedBy: UUID | null;
  inviteToken: string | null;
  inviteExpires: ISODate | null;
  inviteAcceptedAt: ISODate | null;
  lastLoginAt: ISODate | null;
  lastActiveAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface UserOrgUnit {
  userId: UUID;
  orgUnitId: UUID;
  isPrimary: boolean;
  createdAt: ISODate;
}

// ── Phase 2 · Permission Policy Engine ───────────────────────────────────────

export type InviteScope = "own_unit" | "own_unit_and_subunits" | "company_wide";
export type InviteRankCeiling = "below_own" | "up_to_own";
export type ReportingChangeScope =
  | "own_unit"
  | "own_unit_and_subunits"
  | "cross_unit"
  | "admin_only";
export type ApprovalAction = "unit_creation" | "cross_unit_move" | "role_rank_change";

export interface PermissionPolicy {
  id: UUID;
  companyId: UUID;
  inviteScope: InviteScope;
  inviteRankCeiling: InviteRankCeiling;
  reportingChangeScope: ReportingChangeScope;
  approvalRequiredFor: ApprovalAction[];
  /** Hours an open ticket can go without a reply before auto-escalation; null disables it. */
  slaHours: number | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ApprovalRequest {
  id: UUID;
  companyId: UUID;
  actionType: ApprovalAction;
  requestedBy: UUID | null;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  decidedBy: UUID | null;
  decisionNote: string | null;
  decidedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ── Phase 3 · Task Engine ────────────────────────────────────────────────────

export type TaskStatus =
  | "Pending"
  | "In Progress"
  | "Review"
  | "Approved"
  | "Completed"
  | "Declined";
export type TaskPriority = "Low" | "Normal" | "High" | "Critical";

export interface Task {
  id: UUID;
  companyId: UUID;
  orgUnitId: UUID | null;
  title: string;
  description: string | null;
  assigneeId: UUID | null;
  assignerId: UUID | null;
  reviewerId: UUID | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: ISODate | null;
  acceptedAt: ISODate | null;
  submittedForReviewAt: ISODate | null;
  approvedAt: ISODate | null;
  completedAt: ISODate | null;
  declinedAt: ISODate | null;
  blockedAt: ISODate | null;
  blockedComment: string | null;
  reviewerBlockedAt: ISODate | null;
  reviewerBlockedComment: string | null;
  reviewedAt: ISODate | null;
  revertComment: string | null;
  previousAssigneeId: UUID | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface TaskComment {
  id: UUID;
  taskId: UUID;
  parentCommentId: UUID | null;
  authorId: UUID | null;
  body: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface TaskRevision {
  id: UUID;
  taskId: UUID;
  actorId: UUID | null;
  action: string; // created | accepted | submitted_for_review | reverted | approved | ...
  previousStatus: TaskStatus | null;
  newStatus: TaskStatus | null;
  note: string | null;
  createdAt: ISODate;
}

// ── Cross-cutting · Audit & Notifications ────────────────────────────────────

export type ActorType = "user" | "super_admin" | "system";

export interface AuditLog {
  id: UUID;
  companyId: UUID | null;
  orgUnitId: UUID | null;
  actorId: UUID | null;
  actorType: ActorType;
  actionType: string;
  entityType: string | null;
  entityId: UUID | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  isFlagged: boolean;
  flagReason: string | null;
  createdAt: ISODate;
}

export interface NotificationRow {
  id: UUID;
  companyId: UUID;
  userId: UUID;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: UUID | null;
  isRead: boolean;
  readAt: ISODate | null;
  metadata: Record<string, unknown> | null;
  createdAt: ISODate;
}

// ── Phase 4 · Ticketing (migration 005) ─────────────────────────────────────

export interface TicketInbox {
  id: UUID;
  companyId: UUID;
  address: string; // support@<slug>.9nerz.app
  label: string;
  isDefault: boolean;
  createdAt: ISODate;
}

export interface TicketRoutingRule {
  id: UUID;
  companyId: UUID;
  inboxId: UUID | null;
  subjectPattern: string | null; // matched case-insensitively as substring
  orgUnitId: UUID;
  priority: number; // lower = evaluated first
  createdAt: ISODate;
}

/**
 * "Connect your own mailbox" (IMAP/SMTP) — desktop-only addition, not present in
 * the mobile app's schema. There is no backend here (no real IMAP/SMTP client),
 * so this is a local simulation: save/test/disconnect all just update this
 * record, matching the visual template of the real web app's mailbox-connect
 * feature without pretending to reach a real mail server.
 */
export type MailboxLastStatus = "pending" | "ok";

export interface MailboxAccount {
  id: UUID;
  companyId: UUID;
  provider: string;
  emailAddress: string;
  displayName: string | null;
  defaultOrgUnitId: UUID | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  mailboxFolder: string;
  postAction: "seen" | "move";
  lastStatus: MailboxLastStatus;
  lastCheckedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type TicketStatus = "open" | "in_progress" | "resolved" | "reopened";

export interface Ticket {
  id: UUID;
  companyId: UUID;
  subject: string;
  status: TicketStatus;
  priority: TaskPriority;
  requesterEmail: string;
  requesterName: string | null;
  sourceInbox: string | null;
  orgUnitId: UUID | null;
  assigneeId: UUID | null;
  routingRuleId: UUID | null;
  /** Per-company sequential number; rendered as `<ticketPrefix>-###` (migration 007). */
  ticketNumber: number | null;
  /**
   * true  = the ball is in our court (new ticket, or the customer just replied)
   * false = we answered last, or the ticket is resolved (migration 009).
   * Drives the sidebar "Tickets" badge.
   */
  awaitingResponse: boolean;
  firstResponseAt: ISODate | null;
  lastMessageAt: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type MessageDirection = "inbound" | "outbound" | "internal";

export interface TicketMessage {
  id: UUID;
  ticketId: UUID;
  direction: MessageDirection;
  body: string;
  fromEmail: string | null;
  authorId: UUID | null;
  createdAt: ISODate;
}

export type AttachmentKind = "image" | "pdf" | "file";

/**
 * Ticket / task attachment (migrations 005 + 008). The real app stores files in
 * a private Storage bucket; here `uri` holds a local file / data URI so a picked
 * PDF or photo can be shown inline for the session.
 */
export interface Attachment {
  id: UUID;
  companyId: UUID;
  taskId: UUID | null;
  ticketId: UUID | null;
  ticketMessageId: UUID | null;
  filename: string;
  mime: string | null;
  sizeBytes: number | null;
  kind: AttachmentKind;
  uri: string;
  scanStatus: "pending" | "clean" | "skipped";
  createdBy: UUID | null;
  createdAt: ISODate;
}

// ── Phase 9 · Billing (migrations 003 / 004) ────────────────────────────────

export type SubscriptionStatus = "trialing" | "active" | "grace" | "past_due" | "cancelled";
export type PaymentProvider = "paystack" | "paddle" | "stripe";
export type PlanId = "free" | "standard" | "founding";

export interface Subscription {
  id: UUID;
  companyId: UUID;
  tier: SubscriptionTier;
  planId: PlanId;
  status: SubscriptionStatus;
  provider: PaymentProvider | null;
  trialEndsAt: ISODate | null;
  /** Locked-in founding rate — set once, for one of the first N companies to upgrade, never changes even if PLANS pricing does. */
  isFoundingSub: boolean;
  currentPeriodEnd: ISODate | null;
  graceEndsAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface PaymentMethod {
  id: UUID;
  companyId: UUID;
  brand: string; // visa / mastercard / verve
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: ISODate;
}

export type PaymentStatus = "pending" | "success" | "failed";

export interface Payment {
  id: UUID;
  companyId: UUID;
  reference: string;
  invoiceNumber: string | null;
  amount: number; // in kobo / cents
  currency: "NGN" | "USD";
  status: PaymentStatus;
  provider: PaymentProvider;
  createdAt: ISODate;
}

// ── Phase 8 · Super Admin audit + chat (migration 002) ──────────────────────

export interface SuperAdminAuditLog {
  id: UUID;
  superAdminId: UUID | null;
  actionType: string;
  targetCompanyId: UUID | null;
  details: string;
  createdAt: ISODate;
}

export type ChatStatus = "open" | "closed";

export interface ChatConversation {
  id: UUID;
  visitorName: string;
  visitorEmail: string | null;
  status: ChatStatus;
  lastMessageAt: ISODate;
  unreadForAdmin: number;
  createdAt: ISODate;
}

export interface ChatMessage {
  id: UUID;
  conversationId: UUID;
  sender: "visitor" | "super_admin";
  body: string;
  createdAt: ISODate;
}

// ── Platform support (AI assistant, escalations, platform mailbox) ─────────

export type SupportEscalationStatus = "open" | "resolved";

/** Raised when the in-app support assistant can't answer from the KB (mirrors app/api/support/ask escalation path). */
export interface SupportEscalation {
  id: UUID;
  companyId: UUID | null;
  userId: UUID | null;
  question: string;
  reason: string;
  status: SupportEscalationStatus;
  resolvedBy: UUID | null;
  resolutionNote: string | null;
  createdAt: ISODate;
  resolvedAt: ISODate | null;
}

export type PlatformTicketStatus = "open" | "resolved";

/** The platform's own support inbox (support@9nerz.app) — distinct from a company's ticket queues. */
export interface PlatformTicket {
  id: UUID;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string;
  status: PlatformTicketStatus;
  createdAt: ISODate;
  resolvedAt: ISODate | null;
}

// ── Root shape ──────────────────────────────────────────────────────────────

export interface DB {
  companies: Company[];
  superAdmins: SuperAdmin[];
  orgUnits: OrgUnit[];
  roles: Role[];
  users: User[];
  userOrgUnits: UserOrgUnit[];
  permissionPolicies: PermissionPolicy[];
  approvalRequests: ApprovalRequest[];
  tasks: Task[];
  taskComments: TaskComment[];
  taskRevisions: TaskRevision[];
  auditLogs: AuditLog[];
  notifications: NotificationRow[];
  ticketInboxes: TicketInbox[];
  ticketRoutingRules: TicketRoutingRule[];
  mailboxAccounts: MailboxAccount[];
  tickets: Ticket[];
  ticketMessages: TicketMessage[];
  attachments: Attachment[];
  subscriptions: Subscription[];
  paymentMethods: PaymentMethod[];
  payments: Payment[];
  superAdminAuditLogs: SuperAdminAuditLog[];
  chatConversations: ChatConversation[];
  chatMessages: ChatMessage[];
  supportEscalations: SupportEscalation[];
  platformTickets: PlatformTicket[];
  /** OTP + reset codes surfaced on-screen (dev — mirrors the web console fallback). */
  devCodes: { email: string; code: string; kind: "verification" | "password_reset"; expiresAt: ISODate }[];
  /** invite links surfaced on-screen instead of emailed. */
  devInvites: { email: string; token: string; companyId: UUID }[];
  seededAt: ISODate | null;
}

export const EMPTY_DB: DB = {
  companies: [],
  superAdmins: [],
  orgUnits: [],
  roles: [],
  users: [],
  userOrgUnits: [],
  permissionPolicies: [],
  approvalRequests: [],
  tasks: [],
  taskComments: [],
  taskRevisions: [],
  auditLogs: [],
  notifications: [],
  ticketInboxes: [],
  ticketRoutingRules: [],
  mailboxAccounts: [],
  tickets: [],
  ticketMessages: [],
  attachments: [],
  subscriptions: [],
  paymentMethods: [],
  payments: [],
  superAdminAuditLogs: [],
  chatConversations: [],
  chatMessages: [],
  supportEscalations: [],
  platformTickets: [],
  devCodes: [],
  devInvites: [],
  seededAt: null,
};

// ── Free-tier structural limits (PRD §11) ───────────────────────────────────
export const FREE_LIMITS = {
  businessUnits: 2,
  departments: 2,
  peoplePerUnit: 4,
};

// ── Billing plans ────────────────────────────────────────────────────────────

export interface PlanDef {
  id: PlanId;
  name: string;
  priceNGN: number | null; // in kobo; null = not sold directly (free / locked founding rate)
  priceUSD: number | null; // in cents
  trialDays: number;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: { id: "free", name: "Free", priceNGN: 0, priceUSD: 0, trialDays: 0 },
  founding: { id: "founding", name: "Founding member", priceNGN: 8_000_000, priceUSD: 8_000, trialDays: 14 },
  standard: { id: "standard", name: "Standard", priceNGN: 12_000_000, priceUSD: 12_000, trialDays: 14 },
};

/** First N companies to upgrade lock in the founding rate for as long as they stay subscribed. */
export const FOUNDING_RATE_SLOTS = 50;
