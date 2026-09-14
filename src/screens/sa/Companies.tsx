import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { useDB } from "../../lib/db/store";
import { listCompanies } from "../../lib/services/superAdmin";
import { shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function SaCompanies() {
  const navigate = useNavigate();
  const tick = useDB((db) => db.companies.map((c) => c.id + c.status).join(","));
  const counts = useDB((db) => ({
    units: (companyId: string) => db.orgUnits.filter((u) => u.companyId === companyId).length,
    tasks: (companyId: string) => db.tasks.filter((t) => t.companyId === companyId).length,
  }));
  const all = useMemo(() => listCompanies(), [tick]);
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "frozen">(initialStatus === "active" || initialStatus === "frozen" ? initialStatus : "all");
  const [tier, setTier] = useState<"all" | "free" | "paid">("all");

  const companies = all.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && c.status !== status) return false;
    if (tier !== "all" && c.tier !== tier) return false;
    return true;
  });

  return (
    <Screen>
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Companies</h1>
          <Text variant="caption">{companies.length} shown</Text>
        </div>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} color={colors.slate} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name…"
              className="w-52 rounded-lg border border-hairline bg-card py-1.5 pl-8 pr-3 text-sm text-ink outline-none focus:border-ink"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-hairline bg-card px-2 py-1.5 text-sm capitalize text-ink outline-none focus:border-ink">
            <option value="all">All status</option>
            <option value="active">active</option>
            <option value="frozen">frozen</option>
          </select>
          <select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)} className="rounded-lg border border-hairline bg-card px-2 py-1.5 text-sm capitalize text-ink outline-none focus:border-ink">
            <option value="all">All tier</option>
            <option value="free">free</option>
            <option value="paid">paid</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Tier</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Users</th>
              <th className="px-3 py-2.5 text-right font-medium">Units</th>
              <th className="px-3 py-2.5 text-right font-medium">Tasks</th>
              <th className="px-4 py-2.5 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {companies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No companies match. Companies appear here once people sign up.
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="hover:bg-background">
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => navigate(`/sa/companies/${c.id}`)} className="font-medium text-ink hover:underline">
                      {c.name}
                    </button>
                    <span className="ml-2 text-[11px] text-muted-foreground">/{c.slug}</span>
                  </td>
                  <td className="px-3 py-2.5 capitalize text-muted-foreground">{c.tier}</td>
                  <td className="px-3 py-2.5">
                    {c.status === "frozen" ? (
                      <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">Frozen</span>
                    ) : (
                      <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[11px] font-semibold text-teal">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{c.users}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{counts.units(c.id)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{counts.tasks(c.id)}</td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground">{shortDate(c.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Screen>
  );
}
