import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, Play, Snowflake, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Loading } from "../../components/ui/Feedback";
import { KeyValueList, KeyValueRow } from "../../components/ui/KeyValue";
import { useToast } from "../../components/ui/Toast";
import { useDB } from "../../lib/db/store";
import { companyDetail, deleteCompany, setCompanyStatus } from "../../lib/services/superAdmin";
import { confirmAction } from "../../lib/confirm";
import { relativeTime, shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function SaCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const tick = useDB((db) => JSON.stringify(db.companies.find((c) => c.id === id)) + db.auditLogs.length);
  const data = useMemo(() => {
    try {
      return id ? companyDetail(id) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  if (!data || !id) return (
    <Screen>
      <Loading />
    </Screen>
  );
  const { company, subscription, members, units, tasks, tickets, payments, audit } = data;

  const setStatus = (s: "active" | "frozen" | "suspended") =>
    confirmAction(`Set ${company.name} to ${s}?`, s === "active" ? "Users regain access." : "This blocks all authenticated access.", () => {
      setCompanyStatus(id, s);
      toast.show(`Company ${s}`, "success");
    });

  return (
    <Screen maxWidth={680}>
      <PageHeader title={company.name} subtitle={`@${company.slug}`} />
      <div className="flex flex-row items-center gap-2">
        <Badge label={company.subscriptionTier} className={company.subscriptionTier === "paid" ? "bg-teal/15" : "bg-muted"} />
        <Badge label={company.status} className={company.status === "active" ? "bg-teal/15" : "bg-destructive/15"} />
      </div>

      <div className="flex flex-row flex-wrap gap-2">
        {company.status !== "active" ? (
          <Button title="Unfreeze" size="sm" icon={<Play size={13} color={colors.white} />} onPress={() => setStatus("active")} />
        ) : (
          <>
            <Button title="Freeze" size="sm" variant="outline" icon={<Snowflake size={13} color={colors.ink} />} onPress={() => setStatus("frozen")} />
            <Button title="Suspend" size="sm" variant="outline" icon={<Ban size={13} color={colors.ink} />} onPress={() => setStatus("suspended")} />
          </>
        )}
        <Button
          title="Delete"
          size="sm"
          variant="destructive"
          icon={<Trash2 size={13} color={colors.white} />}
          onPress={() =>
            confirmAction(
              "Delete this company?",
              "Permanently removes the tenant and all its data.",
              () => {
                deleteCompany(id);
                toast.show("Company deleted", "success");
                navigate("/sa/companies", { replace: true });
              },
              "Delete",
              true,
            )
          }
        />
      </div>

      <KeyValueList>
        <KeyValueRow label="Users" value={members.length} />
        <KeyValueRow label="Units" value={units} />
        <KeyValueRow label="Tasks" value={tasks} />
        <KeyValueRow label="Tickets" value={tickets} />
        <KeyValueRow label="Subscription" value={subscription ? `${subscription.tier} · ${subscription.status}` : "—"} />
        <KeyValueRow label="Created" value={shortDate(company.createdAt)} last />
      </KeyValueList>

      <Text variant="heading">People</Text>
      <Card>
        {members.map((m, i) => (
          <button key={m.id} type="button" onClick={() => navigate(`/sa/users/${m.id}`)} className={`flex w-full flex-row items-center gap-3 px-4 py-2.5 text-left ${i > 0 ? "border-t border-hairline/60" : ""}`}>
            <div className="flex-1">
              <div className="text-[13px] text-ink">
                {m.name}
                {m.isAdmin ? <span className="text-teal"> · admin</span> : null}
              </div>
              <Text variant="caption">{m.email}</Text>
            </div>
            <Badge label={m.status} className={m.status === "active" ? "bg-teal/15" : "bg-muted"} />
          </button>
        ))}
      </Card>

      {payments.length > 0 ? (
        <>
          <Text variant="heading">Payments</Text>
          <Card>
            {payments.map((p, i) => (
              <div key={p.id} className={`flex flex-row items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
                <span className="flex-1 text-[13px] text-ink">
                  {p.currency} {(p.amount / 100).toLocaleString()}
                </span>
                <Badge label={p.status} className={p.status === "success" ? "bg-teal/15" : "bg-amber/20"} />
                <Text variant="caption">{shortDate(p.createdAt)}</Text>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <Text variant="heading">Recent audit</Text>
      <Card>
        {audit.slice(0, 12).map((a, i) => (
          <div key={a.id} className={`flex flex-row items-center gap-3 px-4 py-2 ${i > 0 ? "border-t border-hairline/60" : ""}`}>
            <span className="flex-1 truncate text-[12px] capitalize text-ink">{a.actionType.replace(/_/g, " ")}</span>
            <Text variant="caption">{relativeTime(a.createdAt)}</Text>
          </div>
        ))}
      </Card>
    </Screen>
  );
}
