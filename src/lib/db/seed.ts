/**
 * Demo seed data — one fully-populated company ("Acme Inc."), a second company
 * for the Super Admin cross-company views ("Globex Ltd"), and a platform owner.
 *
 * Every relationship respects the real rules: reporting chains are acyclic and
 * rank-ordered, task assigners sit above assignees, tickets route through rules.
 *
 * All demo passwords: Password1!
 */

import { DB, EMPTY_DB, ISODate } from "./schema";

const now = Date.now();
const iso = (ms: number): ISODate => new Date(ms).toISOString();
const days = (n: number) => iso(now + n * 86_400_000);
const hours = (n: number) => iso(now + n * 3_600_000);
const PW = "Password1!";

export function buildSeed(): DB {
  const db: DB = { ...EMPTY_DB };

  // ── Companies ─────────────────────────────────────────────────────────────
  db.companies = [
    {
      id: "co_acme",
      name: "Acme Inc.",
      slug: "acme",
      status: "active",
      subscriptionTier: "free",
      billingReference: null,
      ticketPrefix: "9TC",
      createdAt: days(-90),
      updatedAt: days(-2),
    },
    {
      id: "co_globex",
      name: "Globex Ltd",
      slug: "globex",
      status: "active",
      subscriptionTier: "paid",
      billingReference: "cus_globex_001",
      ticketPrefix: "GLX",
      createdAt: days(-140),
      updatedAt: days(-10),
    },
  ];

  // ── Super admin ───────────────────────────────────────────────────────────
  db.superAdmins = [
    {
      id: "sa_1",
      firstName: "Platform",
      lastName: "Owner",
      email: "owner@9nerz.app",
      password: PW,
      lastLoginAt: hours(-6),
      createdAt: days(-200),
    },
  ];

  // ── Org units (Acme) ─────────────────────────────────────────────────────
  db.orgUnits = [
    { id: "unit_ops", companyId: "co_acme", parentUnitId: null, name: "Operations", unitType: "business_unit", hasTopRole: true, createdBy: "usr_ada", lockedAt: null, createdAt: days(-88), updatedAt: days(-88) },
    { id: "unit_cs", companyId: "co_acme", parentUnitId: "unit_ops", name: "Customer Service", unitType: "department", hasTopRole: false, createdBy: "usr_ada", lockedAt: null, createdAt: days(-86), updatedAt: days(-86) },
    { id: "unit_product", companyId: "co_acme", parentUnitId: null, name: "Product", unitType: "business_unit", hasTopRole: true, createdBy: "usr_ada", lockedAt: null, createdAt: days(-80), updatedAt: days(-80) },
    { id: "unit_eng", companyId: "co_acme", parentUnitId: "unit_product", name: "Engineering", unitType: "department", hasTopRole: false, createdBy: "usr_ada", lockedAt: null, createdAt: days(-78), updatedAt: days(-78) },
    // Globex — minimal
    { id: "unit_gx_hq", companyId: "co_globex", parentUnitId: null, name: "Headquarters", unitType: "business_unit", hasTopRole: true, createdBy: "usr_zoe", lockedAt: null, createdAt: days(-138), updatedAt: days(-138) },
  ];

  // ── Roles (Acme) ─────────────────────────────────────────────────────────
  db.roles = [
    { id: "role_admin", companyId: "co_acme", name: "Company Admin", rank: 1, reportsToRoleId: null, isAdminRole: true, createdAt: days(-90), updatedAt: days(-90) },
    { id: "role_hob", companyId: "co_acme", name: "Head of Business", rank: 2, reportsToRoleId: "role_admin", isAdminRole: false, createdAt: days(-89), updatedAt: days(-89) },
    { id: "role_mgr", companyId: "co_acme", name: "Manager", rank: 3, reportsToRoleId: "role_hob", isAdminRole: false, createdAt: days(-89), updatedAt: days(-89) },
    { id: "role_senior", companyId: "co_acme", name: "Senior Associate", rank: 4, reportsToRoleId: "role_mgr", isAdminRole: false, createdAt: days(-88), updatedAt: days(-88) },
    { id: "role_assoc", companyId: "co_acme", name: "Associate", rank: 5, reportsToRoleId: "role_senior", isAdminRole: false, createdAt: days(-88), updatedAt: days(-88) },
    // Globex
    { id: "role_gx_admin", companyId: "co_globex", name: "Company Admin", rank: 1, reportsToRoleId: null, isAdminRole: true, createdAt: days(-140), updatedAt: days(-140) },
  ];

  // ── Users (Acme) ─────────────────────────────────────────────────────────
  const mkUser = (
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    roleId: string,
    reportsToUserId: string | null,
    isCompanyAdmin = false,
    companyId = "co_acme",
  ) => ({
    id,
    companyId,
    firstName,
    lastName,
    email,
    password: PW,
    roleId,
    reportsToUserId,
    isCompanyAdmin,
    status: "active" as const,
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    invitedBy: null,
    inviteToken: null,
    inviteExpires: null,
    inviteAcceptedAt: days(-80),
    lastLoginAt: hours(-3),
    lastActiveAt: hours(-1),
    createdAt: days(-85),
    updatedAt: days(-5),
  });

  db.users = [
    mkUser("usr_ada", "Ada", "Obi", "ada@acme.test", "role_admin", null, true),
    mkUser("usr_bode", "Bode", "Cole", "bode@acme.test", "role_hob", "usr_ada"),
    mkUser("usr_chidi", "Chidi", "Eze", "chidi@acme.test", "role_mgr", "usr_bode"),
    mkUser("usr_dara", "Dara", "Ali", "dara@acme.test", "role_senior", "usr_chidi"),
    mkUser("usr_emeka", "Emeka", "Nwosu", "emeka@acme.test", "role_assoc", "usr_dara"),
    mkUser("usr_gani", "Gani", "Musa", "gani@acme.test", "role_hob", "usr_ada"),
    mkUser("usr_fola", "Fola", "Bello", "fola@acme.test", "role_mgr", "usr_gani"),
    mkUser("usr_hauwa", "Hauwa", "Sani", "hauwa@acme.test", "role_assoc", "usr_fola"),
    {
      ...mkUser("usr_ini", "Ini", "Bassey", "ini@acme.test", "role_assoc", "usr_dara"),
      status: "invited",
      isEmailVerified: false,
      inviteAcceptedAt: null,
      inviteToken: "inv_ini_token",
      inviteExpires: days(6),
      invitedBy: "usr_ada",
      lastLoginAt: null,
      lastActiveAt: null,
      createdAt: days(-3),
    },
    // Globex
    mkUser("usr_zoe", "Zoe", "Park", "zoe@globex.test", "role_gx_admin", null, true, "co_globex"),
  ];

  // ── User ↔ unit membership ───────────────────────────────────────────────
  const m = (userId: string, orgUnitId: string) => ({
    userId,
    orgUnitId,
    isPrimary: true,
    createdAt: days(-80),
  });
  db.userOrgUnits = [
    m("usr_ada", "unit_ops"),
    m("usr_bode", "unit_ops"),
    m("usr_chidi", "unit_cs"),
    m("usr_dara", "unit_cs"),
    m("usr_emeka", "unit_cs"),
    m("usr_gani", "unit_product"),
    m("usr_fola", "unit_eng"),
    m("usr_hauwa", "unit_eng"),
    m("usr_ini", "unit_cs"),
    m("usr_zoe", "unit_gx_hq"),
  ];

  // ── Permission policies ──────────────────────────────────────────────────
  db.permissionPolicies = [
    {
      id: "pol_acme",
      companyId: "co_acme",
      inviteScope: "own_unit_and_subunits",
      inviteRankCeiling: "below_own",
      reportingChangeScope: "own_unit",
      approvalRequiredFor: ["cross_unit_move"],
      slaHours: 24,
      createdAt: days(-90),
      updatedAt: days(-30),
    },
    {
      id: "pol_globex",
      companyId: "co_globex",
      inviteScope: "company_wide",
      inviteRankCeiling: "up_to_own",
      reportingChangeScope: "admin_only",
      approvalRequiredFor: [],
      slaHours: 48,
      createdAt: days(-140),
      updatedAt: days(-140),
    },
  ];

  // ── Tasks (Acme) ─────────────────────────────────────────────────────────
  const mkTask = (t: Partial<DB["tasks"][number]> & { id: string; title: string; assignerId: string; assigneeId: string; orgUnitId: string }) => ({
    companyId: "co_acme",
    description: null,
    reviewerId: null,
    status: "Pending" as const,
    priority: "Normal" as const,
    dueDate: null,
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
    createdAt: days(-10),
    updatedAt: days(-1),
    ...t,
  });

  db.tasks = [
    mkTask({ id: "t1", title: "Draft Q3 support playbook", description: "Consolidate the macros, escalation paths and SLA targets into one doc.", assignerId: "usr_chidi", assigneeId: "usr_dara", orgUnitId: "unit_cs", status: "Pending", priority: "Normal", dueDate: days(5), createdAt: days(-2) }),
    mkTask({ id: "t2", title: "Migrate ticket macros to new tool", assignerId: "usr_chidi", assigneeId: "usr_emeka", orgUnitId: "unit_cs", status: "In Progress", priority: "High", acceptedAt: days(-2), dueDate: days(2), createdAt: days(-4) }),
    mkTask({ id: "t3", title: "Customer churn analysis", description: "Pull the last two quarters and flag the top 3 churn drivers.", assignerId: "usr_bode", assigneeId: "usr_chidi", orgUnitId: "unit_cs", status: "Review", priority: "Normal", acceptedAt: days(-5), submittedForReviewAt: days(-1), reviewerId: "usr_dara", dueDate: days(1), createdAt: days(-7) }),
    mkTask({ id: "t4", title: "Onboarding email revamp", assignerId: "usr_chidi", assigneeId: "usr_dara", orgUnitId: "unit_cs", status: "Approved", priority: "Normal", acceptedAt: days(-6), submittedForReviewAt: days(-4), approvedAt: days(-3), completedAt: days(-3), createdAt: days(-9) }),
    mkTask({ id: "t5", title: "Fix login redirect bug", description: "Users bounce to /login after a valid session on slow networks.", assignerId: "usr_fola", assigneeId: "usr_hauwa", orgUnitId: "unit_eng", status: "Pending", priority: "Critical", blockedAt: days(-1), blockedComment: "Waiting on staging access from DevOps.", dueDate: days(-1), createdAt: days(-6) }),
    mkTask({ id: "t6", title: "Write API reference docs", assignerId: "usr_gani", assigneeId: "usr_fola", orgUnitId: "unit_eng", status: "Completed", priority: "Normal", acceptedAt: days(-12), submittedForReviewAt: days(-7), approvedAt: days(-6), completedAt: days(-6), createdAt: days(-14) }),
    mkTask({ id: "t7", title: "Prototype dark mode", assignerId: "usr_fola", assigneeId: "usr_hauwa", orgUnitId: "unit_eng", status: "Declined", priority: "Low", declinedAt: days(-4), createdAt: days(-5) }),
    mkTask({ id: "t8", title: "Review vendor contract", assignerId: "usr_bode", assigneeId: "usr_chidi", orgUnitId: "unit_cs", status: "In Progress", priority: "Normal", acceptedAt: days(-1), dueDate: days(7), createdAt: days(-3) }),
  ];

  db.taskComments = [
    { id: "tc1", taskId: "t3", parentCommentId: null, authorId: "usr_chidi", body: "First pass attached. Churn spikes around day 45 of the trial.", createdAt: days(-1), updatedAt: days(-1) },
    { id: "tc2", taskId: "t3", parentCommentId: null, authorId: "usr_dara", body: "Can you add the enterprise segment separately?", createdAt: hours(-20), updatedAt: hours(-20) },
    { id: "tc3", taskId: "t5", parentCommentId: null, authorId: "usr_hauwa", body: "Reproduced on staging once I throttle to 3G. Need access to the load balancer logs.", createdAt: days(-1), updatedAt: days(-1) },
  ];

  db.taskRevisions = [
    { id: "tr1", taskId: "t3", actorId: "usr_chidi", action: "created", previousStatus: null, newStatus: "Pending", note: null, createdAt: days(-7) },
    { id: "tr2", taskId: "t3", actorId: "usr_chidi", action: "accepted", previousStatus: "Pending", newStatus: "In Progress", note: null, createdAt: days(-5) },
    { id: "tr3", taskId: "t3", actorId: "usr_chidi", action: "submitted_for_review", previousStatus: "In Progress", newStatus: "Review", note: null, createdAt: days(-1) },
    { id: "tr4", taskId: "t3", actorId: "usr_bode", action: "reviewer_assigned", previousStatus: "Review", newStatus: "Review", note: "Dara Ali", createdAt: days(-1) },
    { id: "tr5", taskId: "t5", actorId: "usr_hauwa", action: "blocked", previousStatus: "In Progress", newStatus: "Pending", note: "Waiting on staging access from DevOps.", createdAt: days(-1) },
  ];

  // ── Ticketing (Acme) ─────────────────────────────────────────────────────
  db.ticketInboxes = [
    { id: "inbox_main", companyId: "co_acme", address: "support@acme.9nerz.app", label: "General support", isDefault: true, createdAt: days(-60) },
  ];
  db.ticketRoutingRules = [
    { id: "rr_bug", companyId: "co_acme", inboxId: "inbox_main", subjectPattern: "bug", orgUnitId: "unit_eng", priority: 1, createdAt: days(-50) },
    { id: "rr_error", companyId: "co_acme", inboxId: "inbox_main", subjectPattern: "error", orgUnitId: "unit_eng", priority: 2, createdAt: days(-50) },
    { id: "rr_default", companyId: "co_acme", inboxId: "inbox_main", subjectPattern: null, orgUnitId: "unit_cs", priority: 100, createdAt: days(-50) },
  ];
  db.tickets = [
    { id: "tk1", companyId: "co_acme", subject: "Refund for order #4821", status: "open", priority: "Normal", requesterEmail: "jane@customer.com", requesterName: "Jane Doe", sourceInbox: "support@acme.9nerz.app", orgUnitId: "unit_cs", assigneeId: "usr_dara", routingRuleId: "rr_default", ticketNumber: 3, awaitingResponse: false, firstResponseAt: hours(-5), lastMessageAt: hours(-5), createdAt: days(-1), updatedAt: hours(-5) },
    { id: "tk2", companyId: "co_acme", subject: "App crashes on checkout (bug)", status: "in_progress", priority: "High", requesterEmail: "sam@shop.io", requesterName: "Sam O.", sourceInbox: "support@acme.9nerz.app", orgUnitId: "unit_eng", assigneeId: "usr_hauwa", routingRuleId: "rr_bug", ticketNumber: 2, awaitingResponse: true, firstResponseAt: null, lastMessageAt: hours(-30), createdAt: days(-3), updatedAt: hours(-30) },
    { id: "tk3", companyId: "co_acme", subject: "How do I export my data?", status: "resolved", priority: "Low", requesterEmail: "lee@acme-client.com", requesterName: "Lee", sourceInbox: "support@acme.9nerz.app", orgUnitId: "unit_cs", assigneeId: "usr_emeka", routingRuleId: "rr_default", ticketNumber: 1, awaitingResponse: false, firstResponseAt: days(-2), lastMessageAt: days(-2), createdAt: days(-4), updatedAt: days(-2) },
    { id: "tk4", companyId: "co_acme", subject: "Partnership enquiry", status: "open", priority: "Normal", requesterEmail: "biz@partner.co", requesterName: "Partner Co", sourceInbox: "support@acme.9nerz.app", orgUnitId: null, assigneeId: null, routingRuleId: null, ticketNumber: 4, awaitingResponse: true, firstResponseAt: null, lastMessageAt: hours(-8), createdAt: hours(-8), updatedAt: hours(-8) },
  ];
  db.ticketMessages = [
    { id: "tm1", ticketId: "tk1", direction: "inbound", body: "Hi, I was charged twice for order #4821. Please refund the duplicate.", fromEmail: "jane@customer.com", authorId: null, createdAt: days(-1) },
    { id: "tm2", ticketId: "tk1", direction: "outbound", body: "Hi Jane — I can see the duplicate charge and I've started the refund. It should land in 3–5 business days.", fromEmail: null, authorId: "usr_dara", createdAt: hours(-5) },
    { id: "tm3", ticketId: "tk2", direction: "inbound", body: "The app crashes every time I hit 'Pay now'. Android 14.", fromEmail: "sam@shop.io", authorId: null, createdAt: days(-3) },
    { id: "tm4", ticketId: "tk2", direction: "internal", body: "Looks like the same null-pointer from last sprint. Checking the crash logs.", fromEmail: null, authorId: "usr_hauwa", createdAt: hours(-30) },
    { id: "tm5", ticketId: "tk3", direction: "inbound", body: "Where's the data export option?", fromEmail: "lee@acme-client.com", authorId: null, createdAt: days(-4) },
    { id: "tm6", ticketId: "tk3", direction: "outbound", body: "Settings → Account → Export. It emails you a zip within an hour.", fromEmail: null, authorId: "usr_emeka", createdAt: days(-2) },
    { id: "tm7", ticketId: "tk4", direction: "inbound", body: "We'd like to discuss a reseller partnership for the West Africa region.", fromEmail: "biz@partner.co", authorId: null, createdAt: hours(-8) },
  ];

  // ── Notifications ────────────────────────────────────────────────────────
  db.notifications = [
    { id: "n1", companyId: "co_acme", userId: "usr_dara", type: "task_assigned", title: "New task", message: "Chidi Eze assigned you \"Draft Q3 support playbook\".", entityType: "task", entityId: "t1", isRead: false, readAt: null, metadata: null, createdAt: days(-2) },
    { id: "n2", companyId: "co_acme", userId: "usr_dara", type: "reviewer_assigned", title: "Review requested", message: "You were added as reviewer on \"Customer churn analysis\".", entityType: "task", entityId: "t3", isRead: false, readAt: null, metadata: null, createdAt: days(-1) },
    { id: "n3", companyId: "co_acme", userId: "usr_fola", type: "task_blocked", title: "Task blocked", message: "Hauwa Sani raised a blocker on \"Fix login redirect bug\".", entityType: "task", entityId: "t5", isRead: false, readAt: null, metadata: null, createdAt: days(-1) },
    { id: "n4", companyId: "co_acme", userId: "usr_hauwa", type: "ticket_assigned", title: "Ticket assigned", message: "You were assigned ticket \"App crashes on checkout (bug)\".", entityType: "ticket", entityId: "tk2", isRead: true, readAt: hours(-28), metadata: null, createdAt: hours(-30) },
    { id: "n5", companyId: "co_acme", userId: "usr_chidi", type: "task_approved", title: "Task approved", message: "Bode Cole approved \"Onboarding email revamp\".", entityType: "task", entityId: "t4", isRead: true, readAt: days(-3), metadata: null, createdAt: days(-3) },
  ];

  // ── Audit logs ──────────────────────────────────────────────────────────
  const al = (id: string, actorId: string, actionType: string, entityType: string, entityId: string, createdAt: ISODate, companyId = "co_acme") => ({
    id,
    companyId,
    orgUnitId: null,
    actorId,
    actorType: "user" as const,
    actionType,
    entityType,
    entityId,
    beforeState: null,
    afterState: null,
    isFlagged: false,
    flagReason: null,
    createdAt,
  });
  db.auditLogs = [
    al("a1", "usr_ada", "company_created", "company", "co_acme", days(-90)),
    al("a2", "usr_ada", "unit_created", "org_unit", "unit_ops", days(-88)),
    al("a3", "usr_ada", "role_created", "role", "role_mgr", days(-89)),
    al("a4", "usr_ada", "user_invited", "user", "usr_chidi", days(-84)),
    al("a5", "usr_chidi", "task_created", "task", "t3", days(-7)),
    al("a6", "usr_chidi", "task_accepted", "task", "t3", days(-5)),
    al("a7", "usr_chidi", "task_submitted_for_review", "task", "t3", days(-1)),
    al("a8", "usr_hauwa", "task_blocked", "task", "t5", days(-1)),
    al("a9", "usr_ada", "policy_updated", "permission_policy", "pol_acme", days(-30)),
    al("a10", "usr_dara", "ticket_replied", "ticket", "tk1", hours(-5)),
  ];

  // ── Approval requests ───────────────────────────────────────────────────
  db.approvalRequests = [
    {
      id: "ar1",
      companyId: "co_acme",
      actionType: "cross_unit_move",
      requestedBy: "usr_chidi",
      payload: { userId: "usr_emeka", fromUnitId: "unit_cs", toUnitId: "unit_eng", newManagerId: "usr_fola" },
      status: "pending",
      decidedBy: null,
      decisionNote: null,
      decidedAt: null,
      createdAt: days(-1),
      updatedAt: days(-1),
    },
  ];

  // ── Billing ─────────────────────────────────────────────────────────────
  db.subscriptions = [
    { id: "sub_acme", companyId: "co_acme", tier: "free", planId: "free", status: "active", provider: null, trialEndsAt: null, isFoundingSub: false, currentPeriodEnd: null, graceEndsAt: null, createdAt: days(-90), updatedAt: days(-90) },
    { id: "sub_globex", companyId: "co_globex", tier: "paid", planId: "founding", status: "active", provider: "paystack", trialEndsAt: null, isFoundingSub: true, currentPeriodEnd: days(18), graceEndsAt: null, createdAt: days(-140), updatedAt: days(-12) },
  ];
  db.paymentMethods = [
    { id: "pm_globex", companyId: "co_globex", brand: "visa", last4: "4242", expMonth: 8, expYear: 2028, isDefault: true, createdAt: days(-140) },
  ];
  db.payments = [
    { id: "pay_globex_1", companyId: "co_globex", reference: "ps_ref_9f2a", invoiceNumber: "INV-2024-0002", amount: 4_500_000, currency: "NGN", status: "success", provider: "paystack", createdAt: days(-12) },
    { id: "pay_globex_0", companyId: "co_globex", reference: "ps_ref_1c8d", invoiceNumber: "INV-2024-0001", amount: 4_500_000, currency: "NGN", status: "success", provider: "paystack", createdAt: days(-42) },
  ];

  // ── Super Admin audit + chat ────────────────────────────────────────────
  db.superAdminAuditLogs = [
    { id: "sal1", superAdminId: "sa_1", actionType: "company_viewed", targetCompanyId: "co_acme", details: "Opened Acme Inc. drill-down", createdAt: hours(-6) },
    { id: "sal2", superAdminId: "sa_1", actionType: "subscription_reviewed", targetCompanyId: "co_globex", details: "Reviewed Globex Ltd paid subscription", createdAt: days(-9) },
  ];
  db.chatConversations = [
    { id: "cc1", visitorName: "Curious Visitor", visitorEmail: "hi@startup.dev", status: "open", lastMessageAt: hours(-2), unreadForAdmin: 1, createdAt: hours(-3) },
  ];
  db.chatMessages = [
    { id: "cm1", conversationId: "cc1", sender: "visitor", body: "Does the free tier really include email-to-ticket?", createdAt: hours(-3) },
    { id: "cm2", conversationId: "cc1", sender: "super_admin", body: "Yes — one inbound address, unlimited tickets. You upgrade for multiple addresses and a custom domain.", createdAt: hours(-2.5) },
    { id: "cm3", conversationId: "cc1", sender: "visitor", body: "Great, and self-hosting is the full core?", createdAt: hours(-2) },
  ];

  // ── Platform support (AI assistant escalations + mailbox) ──────────────
  db.supportEscalations = [
    { id: "se1", companyId: "co_acme", userId: "usr_chidi", question: "Can I bulk-import members from a spreadsheet?", reason: "no_kb_match", status: "open", resolvedBy: null, resolutionNote: null, createdAt: hours(-10), resolvedAt: null },
  ];
  db.platformTickets = [
    { id: "pt1", fromEmail: "founder@newco.io", fromName: "New Co", subject: "Enterprise pricing question", body: "Do you offer annual invoicing for teams over 200 people?", status: "open", createdAt: hours(-14), resolvedAt: null },
  ];

  // ── Dev codes / invites (surfaced on-screen) ────────────────────────────
  db.devInvites = [{ email: "ini@acme.test", token: "inv_ini_token", companyId: "co_acme" }];
  db.devCodes = [];

  db.seededAt = new Date().toISOString();
  return db;
}
