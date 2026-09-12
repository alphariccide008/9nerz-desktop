import { useMemo } from "react";
import { CheckSquare } from "lucide-react";

import { Screen, PageHeader } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState, Banner } from "../components/ui/Feedback";
import { useToast } from "../components/ui/Toast";
import { useCurrentUser, useIsAdmin } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import { decideApproval, listApprovals } from "../lib/services/org";
import { displayName } from "../lib/services/helpers";
import { getDB } from "../lib/db/store";
import { relativeTime } from "../lib/util";
import { colors } from "../lib/theme";

export default function Approvals() {
  const me = useCurrentUser();
  const isAdmin = useIsAdmin();
  const toast = useToast();
  const tick = useDB((db) => db.approvalRequests.map((a) => `${a.id}${a.status}`).join(","));
  const items = useMemo(() => (me ? listApprovals(me.companyId) : []), [me, tick]);

  if (!me) return null;

  const decide = (id: string, decision: "approved" | "rejected") => {
    try {
      decideApproval(me.id, id, decision);
      toast.show(`Request ${decision}`, "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  return (
    <Screen maxWidth={640}>
      <PageHeader title="Approvals" subtitle="Actions parked pending an admin's decision." />
      {!isAdmin ? <Banner tone="info">Only admins can decide on approval requests.</Banner> : null}

      {items.length === 0 ? (
        <EmptyState icon={<CheckSquare size={22} color={colors.slate} />} title="Nothing waiting" body="Requests that need approval will appear here." />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((a) => {
            const p = a.payload as Record<string, string>;
            return (
              <Card key={a.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-row items-center justify-between">
                  <Text variant="heading" className="capitalize">
                    {a.actionType.replace(/_/g, " ")}
                  </Text>
                  <Badge label={a.status} className={a.status === "pending" ? "bg-amber/20" : a.status === "approved" ? "bg-teal/15" : "bg-destructive/15"} />
                </div>
                <Text variant="caption">
                  Requested by {displayName(getDB(), a.requestedBy)} · {relativeTime(a.createdAt)}
                </Text>
                {a.actionType === "cross_unit_move" ? (
                  <Text variant="body" className="block text-[13px]">
                    Move {displayName(getDB(), p.userId)} to a different unit{p.newManagerId ? `, reporting to ${displayName(getDB(), p.newManagerId)}` : ""}.
                  </Text>
                ) : null}
                {a.status === "pending" && isAdmin ? (
                  <div className="flex flex-row gap-2">
                    <Button title="Approve" size="sm" onPress={() => decide(a.id, "approved")} />
                    <Button title="Reject" size="sm" variant="outline" onPress={() => decide(a.id, "rejected")} />
                  </div>
                ) : a.decisionNote ? (
                  <Text variant="caption">Note: {a.decisionNote}</Text>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
