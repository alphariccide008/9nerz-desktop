import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useDB } from "../../lib/db/store";
import { listCompanies } from "../../lib/services/superAdmin";
import { shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function SaCompanies() {
  const navigate = useNavigate();
  const tick = useDB((db) => db.companies.map((c) => c.id + c.status).join(","));
  const companies = useMemo(() => listCompanies(), [tick]);

  return (
    <Screen maxWidth={720}>
      <PageHeader title="Companies" subtitle="Every tenant on the platform." />
      <Card>
        {companies.map((c, i) => (
          <button key={c.id} type="button" onClick={() => navigate(`/sa/companies/${c.id}`)} className={`flex w-full flex-row items-center gap-3 px-4 py-3 text-left ${i > 0 ? "border-t border-hairline/60" : ""}`}>
            <Building2 size={16} color={colors.slate} />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-ink">{c.name}</div>
              <Text variant="caption">
                {c.users} users · created {shortDate(c.createdAt)}
              </Text>
            </div>
            <Badge label={c.tier} className={c.tier === "paid" ? "bg-teal/15" : "bg-muted"} />
            <Badge label={c.status} className={c.status === "active" ? "bg-teal/15" : "bg-destructive/15"} />
            <ChevronRight size={14} color={colors.mutedForeground} />
          </button>
        ))}
      </Card>
    </Screen>
  );
}
