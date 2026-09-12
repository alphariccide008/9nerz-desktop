import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Lock, Sparkles, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Sheet } from "../components/ui/Sheet";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Feedback";
import { KeyValueList, KeyValueRow } from "../components/ui/KeyValue";
import { useToast } from "../components/ui/Toast";
import { AdminGuard } from "../components/admin/AdminGuard";
import { useCurrentUser } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import {
  addPaymentMethod,
  billingStatus,
  downgradeToFree,
  initCheckout,
  listPaymentMethods,
  listPayments,
  removePaymentMethod,
  startTrial,
  usage,
  verifyCheckout,
} from "../lib/services/billing";
import { PaymentProvider } from "../lib/db/schema";
import { confirmAction } from "../lib/confirm";
import { shortDate } from "../lib/util";
import { colors } from "../lib/theme";

const FREE_FEATURES = ["Up to 2 business units", "Up to 2 departments", "Up to 4 people per unit", "1 support inbox", "Task boards, comments & history", "30-day audit trail"];
const PAID_FEATURES = ["Unlimited units & people", "Multiple inboxes + custom domain", "Extended audit retention", "Priority support"];

export default function Billing() {
  const me = useCurrentUser();
  const toast = useToast();
  const tick = useDB(
    (db) => `${db.companies.find((c) => c.id === me?.companyId)?.subscriptionTier}:${db.subscriptions.find((s) => s.companyId === me?.companyId)?.status}:${db.paymentMethods.length}:${db.payments.length}`,
  );
  const [checkout, setCheckout] = useState<{ reference: string; provider: PaymentProvider; amount: number; currency: string } | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>("paystack");
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
  const lockedUnits = u.perUnit.filter((p) => p.locked);

  const startCheckout = (p: PaymentProvider) => {
    setProvider(p);
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
      toast.show("Payment confirmed", "success");
      setCheckout(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <AdminGuard>
      <Screen maxWidth={840}>
        <PageHeader title="Billing" subtitle="Your plan is capped on structure, never on features." />

        {status.status === "trialing" ? (
          <Banner tone="info">
            <Text variant="caption">
              Trial — {status.trialDaysLeft} day{status.trialDaysLeft === 1 ? "" : "s"} left. Add a payment method below before it ends to keep your plan active.
            </Text>
          </Banner>
        ) : null}

        {lockedUnits.length > 0 ? (
          <Banner tone="warn">
            <div className="flex flex-row items-center gap-1.5">
              <Lock size={13} color={colors.ink} />
              <Text variant="caption">
                {lockedUnits.length} unit{lockedUnits.length === 1 ? "" : "s"} frozen over the free-tier limit: {lockedUnits.map((p) => p.unitName).join(", ")}. Upgrade or move people out to
                unfreeze.
              </Text>
            </div>
          </Banner>
        ) : null}

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2">
              <Text variant="heading">{isPaid ? status.planName : "Free plan"}</Text>
              {status.isFoundingSub ? <Badge label="founding rate" /> : null}
            </div>
            <Badge label={status.status} className={status.status === "active" ? "bg-teal/15" : status.status === "trialing" ? "bg-ink/10" : "bg-amber/20"} />
          </div>
          {(isPaid ? PAID_FEATURES : FREE_FEATURES).map((f) => (
            <div key={f} className="flex flex-row items-center gap-2">
              <CheckCircle2 size={14} color={colors.teal} />
              <span className="text-[13px] text-ink">{f}</span>
            </div>
          ))}
          {isPaid ? (
            <>
              {status.currentPeriodEnd ? <Text variant="caption">Renews {shortDate(status.currentPeriodEnd)}</Text> : null}
              {status.status === "trialing" ? (
                <div className="flex flex-row gap-2">
                  <Button title="Pay with Paystack (NGN)" size="sm" variant="outline" className="flex-1" onPress={() => startCheckout("paystack")} />
                  <Button title="Pay with Paddle (USD)" size="sm" variant="outline" className="flex-1" onPress={() => startCheckout("paddle")} />
                </div>
              ) : (
                <Button
                  title="Downgrade to free"
                  variant="outline"
                  size="sm"
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
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                title="Start 14-day trial — Standard"
                icon={<Sparkles size={15} color={colors.white} />}
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
                  title="Start 14-day trial — Founding rate (locked in forever)"
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
          )}
        </Card>

        {!isPaid ? (
          <KeyValueList>
            <KeyValueRow label="Business units" value={`${u.businessUnits.used} / ${u.businessUnits.limit}`} />
            <KeyValueRow label="Departments" value={`${u.departments.used} / ${u.departments.limit}`} />
            <KeyValueRow
              label="Fullest unit"
              value={(() => {
                const top = [...u.perUnit].sort((a, b) => b.used - a.used)[0];
                return top ? `${top.unitName}: ${top.used} / ${top.limit}${top.locked ? " (frozen)" : ""}` : "—";
              })()}
              last
            />
          </KeyValueList>
        ) : null}

        <div>
          <div className="mb-2 flex flex-row items-center justify-between">
            <Text variant="heading">Payment methods</Text>
            <Button title="Add card" size="sm" variant="outline" icon={<CreditCard size={13} color={colors.ink} />} onPress={() => setCardOpen(true)} />
          </div>
          {methods.length === 0 ? (
            <Banner tone="info">No card on file.</Banner>
          ) : (
            <Card>
              {methods.map((m, i) => (
                <div key={m.id} className={`flex flex-row items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
                  <CreditCard size={15} color={colors.slate} />
                  <span className="text-[13px] capitalize text-ink">
                    {m.brand} •••• {m.last4}
                  </span>
                  <Text variant="caption">
                    {String(m.expMonth).padStart(2, "0")}/{m.expYear}
                  </Text>
                  {m.isDefault ? <Badge label="default" /> : null}
                  <Button title="" size="sm" variant="ghost" icon={<Trash2 size={13} color={colors.destructive} />} className="ml-auto" onPress={() => removePaymentMethod(me.id, m.id)} />
                </div>
              ))}
            </Card>
          )}
        </div>

        {payments.length > 0 ? (
          <div>
            <Text variant="heading" className="mb-2 block">
              Payment history
            </Text>
            <Card>
              {payments.map((p, i) => (
                <div key={p.id} className={`flex flex-row items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
                  <div className="flex-1">
                    <div className="text-[13px] text-ink">
                      {p.currency} {(p.amount / 100).toLocaleString()}
                    </div>
                    {p.invoiceNumber ? (
                      <Text variant="caption">
                        {p.invoiceNumber} · {p.provider}
                      </Text>
                    ) : (
                      <Text variant="caption" className="capitalize">
                        {p.provider}
                      </Text>
                    )}
                  </div>
                  <Badge label={p.status} className={p.status === "success" ? "bg-teal/15" : p.status === "pending" ? "bg-amber/20" : "bg-destructive/15"} />
                  <Text variant="caption">{shortDate(p.createdAt)}</Text>
                </div>
              ))}
            </Card>
          </div>
        ) : null}

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
