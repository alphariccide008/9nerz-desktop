/**
 * Billing service — local mirror of app/api/billing/*. Paystack checkout is
 * simulated: initialise → (user "pays") → verify → subscription active.
 * Free-tier structural limits live in org.ts; this module manages the tier itself.
 */

import { getDB, mutate } from "../db/store";
import { FOUNDING_RATE_SLOTS, FREE_LIMITS, PLANS, Payment, PaymentProvider, PlanId, Subscription } from "../db/schema";
import { uid, nowISO } from "../util";
import { ServiceError, writeAudit, userById, recomputeUnitLocks } from "./helpers";
import { apiRequest } from "../api/http";
import { getSession, getAccessToken } from "../session";

/** Exact shape of GET /api/billing — read directly rather than reimplemented,
 *  since plan limits/pricing/founding-rate math are server-computed and must
 *  match the web app's numbers exactly, not an approximated local copy. */
export interface RealBillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  limits: Record<string, number>;
  features: string[];
}
export interface RealBillingData {
  company: { id: string; name: string; status: string; billingEmail: string | null };
  plans: { free: RealBillingPlan; paid: RealBillingPlan };
  subscription: { plan: string; billing_status: string; current_period_end: string | null; next_payment_due: string | null; grace_until: string | null } | null;
  paymentMethods: { id: string; provider: string; brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null; bank: string | null; is_default: boolean }[];
  payments: { id: string; amount: number; currency: string; provider: string; status: string; method: string | null; invoice_number: string | null; paid_at: string | null; period_end: string | null; created_at: string }[];
  usage: { businessUnits: number; departments: number; staff: number };
  providerReady: boolean;
  isFounding: boolean;
  trial: { active: boolean; endsAt: string | null; daysLeft: number };
  effectiveTier: "free" | "paid";
  founding: { cap: number; claimed: number; remaining: number; eligible: boolean; alreadyFounding: boolean; price: number; currency: string; interval: string };
}

/** The billing routes still run the web app's older cookie-session auth (a
 *  plaintext `nerz_session=<email>` cookie set at web login) rather than the
 *  Bearer-JWT auth every other route accepts — desktop never has that cookie
 *  since it never goes through a browser login, so it's built and sent
 *  explicitly here. Not a security bypass: it asserts the same identity the
 *  Bearer token already proves, just in the shape this one route family
 *  still expects pending its own migration to the JWT auth. */
function sessionCookie(): string | null {
  const real = getSession().real;
  return real ? `nerz_session=${encodeURIComponent(real.user.email)}` : null;
}

export async function fetchRealBilling(): Promise<RealBillingData | null> {
  if (!getSession().real) return null;
  try {
    return await apiRequest<RealBillingData>("GET", "/api/billing", undefined, getAccessToken(), sessionCookie());
  } catch {
    return null;
  }
}

export async function removeRealPaymentMethod(methodId: string): Promise<void> {
  await apiRequest("DELETE", `/api/billing/payment-methods/${methodId}`, undefined, getAccessToken(), sessionCookie());
}

export async function startRealCheckout(): Promise<{ authorizationUrl?: string; message?: string; provider?: string }> {
  return apiRequest("POST", "/api/billing/checkout", {}, getAccessToken(), sessionCookie());
}

const TRIAL_DAYS = 14;

function nextInvoiceNumber(): string {
  const db = getDB();
  const n = db.payments.filter((p) => p.status === "success").length + 1;
  return `INV-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
}

/** True while founding-rate slots remain (first N companies to ever start a paid plan). */
export function foundingRateAvailable(): boolean {
  const db = getDB();
  return db.subscriptions.filter((s) => s.isFoundingSub).length < FOUNDING_RATE_SLOTS;
}

export function getSubscription(companyId: string): Subscription {
  const s = getDB().subscriptions.find((x) => x.companyId === companyId);
  // A real (backend-authenticated) company has no row here yet — billing is
  // still local-mock only pending a later migration pass — so fall back to
  // the same free-tier default a fresh signup gets, rather than throwing.
  if (!s) {
    const now = nowISO();
    return {
      id: "",
      companyId,
      tier: "free",
      planId: "free",
      status: "active",
      provider: null,
      trialEndsAt: null,
      isFoundingSub: false,
      currentPeriodEnd: null,
      graceEndsAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }
  return s;
}

export interface BillingStatusView {
  tier: Subscription["tier"];
  planId: PlanId;
  planName: string;
  status: Subscription["status"];
  isFoundingSub: boolean;
  foundingRateAvailable: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  /** "paid" while trialing or active, even before the underlying tier flips — mirrors web's effectiveTier. */
  effectiveTier: Subscription["tier"];
  currentPeriodEnd: string | null;
}

export function billingStatus(companyId: string): BillingStatusView {
  const s = getSubscription(companyId);
  const trialDaysLeft =
    s.status === "trialing" && s.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(s.trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;
  return {
    tier: s.tier,
    planId: s.planId,
    planName: PLANS[s.planId].name,
    status: s.status,
    isFoundingSub: s.isFoundingSub,
    foundingRateAvailable: foundingRateAvailable(),
    trialEndsAt: s.trialEndsAt,
    trialDaysLeft,
    effectiveTier: s.status === "trialing" || s.status === "active" ? "paid" : s.tier,
    currentPeriodEnd: s.currentPeriodEnd,
  };
}

export interface UsageView {
  businessUnits: { used: number; limit: number | null };
  departments: { used: number; limit: number | null };
  perUnit: { unitId: string; unitName: string; used: number; limit: number | null; locked: boolean }[];
  atLimit: boolean;
}

export function usage(companyId: string): UsageView {
  const db = getDB();
  const company = db.companies.find((c) => c.id === companyId);
  const free = company?.subscriptionTier === "free";
  const units = db.orgUnits.filter((u) => u.companyId === companyId);
  const bu = units.filter((u) => u.unitType === "business_unit").length;
  const dept = units.filter((u) => u.unitType === "department").length;
  const perUnit = units.map((u) => ({
    unitId: u.id,
    unitName: u.name,
    used: db.userOrgUnits.filter((l) => l.orgUnitId === u.id).length,
    limit: free ? FREE_LIMITS.peoplePerUnit : null,
    locked: !!u.lockedAt,
  }));
  const atLimit =
    free &&
    (bu >= FREE_LIMITS.businessUnits ||
      dept >= FREE_LIMITS.departments ||
      perUnit.some((p) => p.limit != null && p.used >= p.limit));
  return {
    businessUnits: { used: bu, limit: free ? FREE_LIMITS.businessUnits : null },
    departments: { used: dept, limit: free ? FREE_LIMITS.departments : null },
    perUnit,
    atLimit,
  };
}

export function listPaymentMethods(companyId: string) {
  return getDB().paymentMethods.filter((p) => p.companyId === companyId);
}

export function listPayments(companyId: string): Payment[] {
  return getDB()
    .payments.filter((p) => p.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addPaymentMethod(
  actorId: string,
  companyId: string,
  input: { number: string; expMonth: number; expYear: number; cvc: string },
): void {
  if (!userById(getDB(), actorId)?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  const digits = input.number.replace(/\s+/g, "");
  if (digits.length < 12) throw new ServiceError("That card number doesn't look right.");
  const brand = digits.startsWith("4") ? "visa" : digits.startsWith("5") ? "mastercard" : "verve";
  mutate((d) => {
    const first = d.paymentMethods.filter((p) => p.companyId === companyId).length === 0;
    d.paymentMethods = [
      ...d.paymentMethods.map((p) => (p.companyId === companyId ? { ...p, isDefault: false } : p)),
      { id: uid("pm"), companyId, brand, last4: digits.slice(-4), expMonth: input.expMonth, expYear: input.expYear, isDefault: first, createdAt: nowISO() },
    ];
    writeAudit(d, { companyId, actorId, actionType: "payment_method_added", entityType: "payment_method", entityId: "pm" });
  });
}

export function removePaymentMethod(actorId: string, methodId: string): void {
  mutate((d) => {
    const pm = d.paymentMethods.find((p) => p.id === methodId);
    if (!pm || !userById(d, actorId)?.isCompanyAdmin) throw new ServiceError("Not allowed.", "forbidden");
    d.paymentMethods = d.paymentMethods.filter((p) => p.id !== methodId);
    if (pm.isDefault) {
      const next = d.paymentMethods.find((p) => p.companyId === pm.companyId);
      if (next) d.paymentMethods = d.paymentMethods.map((p) => (p.id === next.id ? { ...p, isDefault: true } : p));
    }
  });
}

export function setDefaultPaymentMethod(methodId: string): void {
  mutate((d) => {
    const pm = d.paymentMethods.find((p) => p.id === methodId);
    if (!pm) return;
    d.paymentMethods = d.paymentMethods.map((p) =>
      p.companyId === pm.companyId ? { ...p, isDefault: p.id === methodId } : p,
    );
  });
}

// ── Checkout simulation (Paystack for NGN, Paddle as global merchant-of-record) ──

export interface Checkout {
  reference: string;
  amount: number;
  currency: "NGN" | "USD";
  provider: PaymentProvider;
  authorizationUrl: string;
}

/**
 * Starts a 14-day trial immediately (no payment yet) — mirrors web's
 * trialing/trialEndsAt state. A company can only ever trial once; picking
 * "founding" while slots remain locks in that rate for as long as they stay
 * subscribed (isFoundingSub never changes even if PLANS pricing does).
 */
export function startTrial(actorId: string, companyId: string, planId: Exclude<PlanId, "free"> = "standard"): void {
  const actor = userById(getDB(), actorId);
  if (!actor?.isCompanyAdmin) throw new ServiceError("Only an admin can manage billing.", "forbidden");
  const wantsFounding = planId === "founding" && foundingRateAvailable();
  mutate((d) => {
    d.subscriptions = d.subscriptions.map((s) =>
      s.companyId === companyId
        ? {
            ...s,
            tier: "paid",
            planId: wantsFounding ? "founding" : "standard",
            status: "trialing",
            isFoundingSub: wantsFounding,
            trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
            currentPeriodEnd: null,
            updatedAt: nowISO(),
          }
        : s,
    );
    d.companies = d.companies.map((c) => (c.id === companyId ? { ...c, subscriptionTier: "paid", updatedAt: nowISO() } : c));
    recomputeUnitLocks(d, companyId);
    writeAudit(d, { companyId, actorId, actionType: "trial_started", entityType: "subscription", entityId: "subscription", after: { planId: wantsFounding ? "founding" : "standard" } });
  });
}

export function initCheckout(actorId: string, companyId: string, provider: PaymentProvider = "paystack"): Checkout {
  const actor = userById(getDB(), actorId);
  if (!actor?.isCompanyAdmin) throw new ServiceError("Only an admin can manage billing.", "forbidden");
  const sub = getSubscription(companyId);
  const plan = PLANS[sub.planId === "free" ? "standard" : sub.planId];
  const reference = `${provider === "paddle" ? "pd" : "ps"}_${uid("ref").slice(4)}`;
  const usdBased = provider === "paddle";
  const amount = usdBased ? plan.priceUSD ?? 0 : plan.priceNGN ?? 0;
  const currency: "NGN" | "USD" = usdBased ? "USD" : "NGN";
  mutate((d) => {
    d.payments = [
      ...d.payments,
      { id: uid("pay"), companyId, reference, invoiceNumber: null, amount, currency, status: "pending", provider, createdAt: nowISO() },
    ];
  });
  return {
    reference,
    amount,
    currency,
    provider,
    authorizationUrl: usdBased ? `https://checkout.paddle.com/${reference}` : `https://checkout.paystack.com/${reference}`,
  };
}

export function verifyCheckout(actorId: string, companyId: string, reference: string): { tier: "paid" } {
  mutate((d) => {
    const pay = d.payments.find((p) => p.reference === reference && p.companyId === companyId);
    const sub = d.subscriptions.find((s) => s.companyId === companyId);
    if (!pay || !sub) throw new ServiceError("Payment reference not found.", "not_found");
    d.payments = d.payments.map((p) => (p.reference === reference ? { ...p, status: "success", invoiceNumber: nextInvoiceNumber() } : p));
    d.companies = d.companies.map((c) => (c.id === companyId ? { ...c, subscriptionTier: "paid", billingReference: reference, updatedAt: nowISO() } : c));
    d.subscriptions = d.subscriptions.map((s) =>
      s.companyId === companyId
        ? { ...s, tier: "paid", status: "active", provider: pay.provider, currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(), graceEndsAt: null, updatedAt: nowISO() }
        : s,
    );
    recomputeUnitLocks(d, companyId);
    writeAudit(d, { companyId, actorId, actionType: "subscription_upgraded", entityType: "subscription", entityId: "subscription", after: { tier: "paid", planId: sub.planId } });
  });
  return { tier: "paid" };
}

/**
 * Downgrading no longer requires shrinking the org first — instead, whichever
 * units end up over the free-tier caps are frozen (lockedAt) until the admin
 * upgrades again or moves people/units out. Mirrors web's lockedUnitIds model.
 */
export function downgradeToFree(actorId: string, companyId: string): void {
  const db = getDB();
  if (!userById(db, actorId)?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  mutate((d) => {
    d.companies = d.companies.map((c) => (c.id === companyId ? { ...c, subscriptionTier: "free", updatedAt: nowISO() } : c));
    d.subscriptions = d.subscriptions.map((s) =>
      s.companyId === companyId
        ? { ...s, tier: "free", planId: "free", status: "active", provider: null, isFoundingSub: false, trialEndsAt: null, currentPeriodEnd: null, updatedAt: nowISO() }
        : s,
    );
    recomputeUnitLocks(d, companyId);
    writeAudit(d, { companyId, actorId, actionType: "subscription_downgraded", entityType: "subscription", entityId: "subscription" });
  });
}
