import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, ExternalLink, Lock, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Sheet } from "../components/ui/Sheet";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Feedback";
import { useToast } from "../components/ui/Toast";
import { AdminGuard } from "../components/admin/AdminGuard";
import { useCurrentUser, useCompany } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import {
  addPaymentMethod,
  billingStatus,
  downgradeToFree,
  fetchRealBilling,
  initCheckout,
  listPaymentMethods,
  listPayments,
  RealBillingData,
  removePaymentMethod,
  removeRealPaymentMethod,
  startRealCheckout,
  startTrial,
  usage,
  verifyCheckout,
} from "../lib/services/billing";
import { PaymentProvider } from "../lib/db/schema";
import { confirmAction } from "../lib/confirm";
import { shortDate } from "../lib/util";
import { colors } from "../lib/theme";
import { cn } from "../lib/cn";
import { useSession } from "../lib/session";

/** Mirrors the real web app's app/billing/page.tsx feature lists (server-driven there; static here
 *  since this desktop build reads billing state from the local mock subscription model, not /api/billing). */
const FREE_FEATURES = ["Up to 2 business units", "Up to 2 departments", "Up to 4 people per unit", "1 support inbox", "Task boards, comments & history", "30-day audit trail"];
const PAID_FEATURES = ["Unlimited units & people", "Multiple inboxes + custom domain", "Extended audit retention", "Priority support"];

const money = (a: number, c: string) => (c === "USD" || c === "$" ? `$${Number(a).toLocaleString()}` : `${c} ${Number(a).toLocaleString()}`);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

/** Real accounts read GET /api/billing directly — plan limits, founding-rate math and
 *  pricing are server-computed and must match the web app's numbers exactly, not an
 *  approximated local copy (the local-mock path below stays for demo/offline use). */
function RealBillingSection() {
  const company = useCompany();
  const toast = useToast();
  const [data, setData] = useState<RealBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  const load = () => {
    fetchRealBilling()
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <Text variant="body">Loading…</Text>;
  if (!data) return <Banner tone="error">Couldn't load billing right now.</Banner>;

  const onPaid = data.subscription?.plan === "paid";
  const isFounding = data.isFounding;
  const founding = data.founding;
  const trial = data.trial;
  const bs = data.subscription?.billing_status;

  const capRow = (label: string, used: number, cap: number) => {
    const over = used > cap;
    return (
      <div className="flex flex-row items-center justify-between text-[13px]" key={label}>
        <span className="text-slate">{label}</span>
        <span className={cn(over ? "font-semibold text-destructive" : "text-ink")}>
          {used} / {cap === Infinity || cap > 9000 ? "∞" : cap}
        </span>
      </div>
    );
  };

  const upgrade = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await startRealCheckout();
      if (res.authorizationUrl) {
        window.nerz?.openExternal(res.authorizationUrl);
        setMsg("Checkout opened in your browser — come back here and refresh once you're done.");
      } else {
        setMsg(res.message || "Upgraded.");
        load();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  };

  const removeCard = (id: string) => {
    confirmAction("Remove this card?", "This can't be undone.", async () => {
      try {
        await removeRealPaymentMethod(id);
        toast.show("Card removed", "success");
        load();
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Failed", "error");
      }
    });
  };

  return (
    <>
      {msg ? (
        <Card className="p-3">
          <Text variant="caption">{msg}</Text>
        </Card>
      ) : null}

      {data.company.status === "suspended" ? (
        <Banner tone="error">This account is suspended for non-payment. Complete a payment to restore access.</Banner>
      ) : null}

      {trial.active ? (
        <Banner tone="warn">
          <Text variant="caption">
            <span className="font-semibold">
              Trial: {trial.daysLeft} day{trial.daysLeft === 1 ? "" : "s"} left.
            </span>{" "}
            You have full Unlimited access until {day(trial.endsAt)}, then your workspace reverts to the Free limits (1 business unit, 1 department). Upgrade any time to keep everything.
          </Text>
        </Banner>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <Text variant="caption">Current plan</Text>
            <Text variant="title" className="mt-0.5 block !text-[18px]">
              {onPaid ? (isFounding ? "Unlimited · Founding rate" : "Unlimited") : trial.active ? "Free (trial)" : "Free"}
            </Text>
          </div>
          {isFounding ? (
            <div className="text-right">
              <Text variant="caption" tone="teal" className="block font-semibold">
                Founding member 🎉
              </Text>
              <Text variant="caption">
                ${founding.price}/mo, locked forever. Renews {day(data.subscription?.next_payment_due ?? null)}
              </Text>
            </div>
          ) : onPaid ? (
            <div className="text-right">
              <Text variant="caption">
                Status: <span className="font-medium capitalize text-ink">{bs?.replace("_", " ")}</span>
              </Text>
              <Text variant="caption" className="block">
                Renews {day(data.subscription?.next_payment_due ?? null)}
              </Text>
              {data.subscription?.grace_until ? (
                <Text variant="caption" className="block text-amber">
                  Grace period ends {day(data.subscription.grace_until)}
                </Text>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[data.plans.free, data.plans.paid].map((plan) => {
          const current = (data.subscription?.plan || "free") === plan.id;
          return (
            <Card key={plan.id} className={cn("flex flex-col gap-3 p-5", current && "border-ink ring-1 ring-ink")}>
              <div className="flex flex-row items-center justify-between">
                <Text variant="heading" className="text-[15px]">
                  {plan.name}
                </Text>
                {current ? <Badge label="Current" className="bg-ink" textClassName="text-white" /> : null}
              </div>
              <Text variant="title" className="!text-[22px]">
                {plan.price === 0 ? "Free" : plan.id === "paid" && founding.eligible ? money(founding.price, founding.currency) : money(plan.price, plan.currency)}
                {plan.price > 0 ? <span className="text-[13px] font-normal text-slate">/month</span> : null}
              </Text>
              {plan.id === "paid" && founding.eligible ? (
                <Text variant="caption" className="font-medium text-teal">
                  Founding rate: {founding.remaining} of {founding.cap} left. ${founding.price}/mo locked forever, even as we add features.
                </Text>
              ) : null}
              <div className="flex flex-1 flex-col gap-1.5">
                {plan.features.map((f) => (
                  <div key={f} className="flex flex-row items-start gap-2">
                    <Check size={14} color={colors.teal} className="mt-0.5 shrink-0" />
                    <span className="text-[13px] text-slate">{f}</span>
                  </div>
                ))}
              </div>
              {plan.id === "paid" && !isFounding ? (
                <Button
                  title={busy ? "Starting checkout…" : founding.eligible ? `Lock the founding rate at ${money(founding.price, founding.currency)}/mo` : onPaid ? "Renew / manage" : "Upgrade to Unlimited"}
                  size="sm"
                  variant="amber"
                  disabled={busy}
                  onPress={upgrade}
                  fullWidth
                />
              ) : plan.id === "paid" && isFounding ? (
                <Text variant="caption" tone="teal" className="pt-1 text-center font-semibold">
                  Founding rate, ${founding.price}/mo, locked forever 🎉
                </Text>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col gap-2 p-4">
        <Text variant="heading">{trial.active ? "Your usage vs the Free limits (apply after the trial)" : "Usage against Free-tier limits"}</Text>
        {capRow("Business units", data.usage.businessUnits, data.plans.free.limits.businessUnits)}
        {capRow("Departments", data.usage.departments, data.plans.free.limits.departments)}
        {capRow("Staff", data.usage.staff, data.plans.free.limits.staffPerUnit)}
        {!onPaid && (data.usage.businessUnits > data.plans.free.limits.businessUnits || data.usage.departments > data.plans.free.limits.departments) ? (
          <Text variant="caption" className="mt-1 text-destructive">
            You're over the Free limits{trial.active ? ", upgrade before the trial ends to keep this structure" : ", upgrade to Unlimited to keep adding structure"}.
          </Text>
        ) : null}
      </Card>

      <div className="overflow-hidden rounded-xl border border-hairline bg-card">
        <div className="flex flex-row items-center justify-between border-b border-hairline/70 px-4 py-3">
          <Text variant="heading" className="flex items-center gap-2">
            <CreditCard size={15} color={colors.ink} /> Payment methods
          </Text>
          {data.providerReady ? (
            <button type="button" onClick={upgrade} className="text-[13px] text-teal hover:underline">
              Add card via checkout
            </button>
          ) : (
            <Text variant="caption">Gateway not connected</Text>
          )}
        </div>
        {data.paymentMethods.length === 0 ? (
          <Text variant="caption" className="block px-4 py-6 text-center">
            No saved cards. Your card is saved automatically the first time you pay.
          </Text>
        ) : (
          <div className="flex flex-col divide-y divide-hairline/60">
            {data.paymentMethods.map((m) => (
              <div key={m.id} className="flex flex-row items-center gap-3 px-4 py-3">
                <span className="rounded bg-muted px-2 py-1 text-[11px] font-semibold uppercase text-slate">{m.brand || "card"}</span>
                <div className="flex-1">
                  <Text variant="body" className="block text-[13px]">
                    •••• {m.last4 || "____"}
                  </Text>
                  <Text variant="caption">
                    {m.exp_month && m.exp_year ? `Expires ${m.exp_month}/${m.exp_year}` : m.bank || ""}
                    {m.is_default ? " · default" : ""}
                  </Text>
                </div>
                <button type="button" onClick={() => removeCard(m.id)} className="text-slate hover:text-destructive">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-row items-center gap-1.5 border-t border-hairline/60 px-4 py-2.5">
          <ShieldCheck size={13} color={colors.mutedForeground} />
          <Text variant="caption">Card details are handled by the payment provider, 9nerz never stores your card number.</Text>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-card">
        <div className="border-b border-hairline/70 px-4 py-3">
          <Text variant="heading">Payment history</Text>
        </div>
        {data.payments.length === 0 ? (
          <Text variant="caption" className="block px-4 py-6 text-center">
            No payments yet.
          </Text>
        ) : (
          <div className="flex flex-col divide-y divide-hairline/60">
            {data.payments.map((p) => (
              <div key={p.id} className="flex flex-row items-center gap-3 px-4 py-2.5">
                <Text variant="caption" className="w-20 shrink-0">
                  {day(p.paid_at || p.created_at)}
                </Text>
                <Text variant="body" className="w-24 shrink-0 text-[13px] font-medium">
                  {money(p.amount, p.currency)}
                </Text>
                <Text variant="caption" className="flex-1 truncate font-mono">
                  {p.invoice_number ?? "—"}
                </Text>
                <Text variant="caption" className="w-20 shrink-0 capitalize">
                  {p.provider}
                </Text>
                <Badge
                  label={p.status}
                  className={p.status === "valid" ? "bg-teal/15" : p.status === "invalid" ? "bg-destructive/15" : "bg-amber/20"}
                />
                {p.provider === "paystack" ? (
                  <button
                    type="button"
                    onClick={() => window.nerz?.openExternal("https://dashboard.paystack.com")}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] text-teal hover:underline"
                  >
                    receipt <ExternalLink size={11} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function Billing() {
  const me = useCurrentUser();
  const company = useCompany();
  const { real } = useSession();
  const toast = useToast();
  const tick = useDB(
    (db) => `${db.companies.find((c) => c.id === me?.companyId)?.subscriptionTier}:${db.subscriptions.find((s) => s.companyId === me?.companyId)?.status}:${db.paymentMethods.length}:${db.payments.length}`,
  );
  const [checkout, setCheckout] = useState<{ reference: string; provider: PaymentProvider; amount: number; currency: string } | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  const status = useMemo(() => (me ? billingStatus(me.companyId) : null), [me, tick]);
  const u = useMemo(() => (me ? usage(me.companyId) : null), [me, tick]);
  const methods = useMemo(() => (me ? listPaymentMethods(me.companyId) : []), [me, tick]);
  const payments = useMemo(() => (me ? listPayments(me.companyId) : []), [me, tick]);

  if (!me || !status || !u) return null;
  const isPaid = status.effectiveTier === "paid";

  const startCheckout = (p: PaymentProvider) => {
    try {
      const c = initCheckout(me.id, me.companyId, p);
      setCheckout({ reference: c.reference, provider: c.provider, amount: c.amount, currency: c.currency });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const completeCheckout = () => {
    if (!checkout) return;
    try {
      verifyCheckout(me.id, me.companyId, checkout.reference);
      toast.show("Payment confirmed. You're on the Unlimited plan.", "success");
      setCheckout(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const capRow = (label: string, used: number, limit: number | null) => {
    const over = limit != null && used > limit;
    return (
      <div className="flex flex-row items-center justify-between text-[13px]" key={label}>
        <span className="text-slate">{label}</span>
        <span className={cn(over ? "font-semibold text-destructive" : "text-ink")}>
          {used} / {limit ?? "∞"}
        </span>
      </div>
    );
  };

  if (real) {
    return (
      <AdminGuard>
        <Screen maxWidth={880} contentClassName="gap-6 px-6 py-6">
          <PageHeader title="Billing & plan" subtitle={company?.name ?? undefined} />
          <RealBillingSection />
        </Screen>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <Screen maxWidth={880} contentClassName="gap-6 px-6 py-6">
        <PageHeader title="Billing & plan" subtitle={company?.name ?? undefined} />

        {status.status === "trialing" && status.trialDaysLeft != null ? (
          <Banner tone="warn">
            <Text variant="caption">
              <span className="font-semibold">
                Trial: {status.trialDaysLeft} day{status.trialDaysLeft === 1 ? "" : "s"} left.
              </span>{" "}
              You have full Unlimited access{status.trialEndsAt ? ` until ${shortDate(status.trialEndsAt)}` : ""}, then your workspace reverts to the Free limits (2 business units, 2
              departments). Upgrade any time to keep everything.
            </Text>
          </Banner>
        ) : null}

        <Card className="p-4">
          <div className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <Text variant="caption">Current plan</Text>
              <Text variant="title" className="mt-0.5 block !text-[18px]">
                {isPaid ? (status.isFoundingSub ? "Unlimited · Founding rate" : "Unlimited") : status.status === "trialing" ? "Free (trial)" : "Free"}
              </Text>
            </div>
            {status.isFoundingSub ? (
              <div className="text-right">
                <Text variant="caption" tone="teal" className="block font-semibold">
                  Founding member 🎉
                </Text>
                <Text variant="caption">Locked in forever{status.currentPeriodEnd ? ` · renews ${shortDate(status.currentPeriodEnd)}` : ""}</Text>
              </div>
            ) : isPaid ? (
              <div className="text-right">
                <Text variant="caption">
                  Status: <span className="font-medium capitalize text-ink">{status.status}</span>
                </Text>
                {status.currentPeriodEnd ? (
                  <Text variant="caption" className="block">
                    Renews {shortDate(status.currentPeriodEnd)}
                  </Text>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["free", "paid"] as const).map((planId) => {
            const current = (isPaid ? "paid" : "free") === planId;
            const isFreeCard = planId === "free";
            return (
              <Card key={planId} className={cn("flex flex-col gap-3 p-5", current && "border-ink ring-1 ring-ink")}>
                <div className="flex flex-row items-center justify-between">
                  <Text variant="heading" className="text-[15px]">
                    {isFreeCard ? "Free" : "Unlimited"}
                  </Text>
                  {current ? <Badge label="Current" className="bg-ink" textClassName="text-white" /> : null}
                </div>
                <Text variant="title" className="!text-[22px]">
                  {isFreeCard ? "Free" : status.isFoundingSub ? "Founding rate" : "Paid"}
                  {!isFreeCard ? <span className="text-[13px] font-normal text-slate">/month</span> : null}
                </Text>
                <div className="flex flex-1 flex-col gap-1.5">
                  {(isFreeCard ? FREE_FEATURES : PAID_FEATURES).map((f) => (
                    <div key={f} className="flex flex-row items-start gap-2">
                      <Check size={14} color={colors.teal} className="mt-0.5 shrink-0" />
                      <span className="text-[13px] text-ink">{f}</span>
                    </div>
                  ))}
                </div>

                {!isFreeCard && !isPaid ? (
                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      title="Start 14-day trial — Unlimited"
                      size="sm"
                      variant="amber"
                      icon={<Sparkles size={14} color={colors.ink} />}
                      onPress={() => {
                        try {
                          startTrial(me.id, me.companyId, "standard");
                          toast.show("Trial started", "success");
                        } catch (e) {
                          toast.show(e instanceof Error ? e.message : "Failed", "error");
                        }
                      }}
                      fullWidth
                    />
                    {status.foundingRateAvailable ? (
                      <Button
                        title="Lock the founding rate — forever"
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          try {
                            startTrial(me.id, me.companyId, "founding");
                            toast.show("Trial started at the founding rate", "success");
                          } catch (e) {
                            toast.show(e instanceof Error ? e.message : "Failed", "error");
                          }
                        }}
                        fullWidth
                      />
                    ) : null}
                  </div>
                ) : !isFreeCard && isPaid && status.status === "trialing" ? (
                  <div className="flex flex-row gap-2 pt-1">
                    <Button title="Pay with Paystack" size="sm" variant="outline" className="flex-1" onPress={() => startCheckout("paystack")} />
                    <Button title="Pay with Paddle" size="sm" variant="outline" className="flex-1" onPress={() => startCheckout("paddle")} />
                  </div>
                ) : !isFreeCard && isPaid && status.isFoundingSub ? (
                  <Text variant="caption" tone="teal" className="pt-1 text-center font-semibold">
                    Founding rate, locked forever 🎉
                  </Text>
                ) : !isFreeCard && isPaid ? (
                  <Button title="Renew / manage" size="sm" variant="outline" fullWidth onPress={() => startCheckout("paystack")} />
                ) : isFreeCard && isPaid ? (
                  <Button
                    title="Downgrade to free"
                    size="sm"
                    variant="outline"
                    fullWidth
                    onPress={() =>
                      confirmAction("Downgrade to free?", "Units over the free-tier caps will be frozen, not deleted — nothing is lost.", () => {
                        try {
                          downgradeToFree(me.id, me.companyId);
                          toast.show("Downgraded to free", "success");
                        } catch (e) {
                          toast.show(e instanceof Error ? e.message : "Failed", "error");
                        }
                      })
                    }
                  />
                ) : null}
              </Card>
            );
          })}
        </div>

        <Card className="flex flex-col gap-2 p-4">
          <Text variant="heading">{status.status === "trialing" ? "Your usage vs the Free limits (apply after the trial)" : "Usage against Free-tier limits"}</Text>
          {capRow("Business units", u.businessUnits.used, u.businessUnits.limit)}
          {capRow("Departments", u.departments.used, u.departments.limit)}
          {u.perUnit.some((p) => p.locked) ? (
            <div className="mt-1 flex flex-row items-center gap-1.5 border-t border-hairline/60 pt-2">
              <Lock size={13} color={colors.ink} />
              <Text variant="caption">
                {u.perUnit.filter((p) => p.locked).length} unit{u.perUnit.filter((p) => p.locked).length === 1 ? "" : "s"} frozen over the free-tier limit:{" "}
                {u.perUnit
                  .filter((p) => p.locked)
                  .map((p) => p.unitName)
                  .join(", ")}
                . Upgrade or move people out to unfreeze.
              </Text>
            </div>
          ) : null}
        </Card>

        <div className="overflow-hidden rounded-xl border border-hairline bg-card">
          <div className="flex flex-row items-center justify-between border-b border-hairline/70 px-4 py-3">
            <Text variant="heading" className="flex items-center gap-2">
              <CreditCard size={15} color={colors.ink} /> Payment methods
            </Text>
            <Button title="Add card" size="sm" variant="outline" icon={<CreditCard size={13} color={colors.ink} />} onPress={() => setCardOpen(true)} />
          </div>
          {methods.length === 0 ? (
            <Text variant="caption" className="block px-4 py-6 text-center">
              No saved cards. Your card is saved automatically the first time you pay.
            </Text>
          ) : (
            <div className="flex flex-col divide-y divide-hairline/60">
              {methods.map((m) => (
                <div key={m.id} className="flex flex-row items-center gap-3 px-4 py-3">
                  <span className="rounded bg-muted px-2 py-1 text-[11px] font-semibold uppercase text-slate">{m.brand}</span>
                  <div className="flex-1">
                    <Text variant="body" className="block text-[13px]">
                      •••• {m.last4}
                    </Text>
                    <Text variant="caption">
                      Expires {String(m.expMonth).padStart(2, "0")}/{m.expYear}
                      {m.isDefault ? " · default" : ""}
                    </Text>
                  </div>
                  <button type="button" onClick={() => removePaymentMethod(me.id, m.id)} className="text-slate hover:text-destructive">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-row items-center gap-1.5 border-t border-hairline/60 px-4 py-2.5">
            <ShieldCheck size={13} color={colors.mutedForeground} />
            <Text variant="caption">Card details are handled by the payment provider, 9nerz never stores your card number.</Text>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-hairline bg-card">
          <div className="border-b border-hairline/70 px-4 py-3">
            <Text variant="heading">Payment history</Text>
          </div>
          {payments.length === 0 ? (
            <Text variant="caption" className="block px-4 py-6 text-center">
              No payments yet.
            </Text>
          ) : (
            <div className="flex flex-col divide-y divide-hairline/60">
              {payments.map((p) => (
                <div key={p.id} className="flex flex-row items-center gap-3 px-4 py-2.5">
                  <Text variant="caption" className="w-20 shrink-0">
                    {shortDate(p.createdAt)}
                  </Text>
                  <Text variant="body" className="w-24 shrink-0 text-[13px] font-medium">
                    {p.currency} {(p.amount / 100).toLocaleString()}
                  </Text>
                  <Text variant="caption" className="flex-1 truncate font-mono">
                    {p.invoiceNumber ?? "—"}
                  </Text>
                  <Text variant="caption" className="w-20 shrink-0 capitalize">
                    {p.provider}
                  </Text>
                  <Badge label={p.status} className={p.status === "success" ? "bg-teal/15" : p.status === "pending" ? "bg-amber/20" : "bg-destructive/15"} />
                </div>
              ))}
            </div>
          )}
        </div>

        <Sheet
          visible={!!checkout}
          onClose={() => setCheckout(null)}
          title={checkout?.provider === "paddle" ? "Paddle checkout" : "Paystack checkout"}
          footer={<Button title="I've completed payment" fullWidth onPress={completeCheckout} />}
        >
          <Banner tone="info">
            <Text variant="caption">
              Simulated checkout via {checkout?.provider}. {checkout?.currency} {checkout ? (checkout.amount / 100).toLocaleString() : ""} — reference {checkout?.reference}. In production this
              opens the real provider; here, click below to confirm.
            </Text>
          </Banner>
        </Sheet>

        <Sheet
          visible={cardOpen}
          onClose={() => setCardOpen(false)}
          title="Add a card"
          footer={
            <Button
              title="Add card"
              fullWidth
              onPress={() => {
                try {
                  const [mm, yy] = exp.split("/");
                  addPaymentMethod(me.id, me.companyId, {
                    number: num,
                    expMonth: Number(mm) || 1,
                    expYear: Number(yy?.length === 2 ? `20${yy}` : yy) || 2030,
                    cvc,
                  });
                  toast.show("Card added", "success");
                  setNum("");
                  setExp("");
                  setCvc("");
                  setCardOpen(false);
                } catch (e) {
                  toast.show(e instanceof Error ? e.message : "Failed", "error");
                }
              }}
            />
          }
        >
          <div className="flex flex-col gap-3">
            <Input label="Card number" value={num} onChange={(e) => setNum(e.target.value)} placeholder="4242 4242 4242 4242" />
            <div className="flex flex-row gap-3">
              <Input containerClassName="flex-1" label="Expiry (MM/YY)" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="08/28" />
              <Input containerClassName="flex-1" label="CVC" value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="123" secure />
            </div>
          </div>
        </Sheet>
      </Screen>
    </AdminGuard>
  );
}
